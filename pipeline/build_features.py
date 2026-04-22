import sqlite3
import numpy as np
import pandas as pd
import json
import os


def _parse_patch_numeric(patch_str: str) -> float:
    try:
        parts = str(patch_str).split('.')
        return float(f"{parts[0]}.{parts[1].zfill(2)}")
    except Exception:
        return 0.0


def build_training_data(db_path: str) -> tuple:
    conn = sqlite3.connect(db_path)

    picks_df = pd.read_sql("""
        SELECT mp.match_id, mp.side, mp.champion,
               mt.result,
               m.league, m.patch_major, m.is_playoffs
        FROM match_picks mp
        JOIN match_teams mt ON mp.match_id = mt.match_id AND mp.side = mt.side
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.champion IS NOT NULL AND mp.champion != ''
    """, conn)
    conn.close()

    all_champions = sorted(picks_df['champion'].unique().tolist())
    all_leagues   = sorted(picks_df['league'].unique().tolist())
    champ_set     = set(all_champions)

    rows = []
    grouped = picks_df.groupby(['match_id', 'side'])

    for (match_id, side), group in grouped:
        ally_champs = [c for c in group['champion'].tolist() if c in champ_set]
        if len(ally_champs) < 5:
            continue

        result     = int(group['result'].iloc[0])
        league     = group['league'].iloc[0]
        patch_major = group['patch_major'].iloc[0]
        is_playoffs = int(group['is_playoffs'].iloc[0]) if pd.notna(group['is_playoffs'].iloc[0]) else 0

        enemy_side  = 'red' if side == 'blue' else 'blue'
        enemy_group = picks_df[(picks_df['match_id'] == match_id) & (picks_df['side'] == enemy_side)]
        enemy_champs = [c for c in enemy_group['champion'].tolist() if c in champ_set]

        ally_set  = set(ally_champs)
        enemy_set = set(enemy_champs)

        row = {}
        for champ in all_champions:
            row[f'ally_{champ}'] = 1 if champ in ally_set  else 0
            row[f'enemy_{champ}'] = 1 if champ in enemy_set else 0

        row['side_blue']    = 1 if side == 'blue' else 0
        row['is_playoffs']  = is_playoffs
        row['n_ally_picks'] = len(ally_set)
        row['n_enemy_picks'] = len(enemy_set)
        row['patch_numeric'] = _parse_patch_numeric(patch_major)

        for lg in all_leagues:
            row[f'league_{lg}'] = 1 if league == lg else 0

        row['result']        = result
        row['_patch_major']  = patch_major

        rows.append(row)

    df = pd.DataFrame(rows)

    feature_cols = [c for c in df.columns if not c.startswith('_') and c != 'result']

    metadata = {
        'champions':       all_champions,
        'leagues':         all_leagues,
        'feature_columns': feature_cols,
    }

    print(f"Feature matrix: {len(df)} amostras × {len(feature_cols)} features")
    return df, metadata


def compute_patch_weights(patch_series: pd.Series, lambda_decay: float = 0.3) -> np.ndarray:
    numeric = patch_series.apply(_parse_patch_numeric)
    max_patch = numeric.max()
    distances = max_patch - numeric
    weights = np.exp(-lambda_decay * distances)
    return weights.values


def save_metadata(metadata: dict, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(metadata, f)


def load_metadata(path: str) -> dict:
    with open(path) as f:
        return json.load(f)
