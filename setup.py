"""
Detecta CSVs em data/raw/, ingere, calcula matrizes e treina o modelo ML.
Uso: python setup.py [--skip-ingest] [--skip-train]
"""
import os, sys, glob, argparse

RAW_DIR    = "data/raw"
DB_PATH    = "data/lol.db"
MODEL_PATH = "data/model.joblib"


def find_csvs():
    csvs = sorted(glob.glob(os.path.join(RAW_DIR, "*.csv")))
    if not csvs:
        print(f"Nenhum CSV encontrado em {RAW_DIR}/")
        print("Baixe os arquivos em: https://oracleselixir.com/tools/downloads")
        print(f"E coloque em: {os.path.abspath(RAW_DIR)}/")
        sys.exit(1)
    return csvs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-ingest',    action='store_true')
    parser.add_argument('--skip-train',     action='store_true')
    parser.add_argument('--leaguepedia',    action='store_true',
                        help='Busca dados de draft order da Leaguepedia (requer internet)')
    parser.add_argument('--leaguepedia-from', default='2024-01-01',
                        help='Data mínima para buscar da Leaguepedia (padrão: 2024-01-01)')
    parser.add_argument('--lambda-decay', type=float, default=0.3,
                        help='Decaimento exponencial por patch (padrão 0.3)')
    args = parser.parse_args()

    os.makedirs(RAW_DIR,  exist_ok=True)
    os.makedirs("data",   exist_ok=True)

    # ── Ingestão ──────────────────────────────────────────────────────────────
    if not args.skip_ingest:
        csvs = find_csvs()
        from pipeline.ingest import load_oracleselixir
        for csv_path in csvs:
            print(f"\n[Ingestão] {csv_path}")
            load_oracleselixir(csv_path, DB_PATH)

        print("\n[Matrizes] Calculando sinergia e counter...")
        from pipeline.build_matrices import build_synergy_matrix, build_counter_matrix
        build_synergy_matrix(DB_PATH)
        build_counter_matrix(DB_PATH)

    # ── Leaguepedia pick order data ───────────────────────────────────────────
    if args.leaguepedia:
        print("\n[Leaguepedia] Buscando dados de pick order...")
        from pipeline.fetch_leaguepedia import build_pick_order_stats
        build_pick_order_stats(DB_PATH, from_date=args.leaguepedia_from)

    # ── Treino ML ─────────────────────────────────────────────────────────────
    if not args.skip_train:
        print("\n[ML] Treinando modelo LightGBM com patch weighting...")
        from pipeline.train_model import train
        train(DB_PATH, lambda_decay=args.lambda_decay)

    print("\nSetup concluido!")
    print("  Leaguepedia: python setup.py --skip-ingest --skip-train --leaguepedia")
    print("  API:         uvicorn api.main:app --port 8001")
    print("  Frontend:    cd frontend && npm run dev")


if __name__ == "__main__":
    main()
