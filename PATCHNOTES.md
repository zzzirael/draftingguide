# Patch Notes — Draft Simulator Competitivo

Histórico de versões do app. Cada versão corresponde a um commit ou grupo de commits no `master`.

---

## v0.9 — Data Dragon Images + Error Handling
> commit `c149299` — feat: champion images via Data Dragon + analysis error feedback

### Novo
- **Imagens de campeões via Data Dragon**: todos os ícones e artes de loading são buscados do CDN da Riot em runtime — sem assets locais, sem build step
  - `ChampImg.jsx`: componente universal com fallback elegante (iniciais em texto estilizado) caso a imagem não carregue
  - `ddragon.js`: normalização de nomes (Wukong → MonkeyKing, LeBlanc → Leblanc, Bel'Veth → Belveth, etc.)
  - **Pick slots**: arte de loading cinematográfica (1215×717) como background com gradiente overlay — visual semelhante ao cliente oficial do LoL
  - **Ban slots**: ícone 24×24 com grayscale para indicar banimento
  - **ChampionPool**: tiles com ícone 48×48 e hover com elevação dourada
  - **SuggestionPanel**: mini avatares 26×26 nas sugestões e counters, ícone do campeão inimigo no header de cada seção de counter
  - **DraftBoard MatchupBar**: ícone 20×20 por lado em cada matchup de lane
  - **AnalysisScreen**: ícones em slots, dropdown de seleção, sinergias, matrix de counters, matchups e pick order stats
  - **MenuScreen**: ícones no dropdown de busca e nos chips do pool

- **Feedback de erro na Análise de Draft**: a tela de análise agora mostra mensagem clara quando o backend está offline ou retorna erro
  - Antes: tela vazia sem nenhum feedback
  - Agora: banner vermelho com mensagem explicativa (e.g. "Não foi possível conectar ao backend. Certifique-se de que o servidor está rodando na porta 8001.")

### Técnico
- `frontend/src/utils/ddragon.js`: novo utilitário — dict de overrides de nomes, `initDDVersion(v)`, `champIconUrl(name)`, `champLoadingUrl(name)`
- `frontend/src/components/ChampImg.jsx`: novo componente com `onError` fallback
- `App.jsx`: fetch da versão atual do ddragon no `useEffect` inicial (`ddragon.leagueoflegends.com/api/versions.json`)
- `AnalysisScreen.jsx`: `error` state + catch explícito + banner de erro no JSX; empty state condicionado a `!error`

---

## v0.8 — Tela de Análise + Integração Leaguepedia
> commit `pending` — feat: post-game draft analysis screen and Leaguepedia pick order pipeline

### Novo
- **Tela de Análise de Draft** (`⊞ Análise` no menu): tela separada para analisar composições sem ordem de draft, ideal para análise pós-jogo
  - Dois painéis (Azul / Vermelho) com input de campeão + seletor de role por slot
  - Auto-analisa em 350ms após qualquer mudança, sem botão explícito
  - **Win Probability** dos dois lados via modelo ML
  - **Arquétipos** de ambas as comps (Teamfight, Poke, Dive, etc.) com alertas de gap
  - **Matchups de lane** com WR head-to-head quando roles estão atribuídas
  - **Sinergias** — top 6 pares por time (via `synergy_matrix`) com barra de WR
  - **Matrix de Counters** — grid 5×5 com WR de cada campeão azul contra cada vermelho, color-coded (verde = vantagem, vermelho = desvantagem)
  - **Draft Order stats** — quando Leaguepedia estiver populado, mostra WR por slot (Pick 1–5) e first-pick rate por campeão

- **Pipeline Leaguepedia** (`pipeline/fetch_leaguepedia.py`): busca dados de pick order da API Cargo da Leaguepedia (`PicksAndBansS7`) e popula tabela `pick_order_stats`
  - Ativado via `python setup.py --leaguepedia` (separado do setup principal)
  - Dados: champion × pick_slot (1–5) × liga × patch_major → wins/games
  - Paginação automática com rate limiting (1s entre páginas)
  - Nome de ligas extraído da `OverviewPage` (LCK, LPL, LEC, etc.)

### Técnico
- `pipeline/fetch_leaguepedia.py`: novo arquivo — fetch paginado, normalização de nomes, agregação em `pick_order_stats`
- `pipeline/ingest.py`: `init_db` atualizado com schema da `pick_order_stats`
- `setup.py`: flags `--leaguepedia` e `--leaguepedia-from` adicionadas
- `engine/predictor.py`: três novos métodos — `analyze_comp()`, `_get_synergy_pairs()`, `get_pick_order_stats()`
- `api/main.py`: endpoints `POST /analyze-comp` e `GET /draft-stats` adicionados
- `requirements.txt`: `requests` adicionado
- `vite.config.js`: proxy `/analyze-comp` e `/draft-stats` adicionados
- `AnalysisScreen.jsx` + `AnalysisScreen.css`: nova tela completa (~350 linhas)
- `App.jsx`: roteamento para `screen = 'analysis'`
- `MenuScreen.jsx`: botão `⊞ Análise` no rodapé

---

## v0.7 — Perfil do Adversário
> commit `pending` — feat: opponent comp profiling and live pattern detection

### Novo
- **Padrões de composição do adversário no MenuScreen**: na aba do adversário, nova seção "Padrões de Composição" onde o coach cadastra as comps favoritas do time inimigo antes do draft
  - Cada padrão tem: nome (ex: "Dive", "Wombo Combo") + lista de campeões que compõem a comp
  - Campos salvos no `localStorage` junto com o restante do config
- **Alerta em tempo real no SuggestionPanel**: assim que ≥2 picks inimigos batem com um padrão cadastrado, um banner de alerta aparece entre a barra de arquétipo e as sugestões
  - Mostra: nome do padrão, campeões confirmados (`✓` vermelho) e pendentes (`?` cinza), progresso (`2/4`)
  - Pulsa em vermelho quando ativo; intensifica (🚨) quando todos os campeões do padrão foram confirmados
  - Múltiplos alertas simultâneos se mais de um padrão for detectado ao mesmo tempo

### Técnico
- `MenuScreen.jsx`: novo componente `CompSection` com formulário inline (nome + `PoolInput` de campeões); integrado apenas no painel do adversário
- `MenuScreen.css`: estilos para a seção de comps (`.comp-section`, `.comp-item`, `.comp-add-form`, etc.)
- `DraftBoard.jsx`: `oppCompAlerts` useMemo — cruza `enemyPicks` com `seriesConfig.oppTeam.comps`; threshold: ≥2 matches (ou ≥1 para comps com ≤3 campeões)
- `SuggestionPanel.jsx`: novo componente `OppCompAlert`; prop `oppCompAlerts` adicionada; banner renderizado entre `ArchetypeBar` e o corpo das sugestões
- `SuggestionPanel.css`: estilos para o alerta (`.opp-comp-alert`, `.occ-header`, `.occ-confirmed`, `.occ-pending`, animação de pulso)

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
