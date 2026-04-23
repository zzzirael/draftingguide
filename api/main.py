import sqlite3
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from engine.scorer import suggest_picks, DraftState as ScorerState
from engine.predictor import get_predictor, DraftState as PredictorState

app = FastAPI(title="LoL Competitive Draft Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "data/lol.db"


class DraftRequest(BaseModel):
    allied_picks:        list[str] = []
    enemy_picks:         list[str] = []
    banned:              list[str] = []
    available_champions: list[str] = []
    side:                str = 'blue'
    league:              Optional[str] = None
    patch_major:         Optional[str] = None
    is_playoffs:         bool = False
    top_n:               int = 10
    active_position:     Optional[str] = None   # top|jng|mid|bot|sup — lane do slot ativo


# ── Endpoints básicos ────────────────────────────────────────────────────────

@app.get("/health")
def health():
    predictor = get_predictor()
    return {"status": "ok", "ml_model_loaded": predictor is not None}


@app.get("/leagues")
def list_leagues():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT DISTINCT league FROM matches ORDER BY league").fetchall()
    conn.close()
    return {"leagues": [r[0] for r in rows]}


@app.get("/patches")
def list_patches():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT DISTINCT patch_major FROM matches ORDER BY patch_major DESC"
    ).fetchall()
    conn.close()
    return {"patches": [r[0] for r in rows]}


@app.get("/champions")
def list_champions():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT DISTINCT champion FROM match_picks WHERE champion IS NOT NULL ORDER BY champion"
    ).fetchall()
    conn.close()
    return {"champions": [r[0] for r in rows]}


@app.get("/stats/{champion}")
def champion_stats(champion: str, league: Optional[str] = None, patch_major: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    clauses = ["champion = ?"]
    params  = [champion]
    if league:      clauses.append("league = ?");       params.append(league)
    if patch_major: clauses.append("patch_major = ?");  params.append(patch_major)
    where = " AND ".join(clauses)
    row = conn.execute(
        f"SELECT SUM(wins), SUM(games) FROM counter_matrix WHERE {where}", params
    ).fetchone()
    conn.close()
    total_wins  = row[0] or 0
    total_games = row[1] or 0
    return {
        "champion": champion,
        "games":    total_games,
        "wins":     total_wins,
        "winrate":  round(total_wins / total_games, 4) if total_games else None,
    }


# ── Endpoint legado ──────────────────────────────────────────────────────────

@app.post("/suggest")
def suggest(req: DraftRequest):
    state = ScorerState(
        allied_picks=req.allied_picks,
        enemy_picks=req.enemy_picks,
        banned=req.banned,
        league=req.league,
        patch_major=req.patch_major,
    )
    available = req.available_champions or _all_champions()
    return {"suggestions": suggest_picks(available, state, DB_PATH, top_n=req.top_n)}


# ── Endpoint ML principal ─────────────────────────────────────────────────────

@app.post("/suggest-ml")
def suggest_ml(req: DraftRequest):
    predictor = get_predictor()
    if predictor is None:
        raise HTTPException(status_code=503, detail="Modelo ML não encontrado. Execute python setup.py primeiro.")

    state = PredictorState(
        allied_picks=req.allied_picks,
        enemy_picks=req.enemy_picks,
        banned=req.banned,
        side=req.side,
        league=req.league,
        patch_major=req.patch_major,
        is_playoffs=req.is_playoffs,
    )

    available     = req.available_champions or _all_champions()
    current_prob  = predictor.predict_win_probability(state)

    # Sugestões flat (top N)
    suggestions = predictor.suggest_picks(available, state, top_n=req.top_n)

    # Sugestões agrupadas por lane
    by_lane = predictor.suggest_by_lane(available, state, top_per_lane=3)

    # Counter analysis para cada pick inimigo
    counter_analysis = []
    for enemy_champ in req.enemy_picks:
        counters = predictor.get_counter_suggestions(enemy_champ, available, state, top_n=4)
        if counters:
            counter_analysis.append({
                "vs":        enemy_champ,
                "best_picks": counters,
            })

    return {
        "current_win_probability": current_prob,
        "active_position":         req.active_position,
        "suggestions":             suggestions,
        "by_lane":                 by_lane,
        "counter_analysis":        counter_analysis,
    }


@app.get("/matchup")
def matchup_winrate(
    champion:    str,
    vs:          str,
    league:      Optional[str] = None,
    patch_major: Optional[str] = None,
):
    predictor = get_predictor()
    if predictor is None:
        return {"win_rate": None, "games": 0}
    return predictor.get_matchup_winrate(champion, vs, league, patch_major)


@app.post("/win-probability")
def win_probability(req: DraftRequest):
    predictor = get_predictor()
    if predictor is None:
        raise HTTPException(status_code=503, detail="Modelo ML não carregado.")
    state = PredictorState(
        allied_picks=req.allied_picks,
        enemy_picks=req.enemy_picks,
        banned=req.banned,
        side=req.side,
        league=req.league,
        patch_major=req.patch_major,
        is_playoffs=req.is_playoffs,
    )
    prob = predictor.predict_win_probability(state)
    return {"win_probability": prob, "loss_probability": round(1 - prob, 4)}


# ── Helper ────────────────────────────────────────────────────────────────────

def _all_champions() -> list[str]:
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute(
            "SELECT DISTINCT champion FROM match_picks WHERE champion IS NOT NULL"
        ).fetchall()
        conn.close()
        return [r[0] for r in rows]
    except Exception:
        return []
