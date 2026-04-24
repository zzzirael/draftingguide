# Patch Notes — Draft Simulator Competitivo

Histórico de versões do app. Cada versão corresponde a um commit ou grupo de commits no `master`.

---

## v0.6 — Ban Phase Intelligence
> commit `df42708` — feat: ban phase suggestions using counter_matrix

### Novo
- **Sugestões de ban em tempo real**: quando o slot ativo é um ban, a coluna esquerda do painel muda automaticamente para "Sugestões de Ban"
  - **Fase inicial (sem picks aliados)**: mostra os campeões com maior win rate no meta atual, por liga/patch — útil para primeiro ban cego
  - **Com picks aliados**: mostra os campeões que mais conteram os seus picks específicos, rankeados por severidade (WR acima de 50% contra seus picks)
  - Clicável: clicar em uma sugestão aplica o ban no slot ativo
  - Badge `✓ pool` se o campeão banido está no pool do seu time (tático: ele pode ser uma ameaça que seus jogadores também sabem jogar)
- **Endpoint `/matchup`**: novo endpoint GET que retorna WR head-to-head de dois campeões no `counter_matrix`, com fallback de 3 níveis (liga+patch → liga → geral)

### Técnico
- `predictor.py`: `suggest_bans()` usa `counter_matrix` em vez do modelo ML (os `enemy_` features tinham importância zero no LightGBM — o modelo aprendeu apenas quais picks aliados são fortes, não quais inimigos ameaçam)
- `api/main.py`: `ban_suggestions` incluído na resposta do `/suggest-ml`

---

## v0.5 — Lane Matchup Panel + Layout Fix
> commit `2aae439` — fix: scroll layout, add lane matchup panel

### Correções
- **Scroll restaurado**: removido `overflow: hidden` do `.app` e do painel de sugestões — toda a página agora scrolla normalmente pelo browser
- **Sugestões e counters totalmente visíveis**: removido `max-height: 380px; overflow: hidden` do `panel-body` que cortava o conteúdo embaixo
- **Win probability visível**: estava atualizando corretamente, mas ficava fora da tela pelo bug de overflow acima

### Novo
- **Barra de matchups por lane**: aparece entre o draft board e o painel de sugestões quando ambos os lados têm picks na mesma lane com role atribuída
  - Mostra: `🗡 Malphite vs Renekton — 67% ▓▓▓▓░ 33%`
  - Busca WR head-to-head do `counter_matrix` com fallback progressivo
  - Atualiza automaticamente conforme lanes são atribuídas
  - Endpoint: `GET /matchup?champion=X&vs=Y&league=Z&patch_major=W`

### Técnico
- `DraftBoard.jsx`: `MatchupBar` component + `laneMatchups` useMemo + effect de fetch por lane
- `vite.config.js`: proxy `/matchup` adicionado

---

## v0.4 — Pool Highlighting + Archetype Detection
> commit `5ddb5f0` — feat: champion pool highlighting and archetype detection

### Novo
- **Pool highlighting nas sugestões** (`✓` verde): sugestões por lane mostram badge verde quando o campeão está no pool do jogador daquela role — o coach identifica de relance quais sugestões são jogáveis
  - Counters também verificam a união de todos os pools do time
- **Detecção de arquétipo em tempo real** (`ArchetypeBar`): aparece logo abaixo da win bar assim que o time aliado tem ≥ 2 picks
  - Classifica a composição: **Teamfight · Poke · Dive · Pick/Catch · Protect the Carry · Split Push · Engage/CC**
  - Mostra arquétipo primário em cor + tags secundárias com contadores (ex: `⚔ ×3 🎯 ×2`)
  - Alertas de gap com ≥ 3 picks: "Sem engage", "Sem proteção ao carry", "Falta damage em teamfight"

### Técnico
- Novo arquivo `champion-archetypes.js`: banco de tags para ~150 campeões + `detectArchetype(alliedPicks)` — lógica puramente estática/heurística (sem ML), baseada em conhecimento de jogo
- `DraftBoard.jsx`: passa `myTeamPlayers` do `seriesConfig` para o `SuggestionPanel`

---

## v0.3 — Menu Screen, Times e Gestão de Série
> commit `9e92a51` — feat: menu screen, team setup, series format and fearless draft

### Novo
- **MenuScreen** (tela de lobby antes do draft):
  - Seletor de formato: BO1 / BO3 / BO5
  - Toggle Fearless Draft (bloqueia campeões usados em jogos anteriores da série)
  - Seletor de liga e patch para contextualizar o modelo ML
  - Cadastro do time (nome + lado azul/vermelho) com 5 jogadores: nome + pool de campeões por role (tag input com busca)
  - Cadastro do adversário (nome)
  - Configuração salva em `localStorage` entre sessões
- **Gestão de série no DraftBoard**:
  - Barra de série sempre visível: formato, placar ao vivo, jogo atual
  - Barra fearless: mostra campeões travados de jogos anteriores com chips riscados
  - Após draft completo: botões para registrar quem venceu o jogo
  - Avanço automático para próximo jogo: placar atualiza, fearless acumula, draft reseta
  - Banner de fim de série com resultado final
- **ChampionPool**: filtra campeões fearless-locked e exibe contador 🔒

### Técnico
- `App.jsx` reescrito como roteador de 2 telas: `menu` → `draft`
- `App.css` simplificado (header removido, movido para MenuScreen)
- `DraftBoard.jsx`: recebe `seriesConfig` e `seriesState` em vez de props avulsas; `fearlessUsed` adicionado aos banned no payload do `/suggest-ml`

---

## v0.2 — Lane Picker, Counters e Redesign UI
> commit `438fd62` — feat: lane picker, counter suggestions, UI overhaul

### Novo
- **Lane picker por slot de pick**: cada pick tem botões de role (🗡🌲⚡🏹🛡) para indicar a posição do campeão
- **Counter analysis**: seção no painel de sugestões mostrando os melhores picks contra cada campeão inimigo, com fallback de 3 níveis no `counter_matrix` (liga+patch → liga → sem filtro)
- **Sugestões ativas com apenas picks inimigos**: a análise começa assim que o inimigo faz seu primeiro pick, sem precisar de picks aliados
- **Redesign visual completo**: inspirado no estilo do drafter.lol — fundo escuro `#010a13`, paleta dourada `#c8aa6e`, separação clara de azul/vermelho

### Técnico
- `TeamSide.jsx`: lane picker integrado em cada slot de pick
- `SuggestionPanel.jsx`: seção de counter analysis com cards `MiniChamp`
- `engine/predictor.py`: `get_counter_suggestions()` com `_counter_from_matrix()` e fallback chain

---

## v0.1 — ML Pipeline + Draft Interativo Base
> commits `6f7900a`, `4875b6e`, `f940d48`, `349d3d2`

### Fundação
- **Banco de dados SQLite** (`data/lol.db`): ingestão de CSVs do Oracle's Elixir (2024/2025/2026) — 23.624 partidas, 67 ligas, 172 campeões, patches 13.24 → 16.08
- **Modelo LightGBM**: treinado com ~383 features (picks aliados/inimigos por campeão, lado, liga, patch, playoffs); temporal train/test split no percentil 85; patch weighting exponencial (`λ=0.3`)
- **Draft interativo de 20 passos**: ordem real de campeonato competitivo (Ban1 × 6 → Pick1 × 6 → Ban2 × 4 → Pick2 × 4)
- **Barra de win probability**: atualiza a cada ação, mostra % azul vs vermelho
- **Sugestões por lane**: top-N picks por posição com delta de WP (`+X%`)
- **`synergy_matrix` e `counter_matrix`**: pré-computadas no pipeline, segmentadas por liga e patch
- **API FastAPI** (`/suggest-ml`, `/suggest`, `/leagues`, `/patches`, `/champions`, `/stats`, `/health`) na porta 8001
- **Frontend React + Vite** na porta 3000 com proxy reverso para o backend
- **`setup.py`**: orquestra ingest + build_matrices + train em sequência (~10 min)

---

## Stack Atual

| Camada | Tecnologia |
|---|---|
| Banco | SQLite — `data/lol.db` (42 MB) |
| ML | LightGBM — `data/model.joblib` |
| Backend | FastAPI + Uvicorn (porta 8001) |
| Frontend | React 18 + Vite 5 (porta 3000) |
| Dados | Oracle's Elixir CSVs 2024/2025/2026 |
| Persistência | `localStorage` (config do usuário) |
