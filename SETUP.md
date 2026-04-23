# Guia de Configuração — LoL Draft Simulator

Este guia explica como configurar e rodar o projeto em uma máquina nova, do zero.

---

## Pré-requisitos

Antes de começar, certifique-se de que as seguintes ferramentas estão instaladas:

| Ferramenta | Versão mínima | Como verificar |
|---|---|---|
| Python | 3.10+ | `python --version` |
| pip | 22+ | `pip --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| git | qualquer | `git --version` |

### Instalação das ferramentas (caso necessário)

- **Python**: https://www.python.org/downloads/ — marque "Add Python to PATH" durante a instalação no Windows
- **Node.js** (inclui npm): https://nodejs.org/en/download — use o instalador LTS
- **git**: https://git-scm.com/downloads

---

## Passo a passo

### 1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd lol-draft-sim
```

### 2. Instalar dependências Python

```bash
pip install -r requirements.txt
```

> **Dica**: se quiser isolar o ambiente, use um virtualenv antes:
> ```bash
> python -m venv .venv
> # Linux/macOS:
> source .venv/bin/activate
> # Windows:
> .venv\Scripts\activate
> pip install -r requirements.txt
> ```

### 3. Baixar os dados do Oracle's Elixir

Os dados de partidas profissionais **não estão no repositório** (arquivos grandes, atualizados frequentemente). Você precisa baixá-los manualmente:

1. Acesse: **https://oracleselixir.com/tools/downloads**
2. Baixe o CSV de partidas do ano desejado (ex.: `2024_LoL_esports_match_data_from_OraclesElixir.csv`)
3. Coloque o arquivo na pasta `data/raw/`:

```
lol-draft-sim/
└── data/
    └── raw/
        └── 2024_LoL_esports_match_data_from_OraclesElixir.csv
```

> O arquivo pode ter nome diferente dependendo do período. O que importa é que esteja dentro de `data/raw/`.

### 4. Estrutura de pastas esperada

Após o clone e o download dos dados, a estrutura deve ser:

```
lol-draft-sim/
├── data/
│   ├── raw/                          ← CSVs do Oracle's Elixir (você coloca aqui)
│   └── lol.db                        ← gerado automaticamente pelo setup.py
├── pipeline/
│   ├── ingest.py
│   └── build_matrices.py
├── engine/
│   └── scorer.py
├── api/
│   └── main.py
├── frontend/
│   ├── src/
│   └── package.json
├── requirements.txt
├── setup.py
├── SETUP.md
└── MATH.md
```

### 5. Inicializar o banco de dados

O script `setup.py` automatiza a ingestão dos CSVs e o cálculo das matrizes de sinergia e counter:

```bash
python setup.py
```

Esse script vai:
- Criar o banco `data/lol.db` (SQLite)
- Ler todos os CSVs em `data/raw/`
- Popular as tabelas `matches`, `match_teams` e `match_picks`
- Calcular a `synergy_matrix` e a `counter_matrix`

> Este processo pode demorar alguns minutos dependendo do tamanho do CSV e do hardware da máquina.

Caso prefira rodar cada etapa separadamente:

```bash
# Apenas ingestão
python -c "
from pipeline.ingest import load_oracleselixir
load_oracleselixir('data/raw/2024_LoL_esports_match_data_from_OraclesElixir.csv', 'data/lol.db')
"

# Apenas matrizes
python -c "
from pipeline.build_matrices import build_synergy_matrix, build_counter_matrix
build_synergy_matrix('data/lol.db')
build_counter_matrix('data/lol.db')
"
```

### 6. Subir a API

```bash
# SEM --reload (evita travamento no Windows com o modelo LightGBM grande)
uvicorn api.main:app --port 8001
```

A API estará disponível em: **http://localhost:8001**

Documentação interativa (Swagger): **http://localhost:8001/docs**

### 7. Instalar dependências do frontend

```bash
cd frontend
npm install
```

### 8. Rodar o frontend

```bash
npm run dev
```

O frontend estará disponível em: **http://localhost:3000** (ou na porta indicada no terminal)

---

## Como acessar

| Serviço | Endereço |
|---|---|
| API REST | http://localhost:8001 |
| Documentação da API (Swagger) | http://localhost:8001/docs |
| Frontend React | http://localhost:3000 |

### Teste rápido da API

```bash
curl -X POST http://localhost:8001/suggest-ml \
  -H "Content-Type: application/json" \
  -d '{
    "allied_picks": ["Orianna", "Vi"],
    "enemy_picks": ["Zed"],
    "banned": ["Jinx"],
    "available_champions": ["Azir", "Viktor", "Syndra", "Jayce", "Corki"],
    "league": "LCK",
    "patch_major": "14.10"
  }'
```

---

## O que NÃO está no git (e por quê)

Os seguintes arquivos e pastas são ignorados pelo `.gitignore` intencionalmente:

| Item | Motivo |
|---|---|
| `data/raw/` | CSVs chegam a centenas de MB e são atualizados pelo Oracle's Elixir. Distribuir via git seria inviável e desnecessário — cada pessoa baixa a versão mais recente diretamente. |
| `data/lol.db` | Banco gerado automaticamente a partir dos CSVs. Não faz sentido versionar um artefato gerado; ele deve ser regenerado localmente. |
| `model.joblib` | Modelo treinado serializado. Arquivos de modelo podem ser grandes (dezenas de MB) e ficam desatualizados a cada retreinamento. O correto é gerá-lo localmente ou usar um sistema de model registry separado. |
| `.venv/` | Ambiente virtual Python — gerado localmente e dependente do SO. |
| `node_modules/` | Dependências do Node.js — instaladas via `npm install`. |

---

## Solução de problemas comuns

### `npm` não encontrado no Windows

**Sintoma**: ao rodar `npm install`, o terminal retorna `'npm' is not recognized as an internal or external command`.

**Solução**:
1. Verifique se o Node.js está instalado: https://nodejs.org/en/download
2. Após instalar, **feche e reabra o terminal** para que o PATH seja atualizado
3. Se ainda não funcionar, adicione manualmente o diretório do Node ao PATH do sistema:
   - Painel de Controle → Sistema → Variáveis de Ambiente → PATH → adicione `C:\Program Files\nodejs\`

---

### Erro de encoding ao ler o CSV

**Sintoma**: `UnicodeDecodeError: 'utf-8' codec can't decode byte...`

**Solução**: o CSV do Oracle's Elixir às vezes é salvo com encoding `latin-1`. Edite a chamada em `pipeline/ingest.py`:

```python
df = pd.read_csv(csv_path, low_memory=False, encoding='latin-1')
```

Ou tente `encoding='cp1252'` se `latin-1` não resolver.

---

### Banco não carregado / tabelas vazias

**Sintoma**: a API retorna listas vazias ou erros de "no such table".

**Solução**: o `setup.py` ainda não foi executado, ou foi interrompido antes de terminar. Rode novamente:

```bash
python setup.py
```

Verifique se o arquivo `data/lol.db` foi criado e se tem tamanho maior que zero:

```bash
# Linux/macOS
ls -lh data/lol.db

# Windows (PowerShell)
Get-Item data\lol.db | Select-Object Length
```

---

### Modelo não carregado (`model.joblib` ausente)

**Sintoma**: erro ao iniciar a API mencionando `model.joblib` não encontrado.

**Solução**: o modelo precisa ser treinado localmente após a ingestão dos dados. Consulte a documentação de treinamento ou rode o script de treinamento disponível em `engine/`. O arquivo `model.joblib` não está no repositório porque é um artefato gerado — veja a seção anterior para entender o motivo.

---

### Porta 8001 já em uso

**Sintoma**: `[ERROR] Address already in use`.

**Solução**: no Windows, processos anteriores podem manter a porta em TIME_WAIT. Feche o terminal onde o uvicorn estava rodando e aguarde ~30 segundos, ou reinicie o computador. Evite usar `--reload` — o modelo LightGBM é grande e o reload trava no Windows.

---

### `ModuleNotFoundError` ao importar módulos do projeto

**Sintoma**: `ModuleNotFoundError: No module named 'pipeline'` ou similar.

**Solução**: certifique-se de estar rodando os comandos a partir da raiz do projeto (`lol-draft-sim/`), não de dentro de uma subpasta. O Python precisa enxergar os módulos `pipeline/`, `engine/` e `api/` como pacotes no diretório atual.

```bash
# Correto — rode da raiz:
cd lol-draft-sim
python setup.py

# Errado — não rode de dentro de uma subpasta:
cd lol-draft-sim/pipeline
python ingest.py
```
