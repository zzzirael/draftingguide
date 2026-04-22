import sqlite3
import pandas as pd
from itertools import combinations


def build_synergy_matrix(db_path: str, league: str = None, patch_major: str = None):
    conn = sqlite3.connect(db_path)

    query = """
        SELECT mp.match_id, mp.side, mp.champion, mt.result,
               m.league, m.patch_major
        FROM match_picks mp
        JOIN match_teams mt ON mp.match_id = mt.match_id AND mp.side = mt.side
        JOIN matches m ON mp.match_id = m.id
        WHERE 1=1
    """
    params = []
    if league:
        query += " AND m.league = ?"
        params.append(league)
    if patch_major:
        query += " AND m.patch_major = ?"
        params.append(patch_major)

    df = pd.read_sql(query, conn, params=params)

    synergy_rows = []
    for (match_id, side, league_name, patch), group in df.groupby(
        ['match_id', 'side', 'league', 'patch_major']
    ):
        champions = group['champion'].dropna().tolist()
        result = group['result'].iloc[0]

        for champ_a, champ_b in combinations(sorted(champions), 2):
            synergy_rows.append({
                'champion_a': champ_a,
                'champion_b': champ_b,
                'league': league_name,
                'patch_major': patch,
                'win': result
            })

    synergy_df = pd.DataFrame(synergy_rows)
    if synergy_df.empty:
        print("Nenhum dado de sinergia encontrado.")
        conn.close()
        return

    agg = synergy_df.groupby(
        ['champion_a', 'champion_b', 'league', 'patch_major']
    ).agg(games=('win', 'count'), wins=('win', 'sum')).reset_index()

    agg.to_sql('synergy_matrix', conn, if_exists='replace', index=False)
    conn.close()
    print(f"Sinergia calculada: {len(agg)} pares")


def build_counter_matrix(db_path: str, league: str = None, patch_major: str = None):
    conn = sqlite3.connect(db_path)

    query = """
        SELECT
            a.match_id,
            a.champion AS champion,
            b.champion AS vs_champion,
            a_team.result AS win,
            m.league,
            m.patch_major
        FROM match_picks a
        JOIN match_picks b
            ON a.match_id = b.match_id
            AND a.position = b.position
            AND a.side != b.side
        JOIN match_teams a_team
            ON a.match_id = a_team.match_id AND a.side = a_team.side
        JOIN matches m ON a.match_id = m.id
        WHERE 1=1
    """
    params = []
    if league:
        query += " AND m.league = ?"
        params.append(league)
    if patch_major:
        query += " AND m.patch_major = ?"
        params.append(patch_major)

    df = pd.read_sql(query, conn, params=params)

    if df.empty:
        print("Nenhum dado de counter encontrado.")
        conn.close()
        return

    agg = df.groupby(
        ['champion', 'vs_champion', 'league', 'patch_major']
    ).agg(games=('win', 'count'), wins=('win', 'sum')).reset_index()

    agg.to_sql('counter_matrix', conn, if_exists='replace', index=False)
    conn.close()
    print(f"Counter calculado: {len(agg)} matchups")
