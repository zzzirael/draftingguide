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


_predictor_instance: Optional[DraftPredictor] = None


def get_predictor() -> Optional[DraftPredictor]:
    global _predictor_instance
    if _predictor_instance is None and os.path.exists(MODEL_PATH):
        _predictor_instance = DraftPredictor(db_path=DB_PATH)
    return _predictor_instance
