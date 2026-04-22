import sqlite3
from dataclasses import dataclass, field
from typing import Optional

MIN_SAMPLE_SIZE = 5


@dataclass
class DraftState:
    allied_picks: list[str] = field(default_factory=list)
    enemy_picks: list[str] = field(default_factory=list)
    banned: list[str] = field(default_factory=list)
    league: Optional[str] = None
    patch_major: Optional[str] = None
    is_playoffs: Optional[bool] = None


def score_champion(
    champion: str,
    state: DraftState,
    db_path: str,
    weights: dict = None
) -> dict:
    if weights is None:
        weights = {
            'base_winrate': 0.3,
            'synergy':      0.35,
            'counter':      0.35,
        }

    conn = sqlite3.connect(db_path)

    def build_filter(extra=""):
        clauses = ["games >= ?"]
        params = [MIN_SAMPLE_SIZE]
        if state.league:
            clauses.append("league = ?")
            params.append(state.league)
        if state.patch_major:
            clauses.append("patch_major = ?")
            params.append(state.patch_major)
        if extra:
            clauses.append(extra)
        return " AND ".join(clauses), params

    # 1. Win rate base do campeão
    where, params = build_filter("champion = ?")
    params.append(champion)
    row = conn.execute(
        f"SELECT SUM(wins), SUM(games) FROM counter_matrix WHERE {where}",
        params
    ).fetchone()
    base_winrate = (row[0] / row[1]) if row and row[1] else 0.5

    # 2. Score de sinergia com os aliados
    synergy_scores = []
    for ally in state.allied_picks:
        a, b = sorted([champion, ally])
        where, params = build_filter("champion_a = ? AND champion_b = ?")
        params += [a, b]
        row = conn.execute(
            f"SELECT wins, games FROM synergy_matrix WHERE {where}",
            params
        ).fetchone()
        if row and row[1] >= MIN_SAMPLE_SIZE:
            synergy_scores.append(row[0] / row[1])

    synergy_score = sum(synergy_scores) / len(synergy_scores) if synergy_scores else 0.5

    # 3. Score de counter contra os inimigos
    counter_scores = []
    for enemy in state.enemy_picks:
        where, params = build_filter("champion = ? AND vs_champion = ?")
        params += [champion, enemy]
        row = conn.execute(
            f"SELECT wins, games FROM counter_matrix WHERE {where}",
            params
        ).fetchone()
        if row and row[1] >= MIN_SAMPLE_SIZE:
            counter_scores.append(row[0] / row[1])

    counter_score = sum(counter_scores) / len(counter_scores) if counter_scores else 0.5

    conn.close()

    final_score = (
        weights['base_winrate'] * base_winrate +
        weights['synergy']      * synergy_score +
        weights['counter']      * counter_score
    )

    return {
        'champion':     champion,
        'score':        round(final_score, 4),
        'base_winrate': round(base_winrate, 4),
        'synergy':      round(synergy_score, 4),
        'counter':      round(counter_score, 4),
    }


def suggest_picks(
    available_champions: list[str],
    state: DraftState,
    db_path: str,
    top_n: int = 5
) -> list[dict]:
    candidates = [c for c in available_champions if c not in state.banned]
    scored = [score_champion(c, state, db_path) for c in candidates]
    return sorted(scored, key=lambda x: x['score'], reverse=True)[:top_n]
