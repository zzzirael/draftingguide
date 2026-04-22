"""
Detecta o CSV em data/raw/, ingere e calcula as matrizes.
Uso: python setup.py
"""
import os
import sys
import glob

RAW_DIR = "data/raw"
DB_PATH = "data/lol.db"


def find_csv():
    csvs = glob.glob(os.path.join(RAW_DIR, "*.csv"))
    if not csvs:
        print(f"Nenhum CSV encontrado em {RAW_DIR}/")
        print("Baixe o arquivo em: https://oracleselixir.com/tools/downloads")
        print(f"E coloque em: {os.path.abspath(RAW_DIR)}/")
        sys.exit(1)
    if len(csvs) > 1:
        print("Múltiplos CSVs encontrados. Usando o mais recente:")
        csvs.sort(key=os.path.getmtime, reverse=True)
    chosen = csvs[0]
    print(f"CSV encontrado: {chosen}")
    return chosen


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs("data", exist_ok=True)

    csv_path = find_csv()

    print("\n[1/3] Ingerindo dados no banco...")
    from pipeline.ingest import load_oracleselixir
    load_oracleselixir(csv_path, DB_PATH)

    print("\n[2/3] Calculando matriz de sinergia...")
    from pipeline.build_matrices import build_synergy_matrix
    build_synergy_matrix(DB_PATH)

    print("\n[3/3] Calculando matriz de counter...")
    from pipeline.build_matrices import build_counter_matrix
    build_counter_matrix(DB_PATH)

    print("\nSetup concluído! Para subir a API:")
    print("  uvicorn api.main:app --reload")
    print("\nPara o frontend (em outro terminal):")
    print("  cd frontend && npm install && npm run dev")


if __name__ == "__main__":
    main()
