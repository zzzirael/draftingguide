# A Matemática do Draft Simulator

Este documento explica como o sistema transforma dados brutos de partidas profissionais em sugestões de picks e bans. A ideia é ser acessível tanto para quem tem base matemática quanto para quem quer apenas entender a lógica por trás das recomendações.

---

## 1. Visão geral da pipeline

```
Dados brutos          Feature Engineering       Modelo ML
(CSVs Oracle's  →    (vetores numéricos   →   (LightGBM  →   Probabilidade   →   Sugestões
 Elixir)              por partida)              treinado)      de vitória           rankeadas
```

Em palavras:

1. **Dados brutos**: cada linha do CSV representa um jogador em uma partida. Depois do processamento, agrupamos por partida e time.
2. **Feature Engineering**: transformamos o estado do draft (quais campeões foram escolhidos, em qual lado, em qual liga, etc.) num vetor numérico que o modelo consegue entender.
3. **Modelo LightGBM**: recebe esse vetor e devolve uma probabilidade estimada de vitória para aquela composição naquele contexto.
4. **Sistema de sugestões por delta**: para cada campeão candidato, calculamos o quanto a probabilidade de vitória aumenta se ele for adicionado à composição. O ranking final é por esse delta.

---

## 2. Dados disponíveis

### 2.1 Cobertura atual do banco

| Métrica | Valor |
|---|---|
| Partidas totais | 23.624 |
| Ligas distintas | 67 (LPL, LCK, LEC, LCS, CBLOL, EM, VCS, PCS, LJL, e +57 outras) |
| Patches cobertos | 13.24 → 16.08 (temporadas 2024, 2025 e 2026) |
| Campeões únicos | 172 |
| Picks registrados | 236.240 |
| Pares de sinergia | 341.553 (5.748 com ≥5 partidas) |
| Pares de counter | 166.254 (3.767 com ≥5 partidas; 14.508 com ≥3) |

### 2.2 Por que a maioria dos pares tem poucas partidas?

No cenário competitivo, o meta é restrito: poucos campeões dominam cada patch. A `counter_matrix` tem 166K linhas, mas 98% têm menos de 5 partidas registradas para aquele par (liga, patch) específico. Por isso o sistema usa um **fallback progressivo** na consulta de counters (detalhado na seção 7).

---

## 3. Feature Engineering

### 3.1 Vetores binários de campeões

O banco tem 172 campeões jogados no cenário competitivo. Para representar "quais campeões estão na composição aliada" criamos um vetor binário de dimensão 172:

```
Vetor aliado = [0, 0, 1, 0, 1, 0, ..., 1, 0]
                           ↑         ↑         ↑
                       Orianna      Vi      (outro)
```

- Posição i = 1 se o campeão i foi escolhido pela equipe aliada
- Posição i = 0 caso contrário

O mesmo vale para os inimigos:

```
Vetor inimigo = [0, 1, 0, 0, 0, ..., 0, 0]
                      ↑
                     Zed
```

Esses dois vetores sozinhos já capturam "quem está jogando contra quem".

### 3.2 Variáveis de contexto

Além dos campeões, o contexto da partida importa muito. As seguintes variáveis são adicionadas:

| Feature | Tipo | Descrição |
|---|---|---|
| `side_blue` | Binária (0/1) | 1 = lado azul |
| `is_playoffs` | Binária (0/1) | 1 se for fase eliminatória |
| `n_ally_picks` | Inteiro (0–5) | Quantos picks aliados já foram feitos |
| `n_enemy_picks` | Inteiro (0–5) | Quantos picks inimigos já foram feitos |
| `patch_numeric` | Float | Patch convertido para número (ex: "14.10" → 14.10) |
| `league_*` | One-hot | Uma coluna por liga: `league_LCK`, `league_LPL`, etc. (~34 ligas no treino) |

> **Nota:** `n_ally_picks` e `n_enemy_picks` são features separadas porque o draft é assimétrico — o número de picks de cada lado pode diferir durante a fase de picks/bans.

### 3.3 Dimensionalidade total

```
172 (aliados) + 172 (inimigos) + 1 (side_blue) + 1 (is_playoffs)
+ 1 (n_ally_picks) + 1 (n_enemy_picks) + 1 (patch_numeric) + ~34 (ligas one-hot)
= ~383 features por amostra
```

Essa dimensão pode parecer alta, mas a maioria das features é zero na prática (apenas 10 de 172 posições de campeão são não-zero por partida), o que é exatamente o tipo de dado em que o LightGBM se destaca.

---

## 4. Patch Weighting — Decaimento Exponencial

### 4.1 O problema

O meta do League of Legends muda a cada patch: um campeão pode ser dominante no patch 14.8 e inútil no 14.10 depois de um nerf. Se tratarmos todas as partidas igualmente, dados antigos "diluem" o sinal do meta atual.

### 4.2 A solução: peso por decaimento exponencial

Cada partida recebe um peso w com base em quão distante ela está do patch atual:

$$w = e^{-\lambda \cdot d}$$

Onde:
- **w** é o peso da amostra (entre 0 e 1)
- **λ (lambda)** é a taxa de decaimento — controla a velocidade com que os dados antigos perdem relevância (padrão: 0.3)
- **d** é a distância numérica entre o patch da partida e o patch mais recente

Exemplo com λ = 0.3:

| Distância (d) | Peso (w) | Interpretação |
|---|---|---|
| 0 (patch atual) | 1.000 | Peso total |
| 1 (1 patch atrás) | 0.741 | Ainda muito relevante |
| 2 (2 patches atrás) | 0.549 | Relevância moderada |
| 3 | 0.407 | Começa a perder força |
| 5 | 0.223 | Pouco peso |
| 10 | 0.050 | Quase ignorado |
| 15 | 0.011 | Irrelevante |

### 4.3 Por que exponencial e não linear?

Com decaimento linear (ex.: w = 1 − 0.1 × d), o peso chega a zero em algum ponto fixo. O exponencial nunca chega a zero — ele apenas se aproxima, o que é matematicamente mais limpo e evita cortes abruptos. Além disso, o comportamento exponencial reflete bem a natureza do meta: as primeiras semanas após um patch são as mais impactantes, e a relevância "some" rapidamente.

### 4.4 Como esse peso é usado no modelo

Durante o treinamento do LightGBM, cada linha de dados (cada partida) é passada com um `sample_weight`. O algoritmo de gradient boosting usa esse peso para dar mais ênfase no aprendizado das amostras recentes:

```python
model.fit(X_train, y_train, sample_weight=weights)
```

---

## 5. Divisão temporal treino/teste

Para avaliar o modelo sem vazamento de dados, usamos uma divisão temporal:

- **Ponto de corte**: percentil 85 dos patches ordenados
- **Treino**: partidas nos 85% de patches mais antigos (com pesos de decaimento)
- **Teste**: partidas nos 15% de patches mais recentes (sem pesos)

Isso simula a situação real: o modelo é avaliado em patches que não existiam quando foi treinado, exatamente como funciona em produção.

> Usar divisão aleatória (train_test_split padrão) seria incorreto aqui, pois permitiria ao modelo "ver o futuro" durante o treino — ele aprenderia padrões do patch 16.08 e seria testado no 14.09, por exemplo.

---

## 6. Modelo LightGBM

### 6.1 O que é gradient boosting (em linguagem acessível)

Imagine que você quer prever se um time vai ganhar. Você começa com um "chute" inicial (digamos, 50% para todos). Então você treina uma árvore de decisão simples para corrigir os erros desse chute. Depois treina outra árvore para corrigir os erros das duas primeiras juntas. E assim por diante.

Gradient boosting é exatamente isso: um **ensemble de árvores de decisão fracas**, onde cada árvore aprende a corrigir os resíduos da anterior. O resultado final é a soma das previsões de todas as árvores.

"Gradient" vem do fato de que cada nova árvore é treinada na direção do gradiente da função de perda — o mesmo conceito de gradiente descendente usado em redes neurais, mas aplicado de forma discreta sobre árvores.

### 6.2 Por que LightGBM funciona bem com features esparsas

O vetor de features do draft tem ~383 dimensões, mas em qualquer partida apenas 10 campeões estão presentes (5 aliados + 5 inimigos). Isso significa que ~94% das features de campeões são zero — o vetor é **esparso**.

LightGBM foi projetado para lidar eficientemente com isso:

- **Exclusive Feature Bundling (EFB)**: agrupa features que raramente são não-zero ao mesmo tempo (o que é exatamente o caso aqui — dois campeões diferentes raramente aparecem na mesma partida)
- **Gradient-based One-Side Sampling (GOSS)**: foca o aprendizado nas amostras com maior gradiente, descartando as "fáceis"
- É significativamente mais rápido que XGBoost em dados com alta esparsidade

### 6.3 Hiperparâmetros utilizados

| Parâmetro | Valor | Motivação |
|---|---|---|
| `n_estimators` | 500 | Número de árvores. 500 é bom equilíbrio para este tamanho de dataset. |
| `num_leaves` | 63 | Complexidade de cada árvore. 63 = 2^6−1, captura interações de até 6 features. |
| `learning_rate` | 0.05 | Taxa baixa + mais árvores = melhor generalização. |
| `min_child_samples` | 10 | Mínimo de amostras por folha. Evita overfitting em padrões raros. |
| `subsample` | 0.8 | Usa 80% dos dados por árvore (bagging). Reduz overfitting. |
| `colsample_bytree` | 0.6 | Usa 60% das features por árvore. Reduz correlação entre árvores. |
| `reg_alpha` | 0.1 | Regularização L1 (Lasso) — penaliza features irrelevantes. |
| `reg_lambda` | 0.1 | Regularização L2 (Ridge) — suaviza pesos das features. |
| `objective` | `binary` | Classificação binária: vitória (1) ou derrota (0). |
| `metric` | `binary_logloss` | Penaliza predições confiantes e erradas mais duramente. |

### 6.4 Como o sample_weight altera o aprendizado

Quando passamos `sample_weight` ao `.fit()`, o cálculo do gradiente e do hessiano (derivadas de primeira e segunda ordem da função de perda) é multiplicado pelo peso de cada amostra. Formalmente, em vez de minimizar:

$$L = \sum_{i} \ell(y_i, \hat{y}_i)$$

O modelo minimiza:

$$L = \sum_{i} w_i \cdot \ell(y_i, \hat{y}_i)$$

Onde w_i é o peso calculado pelo decaimento exponencial. Na prática, isso faz com que erros em partidas recentes "doam mais" durante o treinamento, forçando o modelo a priorizar o acerto nessas amostras.

---

## 7. Predição de win probability

### 7.1 Como a composição parcial vira um feature vector

Durante o draft, o número de picks cresce gradualmente (de 0 a 5 por lado). A qualquer momento, podemos representar o estado atual como:

```
Estado atual = {
  aliados: ["Orianna", "Vi"],        ← 2 picks feitos
  inimigos: ["Zed"],                 ← 1 pick feito
  lado: "azul",
  liga: "LCK",
  patch: "15.01",
  is_playoffs: False
}
```

Isso vira um vetor numérico com ~383 dimensões:

```
X = [0,...,1,...,1,...,0,...,1,...,0,   1,  0, 2, 1, 15.01, 1, 0, 0, ...]
     ← aliados (172) →  ← inimigos (172) →   ↑  ↑  ↑  ↑    ↑
                                         side  ↑ n_ally ↑  patch
                                          is_playoffs n_enemy
```

### 7.2 O que o modelo devolve

O LightGBM, com `objective='binary'`, aplica uma função sigmoide na saída bruta (log-odds) para transformá-la em probabilidade:

$$P(\text{vitória} \mid X) = \sigma(\text{raw score}) = \frac{1}{1 + e^{-\text{raw score}}}$$

O resultado é um número entre 0 e 1 representando a probabilidade estimada de vitória dado aquele estado do draft.

---

## 8. Sistema de sugestões por delta

### 8.1 A ideia central

Em vez de rankear campeões por win rate individual, o sistema pergunta: **"qual campeão, se adicionado agora, mais aumenta a chance de vitória?"**

Para cada campeão candidato c (não banido, não escolhido), calcula-se:

$$\Delta_c = P(\text{vitória} \mid \text{comp} + c) - P(\text{vitória} \mid \text{comp atual})$$

O ranking final é simplesmente a lista ordenada por Δ decrescente.

### 8.2 Por que delta e não probabilidade absoluta?

Usar a probabilidade absoluta da composição completa com c seria ideal, mas:

1. No começo do draft, há poucos picks — as probabilidades brutas têm alta variância
2. O delta captura o **valor marginal** de cada adição, que é o que importa na hora de escolher

### 8.3 Exemplo numérico (valores hipotéticos)

Estado atual:
- Aliados: `["Orianna", "Vi"]`
- Inimigos: `["Zed"]`
- P(vitória | estado atual) = **0.52**

Avaliando candidatos:

| Campeão candidato (c) | P(vitória | comp + c) | Δc |
|---|---|---|---|
| Azir | 0.61 | **+0.09** |
| Viktor | 0.58 | +0.06 |
| Syndra | 0.55 | +0.03 |
| Jayce | 0.53 | +0.01 |
| Corki | 0.49 | −0.03 |

Resultado: **Azir** é sugerido em primeiro, pois adiciona +9 pontos percentuais de chance de vitória. Corki é contraindicado — adicioná-lo reduziria a estimativa de vitória.

---

## 9. Counter Analysis

### 9.1 Por que usar dados históricos em vez do ML para counters específicos?

O modelo LightGBM captura padrões gerais de composição, mas para counters específicos de matchup (ex.: "Malphite vs. ADCs de auto-attack") os dados históricos diretos têm uma vantagem: são **interpretáveis e auditáveis**.

A `counter_matrix` registra, para cada par (campeão, vs_campeão) em cada liga e patch, o número de vitórias e partidas totais.

### 9.2 A fórmula

Para um matchup (A vs B) em um contexto (liga, patch):

$$\text{win\_rate}(A \text{ vs } B) = \frac{\sum \text{vitórias de } A \text{ contra } B}{\sum \text{partidas com } A \text{ contra } B}$$

Aplicamos um filtro de amostra mínima para evitar conclusões baseadas em poucas partidas.

### 9.3 O problema da esparsidade e o fallback chain

Com 166.254 pares registrados mas apenas 3.767 tendo ≥5 partidas, muitos pares (liga + patch) têm dados insuficientes. O sistema usa um **fallback progressivo em 3 níveis**:

```
1. Busca exata: (vs_champion = X) AND (league = L) AND (patch_major = P) AND (games >= 5)
        ↓ se vazio:
2. Sem filtro de patch: (vs_champion = X) AND (league = L) AND (games >= 5)
        ↓ se ainda vazio:
3. Sem filtro nenhum: (vs_champion = X) AND (games >= 3)
```

Isso garante que o sistema sempre retorna sugestões úteis, mesmo para patches muito recentes que ainda têm poucos dados.

### 9.4 Score híbrido (engine/scorer.py — legado)

O score final de um campeão no scorer legado combina três fontes:

$$\text{score\_final} = w_1 \cdot \text{winrate\_base} + w_2 \cdot \text{sinergia} + w_3 \cdot \text{counter}$$

Com os pesos padrão:

| Componente | Peso padrão | Fonte dos dados |
|---|---|---|
| `winrate_base` | 0.30 | `counter_matrix` (soma geral do campeão) |
| `synergy` | 0.35 | `synergy_matrix` (pares aliados) |
| `counter` | 0.35 | `counter_matrix` (matchups específicos vs inimigos) |

> **Nota:** O endpoint `/suggest-ml` usa o modelo LightGBM diretamente para probabilidade de vitória. O endpoint `/suggest` (legado) usa esse score híbrido.

---

## 10. Sugestões por lane

### 10.1 O problema

O delta calculado acima não sabe se o campeão sugerido é um top laner ou um ADC. Se a equipe precisa de um suporte, não faz sentido sugerir Zed.

### 10.2 Affinity map: campeão → posições

A partir dos dados do banco, calculamos com que frequência cada campeão aparece em cada posição. O resultado é um ranking de posições por campeão, ordenado por frequência decrescente:

```
Orianna → ['mid', 'top']         (96% mid, 2% top)
Vi      → ['jng', 'top']         (92% jng, 5% top)
Thresh  → ['sup']                (99% sup)
Jinx    → ['bot']                (97% bot)
```

Esse mapa é construído direto da `match_picks` na inicialização do predictor.

### 10.3 Filtragem e agrupamento

Quando o usuário seleciona uma lane via o seletor de posição, o sistema:

1. Calcula o delta para todos os candidatos
2. Filtra apenas os campeões cuja lista de posições inclui a lane selecionada
3. Retorna o top N filtrado

Para a visão completa (sem filtro), o sistema agrupa os top candidatos por posição principal (`suggest_by_lane`), garantindo pelo menos 3 sugestões por lane:

```
top:   Gnar     (Δ = +0.07)   🗡
jng:   Rell     (Δ = +0.06)   🌲
mid:   Azir     (Δ = +0.09)   ⚡
bot:   Ezreal   (Δ = +0.05)   🏹
sup:   Lulu     (Δ = +0.04)   🛡
```

---

## Resumo visual da pipeline completa

```
CSVs Oracle's Elixir (2024, 2025, 2026)
23.624 partidas · 67 ligas · patches 13.24→16.08
        │
        ▼
┌───────────────────────┐
│  pipeline/ingest.py   │  → matches · match_teams · match_picks
└───────────────────────┘
        │
        ▼
┌───────────────────────────┐
│  pipeline/build_matrices  │  → synergy_matrix (341K pares)
│                           │     counter_matrix (166K pares)
└───────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  pipeline/build_features.py                               │
│  • vetores binários aliados/inimigos (172 dims cada)      │
│  • contexto: side, playoffs, n_ally, n_enemy, patch, liga │
│  • patch weighting: w = e^(-λ·d), λ=0.3                  │
│  • divisão temporal (corte no percentil 85 de patches)    │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  pipeline/train_model.py — LightGBM                       │
│  • 500 árvores · lr=0.05 · num_leaves=63                  │
│  • min_child_samples=10 · subsample=0.8 · col=0.6         │
│  • reg_alpha=0.1 · reg_lambda=0.1                         │
│  • output: model.joblib + model_metadata.json             │
└───────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  engine/predictor.py — inference                          │
│  • delta_c = P(comp + c) – P(comp atual)                  │
│  • ranking por Δ decrescente (top 20)                     │
│  • agrupamento por lane via affinity map                  │
│  • counter analysis: fallback chain 3 níveis              │
└───────────────────────────────────────────────────────────┘
        │
        ▼
   api/main.py  →  POST /suggest-ml  →  Frontend React
```
