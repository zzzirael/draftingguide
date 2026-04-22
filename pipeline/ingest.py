import pandas as pd
import sqlite3
import os


def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS matches (
            id           TEXT PRIMARY KEY,
            league       TEXT,
            split        TEXT,
            is_playoffs  INTEGER,
            date         TEXT,
            patch        TEXT,
            patch_major  TEXT
        );

        CREATE TABLE IF NOT EXISTS match_teams (
            match_id     TEXT REFERENCES matches(id),
            side         TEXT,
            team_name    TEXT,
            result       INTEGER,
            ban1         TEXT,
            ban2         TEXT,
            ban3         TEXT,
            ban4         TEXT,
            ban5         TEXT,
            PRIMARY KEY (match_id, side)
        );

        CREATE TABLE IF NOT EXISTS match_picks (
            match_id     TEXT REFERENCES matches(id),
            side         TEXT,
            position     TEXT,
            champion     TEXT,
            kills        INTEGER,
            deaths       INTEGER,
            assists      INTEGER,
            PRIMARY KEY (match_id, side, position)
        );

        CREATE TABLE IF NOT EXISTS synergy_matrix (
            champion_a   TEXT,
            champion_b   TEXT,
            league       TEXT,
            patch_major  TEXT,
            games        INTEGER,
            wins         INTEGER,
            PRIMARY KEY (champion_a, champion_b, league, patch_major)
        );

        CREATE TABLE IF NOT EXISTS counter_matrix (
            champion     TEXT,
            vs_champion  TEXT,
            league       TEXT,
            patch_major  TEXT,
            games        INTEGER,
            wins         INTEGER,
            PRIMARY KEY (champion, vs_champion, league, patch_major)
        );
    """)
    conn.close()


def load_oracleselixir(csv_path: str, db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    init_db(db_path)

    df = pd.read_csv(csv_path, low_memory=False)

    teams_df = df[df['position'] == 'team'].copy()
    players_df = df[df['position'] != 'team'].copy()

    conn = sqlite3.connect(db_path)

    # Inserir partidas únicas
    matches = teams_df[[
        'gameid', 'league', 'split', 'playoffs', 'date', 'patch'
    ]].drop_duplicates('gameid').copy()
    matches['patch_major'] = matches['patch'].astype(str).str.split('.').str[:2].str.join('.')
    matches.rename(columns={'gameid': 'id', 'playoffs': 'is_playoffs'}, inplace=True)

    existing_ids = set(
        r[0] for r in conn.execute("SELECT id FROM matches").fetchall()
    )
    new_matches = matches[~matches['id'].isin(existing_ids)]
    new_matches.to_sql('matches', conn, if_exists='append', index=False)

    # Inserir times
    team_cols = ['gameid', 'side', 'teamname', 'result',
                 'ban1', 'ban2', 'ban3', 'ban4', 'ban5']
    available_team_cols = [c for c in team_cols if c in teams_df.columns]
    teams = teams_df[available_team_cols].copy()
    teams.rename(columns={'gameid': 'match_id', 'teamname': 'team_name'}, inplace=True)
    teams = teams[teams['match_id'].isin(new_matches['id'])]
    teams.to_sql('match_teams', conn, if_exists='append', index=False)

    # Inserir picks
    pick_cols = ['gameid', 'side', 'position', 'champion', 'kills', 'deaths', 'assists']
    available_pick_cols = [c for c in pick_cols if c in players_df.columns]
    picks = players_df[available_pick_cols].copy()
    picks.rename(columns={'gameid': 'match_id'}, inplace=True)
    picks = picks[picks['match_id'].isin(new_matches['id'])]
    picks.to_sql('match_picks', conn, if_exists='append', index=False)

    conn.close()
    print(f"Ingestão concluída: {len(new_matches)} novas partidas ({len(existing_ids)} já existiam)")
