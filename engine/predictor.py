import numpy as np
import joblib
import os
from dataclasses import dataclass, field
from typing import Optional

from pipeline.build_features import load_metadata

MODEL_PATH    = "data/model.joblib"
METADATA_PATH = "data/model_metadata.json"


@dataclass
class DraftState:
    allied_picks:  list[str] = field(default_factory=list)
    enemy_picks:   list[str] = field(default_factory=list)
    banned:        list[str] = field(default_factory=list)
    side:          str = 'blue'           # 'blue' | 'red'
    league:        Optional[str] = None
    patch_major:   Optional[str] = None
    is_playoffs:   bool = False


class DraftPredictor:
    def __init__(self):
        self.model    = joblib.load(MODEL_PATH)
        self.metadata = load_metadata(METADATA_PATH)
        self._champ_set    = set(self.metadata['champions'])
        self._league_set   = set(self.metadata['leagues'])
        self._feature_cols = self.metadata['feature_columns']

    def _build_feature_vector(self, state: DraftState, candidate: Optional[str] = None) -> np.ndarray:
        allied = list(state.allied_picks)
        if candidate:
            allied = allied + [candidate]

        enemy = list(state.enemy_picks)

        ally_set  = set(allied)
        enemy_set = set(enemy)

        row = {}
        for champ in self.metadata['champions']:
            row[f'ally_{champ}']  = 1 if champ in ally_set  else 0
            row[f'enemy_{champ}'] = 1 if champ in enemy_set else 0

        row['side_blue']     = 1 if state.side == 'blue' else 0
        row['is_playoffs']   = int(state.is_playoffs)
        row['n_ally_picks']  = len(ally_set)
        row['n_enemy_picks'] = len(enemy_set)

        if state.patch_major:
            try:
                parts = str(state.patch_major).split('.')
                row['patch_numeric'] = float(f"{parts[0]}.{parts[1].zfill(2)}")
            except Exception:
                row['patch_numeric'] = 0.0
        else:
            row['patch_numeric'] = 0.0

        for lg in self.metadata['leagues']:
            row[f'league_{lg}'] = 1 if state.league == lg else 0

        return np.array([row.get(col, 0) for col in self._feature_cols], dtype=np.float32)

    def predict_win_probability(self, state: DraftState) -> float:
        if not state.allied_picks:
            return 0.5
        vec = self._build_feature_vector(state)
        prob = self.model.predict_proba(vec.reshape(1, -1))[0][1]
        return round(float(prob), 4)

    def suggest_picks(
        self,
        available_champions: list[str],
        state: DraftState,
        top_n: int = 10,
    ) -> list[dict]:
        base_prob = self.predict_win_probability(state)

        candidates = [
            c for c in available_champions
            if c not in state.banned
            and c not in state.allied_picks
            and c not in state.enemy_picks
            and c in self._champ_set
        ]

        results = []
        for champ in candidates:
            vec  = self._build_feature_vector(state, candidate=champ)
            prob = float(self.model.predict_proba(vec.reshape(1, -1))[0][1])
            results.append({
                'champion':         champ,
                'win_probability':  round(prob, 4),
                'delta':            round(prob - base_prob, 4),
            })

        results.sort(key=lambda x: x['win_probability'], reverse=True)

        for i, r in enumerate(results[:top_n]):
            r['rank'] = i + 1

        return results[:top_n]


_predictor_instance: Optional[DraftPredictor] = None


def get_predictor() -> Optional[DraftPredictor]:
    global _predictor_instance
    if _predictor_instance is None and os.path.exists(MODEL_PATH):
        _predictor_instance = DraftPredictor()
    return _predictor_instance
