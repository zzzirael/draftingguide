"""Cria o banco de dados SQLite com o schema completo, sem dados."""
from pipeline.ingest import init_db
import os

DB_PATH = "data/lol.db"
os.makedirs("data", exist_ok=True)
init_db(DB_PATH)
print(f"Banco criado em {DB_PATH}")
