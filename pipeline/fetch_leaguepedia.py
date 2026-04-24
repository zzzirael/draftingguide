"""
Busca dados de draft order da Leaguepedia Cargo API e popula pick_order_stats.

Uso:
    python -m pipeline.fetch_leaguepedia
    python -m pipeline.fetch_leaguepedia --from-date 2024-01-01 --db data/lol.db

A tabela pick_order_stats registra, para cada campeão, em qual slot de draft
(1=primeiro pick do time, 5=último) ele foi selecionado e se o time ganhou.
Isso permite calcular first-pick rate, win rate por posição de draft, etc.
"""
import sqlite3
import time
import argparse
from collections import defaultdict

try:
    import requests
except ImportError:
    raise ImportError("requests não instalado. Execute: pip install requests")

API_URL = "https://lol.fandom.com/api.php"
DB_PATH = "data/lol.db"

# Campos para buscar na PicksAndBansS7
FIELDS = (
    "Team1,Team2,Winner,Blue,"
    "Team1Pick1,Team1Pick2,Team1Pick3,Team1Pick4,Team1Pick5,"
    "Team2Pick1,Team2Pick2,Team2Pick3,Team2Pick4,Team2Pick5,"
    "Patch,OverviewPage,DateTime_UTC"
)

# Normalização de nomes conhecidos (Leaguepedia → Oracle's Elixir)
NAME_MAP = {
    "Nunu & Willump": "Nunu & Willump",
    "Renata Glasc":   "Renata Glasc",
    "K'Sante":        "K'Sante",
    "Wukong":         "Wukong",
    "LeBlanc":        "LeBlanc",
}


def normalize_name(name: str) -> str:
    if not name or not name.strip():
        return ""
    n = name.strip()
    return NAME_MAP.get(n, n)


def _extract_league(overview_page: str) -> str:
    """Extrai o identificador de liga da OverviewPage (ex: 'LCK/2025 Season/Spring')."""
    if not overview_page:
        return ""
    first = overview_page.split("/")[0].strip().upper()
    for key in ["LCK", "LPL", "LEC", "LCS", "MSI", "WORLDS", "CBLOL", "VCS", "TCL", "PCS", "LJL"]:
        if key in first:
            return key
    return first[:10]  # fallback: primeiros 10 chars do nome


def _parse_patch_major(patch: str) -> str:
    """Normaliza patch para formato XX.YY (ex: '15.1' → '15.01')."""
    if not patch:
        return ""
    parts = patch.strip().split(".")
    if len(parts) >= 2:
        try:
            return f"{int(parts[0])}.{int(parts[1]):02d}"
        except ValueError:
            pass
    return patch.strip()[:10]


def fetch_page(offset: int, from_date: str, limit: int = 500) -> list[dict]:
    params = {
        "action":   "cargoquery",
        "tables":   "PicksAndBansS7",
        "fields":   FIELDS,
        "where":    f"DateTime_UTC > '{from_date}'",
        "order_by": "DateTime_UTC ASC",
        "limit":    limit,
        "offset":   offset,
        "format":   "json",
    }
    resp = requests.get(API_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Leaguepedia API error: {data['error']}")
    return [item["title"] for item in data.get("cargoquery", [])]


def build_pick_order_stats(db_path: str = DB_PATH, from_date: str = "2024-01-01"):
    """
    Faz a ingestão de PicksAndBansS7 e escreve na tabela pick_order_stats.
    """
    # Garante que a tabela existe
    conn = sqlite3.connect(db_path)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS pick_order_stats (
            champion    TEXT NOT NULL,
            pick_slot   INTEGER NOT NULL,
            league      TEXT NOT NULL DEFAULT '',
            patch_major TEXT NOT NULL DEFAULT '',
            wins        INTEGER DEFAULT 0,
            games       INTEGER DEFAULT 0,
            PRIMARY KEY (champion, pick_slot, league, patch_major)
        );
    """)
    conn.close()

    # Paginação
    all_rows: list[dict] = []
    offset = 0
    limit  = 500
    print(f"[Leaguepedia] Buscando PicksAndBansS7 a partir de {from_date}...")

    while True:
        try:
            page = fetch_page(offset, from_date, limit)
        except Exception as e:
            print(f"  Erro na página offset={offset}: {e}")
            break
        if not page:
            break
        all_rows.extend(page)
        print(f"  {len(all_rows)} partidas coletadas...")
        if len(page) < limit:
            break
        offset += limit
        time.sleep(1.0)  # respeitar rate limit

    print(f"[Leaguepedia] Total: {len(all_rows)} partidas")
    if not all_rows:
        print("  Nenhum dado retornado — verifique a conexão ou tente mais tarde.")
        return

    # Agrega estatísticas
    # key → (champion, pick_slot, league, patch_major) : [wins, games]
    stats: dict[tuple, list] = defaultdict(lambda: [0, 0])

    skipped = 0
    for row in all_rows:
        try:
            winner    = (row.get("Winner") or "").strip()
            blue_team = (row.get("Blue")   or "").strip()
            team1     = (row.get("Team1")  or "").strip()
            team2     = (row.get("Team2")  or "").strip()

            if not (team1 and team2):
                skipped += 1
                continue

            patch_major = _parse_patch_major(row.get("Patch") or "")
            league      = _extract_league(row.get("OverviewPage") or "")

            # Determina quem é blue/red e quem ganhou
            if blue_team == team1 or not blue_team:
                # Team1 = blue, Team2 = red (padrão se Blue ausente)
                blue_pick_keys = [f"Team1Pick{i}" for i in range(1, 6)]
                red_pick_keys  = [f"Team2Pick{i}" for i in range(1, 6)]
                blue_won = winner in ("1", team1)
            else:
                # Team2 = blue
                blue_pick_keys = [f"Team2Pick{i}" for i in range(1, 6)]
                red_pick_keys  = [f"Team1Pick{i}" for i in range(1, 6)]
                blue_won = winner in ("2", team2)

            red_won = not blue_won

            for slot_idx, key in enumerate(blue_pick_keys, start=1):
                champ = normalize_name(row.get(key) or "")
                if not champ:
                    continue
                k = (champ, slot_idx, league, patch_major)
                stats[k][0] += int(blue_won)
                stats[k][1] += 1

            for slot_idx, key in enumerate(red_pick_keys, start=1):
                champ = normalize_name(row.get(key) or "")
                if not champ:
                    continue
                k = (champ, slot_idx, league, patch_major)
                stats[k][0] += int(red_won)
                stats[k][1] += 1

        except Exception:
            skipped += 1
            continue

    if skipped:
        print(f"  {skipped} linhas ignoradas (dados incompletos)")

    # Grava no banco
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM pick_order_stats")
    rows_to_insert = [
        (champ, slot, league, pm, wins, games)
        for (champ, slot, league, pm), (wins, games) in stats.items()
    ]
    conn.executemany(
        "INSERT OR REPLACE INTO pick_order_stats "
        "(champion, pick_slot, league, patch_major, wins, games) VALUES (?,?,?,?,?,?)",
        rows_to_insert,
    )
    conn.commit()
    conn.close()
    print(f"[Leaguepedia] pick_order_stats: {len(rows_to_insert)} linhas gravadas")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-date", default="2024-01-01", help="Data mínima (YYYY-MM-DD)")
    parser.add_argument("--db",        default=DB_PATH,       help="Caminho do banco SQLite")
    args = parser.parse_args()
    build_pick_order_stats(db_path=args.db, from_date=args.from_date)
