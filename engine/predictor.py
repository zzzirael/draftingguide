import sqlite3
import numpy as np
import joblib
import os
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from pipeline.build_features import load_metadata

MODEL_PATH    = "data/model.joblib"
METADATA_PATH = "data/model_metadata.json"
DB_PATH       = "data/lol.db"

POSITIONS = ['top', 'jng', 'mid', 'bot', 'sup']


@dataclass
class DraftState:
    allied_picks:  list[str] = field(default_factory=list)
    enemy_picks:   list[str] = field(default_factory=list)
    banned:        list[str] = field(default_factory=list)
    side:          str = 'blue'
    league:        Optional[str] = None
    patch_major:   Optional[str] = None
    is_playoffs:   bool = False


class DraftPredictor:
    def __init__(self, db_path: str = DB_PATH):
        self.model    = joblib.load(MODEL_PATH)
        self.metadata = load_metadata(METADATA_PATH)
        self._champ_set    = set(self.metadata['champions'])
        self._league_set   = set(self.metadata['leagues'])
        self._feature_cols = self.metadata['feature_columns']
        self._champ_positions = self._load_champion_positions(db_path)
        self._db_path = db_path

    def _load_champion_positions(self, db_path: str) -> dict:
        try:
            conn = sqlite3.connect(db_path)
            rows = conn.execute("""
                SELECT champion, position, COUNT(*) as games
                FROM match_picks
                WHERE champion IS NOT NULL AND position NOT IN ('team','')
                GROUP BY champion, position
            """).fetchall()
            conn.close()
        except Exception:
            return {}

        pos_counts = defaultdict(dict)
        for champ, pos, games in rows:
            if pos in POSITIONS:
                pos_counts[champ][pos] = games

        result = {}
        for champ, positions in pos_counts.items():
            result[champ] = sorted(positions.keys(), key=lambda p: positions[p], reverse=True)
        return result

    def _build_feature_vector(self, state: DraftState, candidate: Optional[str] = None) -> np.ndarray:
        allied = list(state.allied_picks) + ([candidate] if candidate else [])
        ally_set  = set(allied)
        enemy_set = set(state.enemy_picks)

        row = {}
        for champ in self.metadata['champions']:
            row[f'ally_{champ}']  = 1 if champ in ally_set  else 0
            row[f'enemy_{champ}'] = 1 if champ in enemy_set else 0

        row['side_blue']     = 1 if state.side == 'blue' else 0
        row['is_playoffs']   = int(state.is_playoffs)
        row['n_ally_picks']  = len(ally_set)
        row['n_enemy_picks'] = len(enemy_set)

        try:
            parts = str(state.patch_major).split('.')
            row['patch_numeric'] = float(f"{parts[0]}.{parts[1].zfill(2)}")
        except Exception:
            row['patch_numeric'] = 0.0

        for lg in self.metadata['leagues']:
            row[f'league_{lg}'] = 1 if state.league == lg else 0

        return np.array([row.get(col, 0) for col in self._feature_cols], dtype=np.float32)

    def predict_win_probability(self, state: DraftState) -> float:
        if not state.allied_picks:
            return 0.5
        vec  = self._build_feature_vector(state)
        prob = self.model.predict_proba(vec.reshape(1, -1))[0][1]
        return round(float(prob), 4)

    def suggest_picks(
        self,
        available_champions: list[str],
        state: DraftState,
        top_n: int = 20,
        position_filter: Optional[str] = None,
    ) -> list[dict]:
        base_prob = self.predict_win_probability(state)

        candidates = [
            c for c in available_champions
            if c not in state.banned
            and c not in state.allied_picks
            and c not in state.enemy_picks
            and c in self._champ_set
            and (position_filter is None or position_filter in self._champ_positions.get(c, []))
        ]

        results = []
        for champ in candidates:
            vec  = self._build_feature_vector(state, candidate=champ)
            prob = float(self.model.predict_proba(vec.reshape(1, -1))[0][1])
            positions = self._champ_positions.get(champ, [])
            results.append({
                'champion':        champ,
                'win_probability': round(prob, 4),
                'delta':           round(prob - base_prob, 4),
                'primary_position': positions[0] if positions else 'flex',
                'positions':       positions[:3],
            })

        results.sort(key=lambda x: x['win_probability'], reverse=True)
        for i, r in enumerate(results[:top_n]):
            r['rank'] = i + 1
        return results[:top_n]

    def suggest_by_lane(
        self,
        available_champions: list[str],
        state: DraftState,
        top_per_lane: int = 3,
    ) -> dict:
        pool = self.suggest_picks(available_champions, state, top_n=60)

        by_lane = {pos: [] for pos in POSITIONS}
        seen = set()

        for suggestion in pool:
            for pos in suggestion['positions']:
                if pos in by_lane and len(by_lane[pos]) < top_per_lane and suggestion['champion'] not in seen:
                    by_lane[pos].append(suggestion)
                    seen.add(suggestion['champion'])
                    break

        # Fill empty lanes from overflow
        for pos in POSITIONS:
            if len(by_lane[pos]) < top_per_lane:
                for suggestion in pool:
                    if suggestion['champion'] not in seen and len(by_lane[pos]) < top_per_lane:
                        entry = {**suggestion, 'primary_position': pos}
                        by_lane[pos].append(entry)
                        seen.add(suggestion['champion'])

        return by_lane

    def get_counter_suggestions(
        self,
        enemy_champion: str,
        available: list[str],
        state: DraftState,
        top_n: int = 4,
        use_matrix: bool = True,
    ) -> list[dict]:
        if use_matrix:
            return self._counter_from_matrix(enemy_champion, state, top_n)
        # Fallback: ML inference with single enemy
        counter_state = DraftState(
            allied_picks=state.allied_picks,
            enemy_picks=[enemy_champion],
            banned=state.banned,
            side=state.side,
            league=state.league,
            patch_major=state.patch_major,
        )
        return self.suggest_picks(available, counter_state, top_n=top_n)

    def _counter_from_matrix(self, enemy_champion: str, state: DraftState, top_n: int) -> list[dict]:
        try:
            conn = sqlite3.connect(self._db_path)

            def query(league=None, patch=None, min_games=5):
                clauses = ["vs_champion = ?", f"games >= {min_games}"]
                params  = [enemy_champion]
                if league: clauses.append("league = ?");      params.append(league)
                if patch:  clauses.append("patch_major = ?"); params.append(patch)
                where = " AND ".join(clauses)
                return conn.execute(f"""
                    SELECT champion, wins, games
                    FROM counter_matrix
                    WHERE {where}
                    ORDER BY CAST(wins AS FLOAT) / games DESC
                    LIMIT ?
                """, params + [top_n * 3]).fetchall()

            rows = query(state.league, state.patch_major, min_games=5)

            # Fallback 1: patch sem dados → tenta sem filtro de patch
            if not rows and state.patch_major:
                rows = query(state.league, patch=None, min_games=5)

            # Fallback 2: ainda vazio → sem filtro nenhum
            if not rows:
                rows = query(league=None, patch=None, min_games=3)

            conn.close()
        except Exception:
            return []

        used = set(state.allied_picks) | set(state.banned) | set(state.enemy_picks)
        results = []
        for champ, wins, games in rows:
            if champ in used:
                continue
            wr = round(wins / games, 4) if games else 0.5
            results.append({
                'champion':        champ,
                'win_probability': wr,
                'delta':           round(wr - 0.5, 4),
                'games':           games,
                'primary_position': self._champ_positions.get(champ, ['flex'])[0],
            })
            if len(results) >= top_n:
                break
        return results


    def suggest_bans(
        self,
        available_champions: list[str],
        state: DraftState,
        top_n: int = 10,
    ) -> list[dict]:
        """
        Return available champions ranked by threat to allied picks.

        When allies exist: uses counter_matrix to find what beats each ally.
        When no allies yet: returns highest win-rate champions in current meta.
        """
        used  = set(state.allied_picks) | set(state.banned) | set(state.enemy_picks)
        av_set = set(available_champions)

        try:
            conn = sqlite3.connect(self._db_path)

            if state.allied_picks:
                # Phase 2+: champions that counter our specific picks
                threat_scores: dict[str, list[float]] = {}

                for ally in state.allied_picks:
                    def _q(ally=ally, lg=None, pm=None, min_g=5):
                        clauses = ["vs_champion = ?", f"games >= {min_g}"]
                        params  = [ally]
                        if lg: clauses.append("league = ?");      params.append(lg)
                        if pm: clauses.append("patch_major = ?"); params.append(pm)
                        return conn.execute(f"""
                            SELECT champion, wins, games FROM counter_matrix
                            WHERE {' AND '.join(clauses)}
                            ORDER BY CAST(wins AS FLOAT)/games DESC LIMIT 25
                        """, params).fetchall()

                    rows = _q(lg=state.league, pm=state.patch_major)
                    if not rows and state.patch_major: rows = _q(lg=state.league)
                    if not rows:                       rows = _q(min_g=3)

                    for champ, wins, games in rows:
                        wr = wins / games if games else 0.5
                        if wr <= 0.50: continue
                        threat_scores.setdefault(champ, []).append(wr - 0.5)

                conn.close()
                results = []
                for champ, threats in threat_scores.items():
                    if champ in used or champ not in av_set: continue
                    avg = sum(threats) / len(threats)
                    results.append({
                        'champion':        champ,
                        'threat_delta':    -round(avg, 4),
                        'primary_position': self._champ_positions.get(champ, ['flex'])[0],
                    })

            else:
                # Phase 1 (no allied picks yet): strongest champions in current meta
                def _qg(lg=None, pm=None, min_g=15):
                    clauses = [f"games >= {min_g}"]
                    params  = []
                    if lg: clauses.append("league = ?");      params.append(lg)
                    if pm: clauses.append("patch_major = ?"); params.append(pm)
                    return conn.execute(f"""
                        SELECT champion, SUM(wins) w, SUM(games) g
                        FROM counter_matrix
                        WHERE {' AND '.join(clauses)}
                        GROUP BY champion HAVING g >= {min_g}
                        ORDER BY CAST(w AS FLOAT)/g DESC LIMIT {top_n * 3}
                    """, params).fetchall()

                rows = _qg(lg=state.league, pm=state.patch_major)
                if not rows and state.patch_major: rows = _qg(lg=state.league)
                if not rows:                       rows = _qg(min_g=10)
                conn.close()

                results = []
                for champ, wins, games in rows:
                    if champ in used or champ not in av_set: continue
                    wr = wins / games if games else 0.5
                    results.append({
                        'champion':        champ,
                        'threat_delta':    -round(wr - 0.5, 4),
                        'primary_position': self._champ_positions.get(champ, ['flex'])[0],
                    })

        except Exception:
            return []

        results.sort(key=lambda x: x['threat_delta'])
        return results[:top_n]

    def get_matchup_winrate(
        self,
        champion: str,
        vs_champion: str,
        league: Optional[str] = None,
        patch_major: Optional[str] = None,
    ) -> dict:
        """Head-to-head WR from counter_matrix, with same fallback chain as counter analysis."""
        try:
            conn = sqlite3.connect(self._db_path)

            def query(lg=None, pm=None, min_games=5):
                clauses = ["champion = ?", "vs_champion = ?", f"games >= {min_games}"]
                params  = [champion, vs_champion]
                if lg: clauses.append("league = ?");      params.append(lg)
                if pm: clauses.append("patch_major = ?"); params.append(pm)
                return conn.execute(
                    f"SELECT wins, games FROM counter_matrix WHERE {' AND '.join(clauses)} LIMIT 1",
                    params
                ).fetchone()

            row = query(league, patch_major, 5)
            if not row and patch_major: row = query(league, None, 5)
            if not row:                 row = query(None,   None, 3)
            conn.close()

            if row:
                wins, games = row
                return {"win_rate": round(wins / games, 4) if games else 0.5, "games": games}
        except Exception:
            pass
        return {"win_rate": None, "games": 0}


    def get_pick_order_stats(
        self,
        champion: str,
        league: Optional[str] = None,
        patch_major: Optional[str] = None,
    ) -> dict:
        """Win rate and first-pick rate by draft slot from Leaguepedia data."""
        try:
            conn = sqlite3.connect(self._db_path)

            # Check table exists
            if not conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='pick_order_stats'"
            ).fetchone():
                conn.close()
                return {"champion": champion, "by_slot": [], "total_games": 0, "first_pick_rate": None}

            def query(lg=None, pm=None):
                clauses = ["champion = ?"]
                params  = [champion]
                if lg: clauses.append("league = ?");      params.append(lg)
                if pm: clauses.append("patch_major = ?"); params.append(pm)
                return conn.execute(f"""
                    SELECT pick_slot, SUM(wins), SUM(games)
                    FROM pick_order_stats
                    WHERE {' AND '.join(clauses)}
                    GROUP BY pick_slot ORDER BY pick_slot
                """, params).fetchall()

            rows = query(league, patch_major)
            if not rows and patch_major: rows = query(league)
            if not rows:                 rows = query()
            conn.close()
        except Exception:
            return {"champion": champion, "by_slot": [], "total_games": 0, "first_pick_rate": None}

        total_games      = sum(g for _, _, g in rows)
        first_pick_games = next((g for slot, _, g in rows if slot == 1), 0)
        preferred_slot   = max(rows, key=lambda r: (r[1] / r[2]) if r[2] else 0)[0] if rows else None

        return {
            "champion": champion,
            "by_slot": [
                {"slot": slot, "win_rate": round(w / g, 4) if g else None, "games": g}
                for slot, w, g in rows
            ],
            "total_games":     total_games,
            "first_pick_rate": round(first_pick_games / total_games, 4) if total_games else None,
            "preferred_slot":  preferred_slot,
        }

    def _get_synergy_pairs(
        self,
        picks: list[str],
        league: Optional[str] = None,
        patch_major: Optional[str] = None,
        top_n: int = 6,
    ) -> list[dict]:
        """Top win-rate synergy pairs for a set of picks from synergy_matrix."""
        picks = [p for p in picks if p]
        if len(picks) < 2:
            return []
        try:
            conn = sqlite3.connect(self._db_path)

            def query(lg=None, pm=None, min_g=5):
                ph = ",".join("?" for _ in picks)
                clauses = [f"champion_a IN ({ph})", f"champion_b IN ({ph})", f"games >= {min_g}"]
                params  = picks + picks
                if lg: clauses.append("league = ?");      params.append(lg)
                if pm: clauses.append("patch_major = ?"); params.append(pm)
                return conn.execute(f"""
                    SELECT champion_a, champion_b, wins, games
                    FROM synergy_matrix
                    WHERE {' AND '.join(clauses)}
                    ORDER BY CAST(wins AS FLOAT)/games DESC
                    LIMIT {top_n * 3}
                """, params).fetchall()

            rows = query(league, patch_major)
            if not rows and patch_major: rows = query(league)
            if not rows:                 rows = query(min_g=3)
            conn.close()
        except Exception:
            return []

        seen, results = set(), []
        for a, b, wins, games in rows:
            key = tuple(sorted([a, b]))
            if key in seen:
                continue
            seen.add(key)
            results.append({
                "champion_a": a,
                "champion_b": b,
                "win_rate":   round(wins / games, 4) if games else 0.5,
                "games":      games,
            })
            if len(results) >= top_n:
                break
        return results

    def analyze_comp(
        self,
        blue_picks: list[str],
        red_picks:  list[str],
        blue_roles: list[Optional[str]],
        red_roles:  list[Optional[str]],
        league:      Optional[str] = None,
        patch_major: Optional[str] = None,
    ) -> dict:
        """
        Full draft analysis:
        - Win probability (ML, blue side perspective)
        - Synergy pairs for each team (synergy_matrix)
        - Counter matrix: each blue champ vs each red champ (counter_matrix)
        - Lane matchups (if roles provided)
        """
        blue = [p for p in blue_picks if p]
        red  = [p for p in red_picks  if p]

        # Win probability
        wp = 0.5
        if blue:
            state = DraftState(
                allied_picks=blue, enemy_picks=red,
                side='blue', league=league, patch_major=patch_major,
            )
            wp = self.predict_win_probability(state)

        # Synergies
        blue_syn = self._get_synergy_pairs(blue, league, patch_major)
        red_syn  = self._get_synergy_pairs(red,  league, patch_major)

        # Counter matrix (each blue pick vs each red pick)
        counter_matrix = []
        for bp in blue_picks:
            if not bp:
                continue
            row = []
            for rp in red_picks:
                if not rp:
                    continue
                wr_data = self.get_matchup_winrate(bp, rp, league, patch_major)
                row.append({
                    "blue_champion": bp,
                    "red_champion":  rp,
                    "win_rate":      wr_data.get("win_rate"),
                    "games":         wr_data.get("games", 0),
                })
            if row:
                counter_matrix.append(row)

        # Lane matchups (only when both sides have a champion assigned to the same role)
        role_pairs: dict[str, dict] = {}
        for i, role in enumerate(blue_roles):
            if role and i < len(blue_picks) and blue_picks[i]:
                role_pairs.setdefault(role, {})["blue"] = blue_picks[i]
        for i, role in enumerate(red_roles):
            if role and i < len(red_picks) and red_picks[i]:
                role_pairs.setdefault(role, {})["red"] = red_picks[i]

        lane_matchups = []
        for role, pair in role_pairs.items():
            if "blue" in pair and "red" in pair:
                wr_data = self.get_matchup_winrate(pair["blue"], pair["red"], league, patch_major)
                lane_matchups.append({
                    "lane":            role,
                    "blue_champion":   pair["blue"],
                    "red_champion":    pair["red"],
                    "blue_win_rate":   wr_data.get("win_rate"),
                    "games":           wr_data.get("games", 0),
                })

        return {
            "win_probability": {"blue": wp, "red": round(1 - wp, 4)},
            "synergies":       {"blue": blue_syn, "red": red_syn},
            "counter_matrix":  counter_matrix,
            "lane_matchups":   lane_matchups,
        }


_predictor_instance: Optional[DraftPredictor] = None


def get_predictor() -> Optional[DraftPredictor]:
    global _predictor_instance
    if _predictor_instance is None and os.path.exists(MODEL_PATH):
        _predictor_instance = DraftPredictor(db_path=DB_PATH)
    return _predictor_instance
