# A Matemática do Draft Simulator

Este documento explica, em detalhes, como o sistema transforma dados brutos de partidas profissionais em sugestões de picks e bans. A ideia é ser acessível tanto para quem tem base matemática quanto para quem quer apenas entender a lógica por trás das recomendações.

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

## 2. Feature Engineering

### 2.1 Vetores binários de campeões

O jogo tem aproximadamente 170 campeões disponíveis. Para representar "quais campeões estão na composição aliada" criamos um vetor binário de dimensão 170:

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

### 2.2 Variáveis de contexto

Além dos campeões, o contexto da partida importa muito. As seguintes variáveis são adicionadas:

| Feature | Tipo | Descrição |
|---|---|---|
| `side` | Binária (0/1) | 0 = lado azul, 1 = lado vermelho |
| `is_playoffs` | Binária (0/1) | 1 se for fase eliminatória |
| `n_picks` | Inteiro (0–5) | Quantos picks aliados já foram feitos |
| `patch_num` | Float | Patch convertido para número (ex: "14.10" → 14.10) |
| `liga_*` | One-hot | Uma coluna por liga: `liga_LCK`, `liga_LPL`, `liga_LEC`, `liga_LCS`, `liga_CBLOL`, ... |

### 2.3 Dimensionalidade total

```
170 (aliados) + 170 (inimigos) + 1 (side) + 1 (playoffs) + 1 (n_picks) + 1 (patch) + ~30 (ligas one-hot)
= ~374 features por amostra
```

Essa dimensão pode parecer alta, mas a maioria das features é zero na prática (poucos campeões escolhidos por vez), o que é exatamente o tipo de dado em que o LightGBM se destaca.

---

## 3. Patch Weighting — Decaimento Exponencial

### 3.1 O problema

O meta do League of Legends muda a cada patch: um campeão pode ser dominante no patch 14.8 e inútil no 14.10 depois de um nerf. Se tratarmos todas as partidas igualmente, dados antigos "diluem" o sinal do meta atual.

### 3.2 A solução: peso por decaimento exponencial

Cada partida recebe um peso w com base em quão distante ela está do patch atual:

$$w = e^{-\lambda \cdot d}$$

Onde:
- **w** é o peso da amostra (entre 0 e 1)
- **λ (lambda)** é a taxa de decaimento — controla a velocidade com que os dados antigos perdem relevância
- **d** é a distância em patches entre o patch da partida e o patch mais recente

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

### 3.3 Por que exponencial e não linear?

Com decaimento linear (ex.: w = 1 - 0.1 × d), o peso chega a zero em algum ponto fixo. O exponencial nunca chega a zero — ele apenas se aproxima, o que é matematicamente mais limpo e evita cortes abruptos. Além disso, o comportamento exponencial reflete bem a natureza do meta: as primeiras semanas após um patch são as mais impactantes, e a relevância "some" rapidamente.

### 3.4 Como esse peso é usado no modelo

Durante o treinamento do LightGBM, cada linha de dados (cada partida) é passada com um `sample_weight`. O algoritmo de gradient boosting usa esse peso para dar mais ênfase no aprendizado das amostras recentes:

```python
model.fit(X_train, y_train, sample_weight=weights)
```

---

## 4. Modelo LightGBM

### 4.1 O que é gradient boosting (em linguagem acessível)

Imagine que você quer prever se um time vai ganhar. Você começa com um "chute" inicial (digamos, 50% para todos). Então você treina uma árvore de decisão simples para corrigir os erros desse chute. Depois treina outra árvore para corrigir os erros das duas primeiras juntas. E assim por diante.

Gradient boosting é exatamente isso: um **ensemble de árvores de decisão fracas**, onde cada árvore aprende a corrigir os resíduos da anterior. O resultado final é a soma das previsões de todas as árvores.

"Gradient" vem do fato de que cada nova árvore é treinada na direção do gradiente da função de perda — o mesmo conceito de gradiente descendente usado em redes neurais, mas aplicado de forma discreta sobre árvores.

### 4.2 Por que LightGBM funciona bem com features esparsas

O vetor de features do draft tem ~374 dimensões, mas em qualquer partida apenas 10 campeões estão presentes (5 aliados + 5 inimigos). Isso significa que ~96% das features são zero — o vetor é **esparso**.

LightGBM foi projetado para lidar eficientemente com isso:

- Usa uma técnica chamada **Exclusive Feature Bundling (EFB)**: agrupa features que raramente são não-zero ao mesmo tempo (o que é exatamente o caso aqui — dois campeões diferentes raramente aparecem na mesma partida)
- Usa **Gradient-based One-Side Sampling (GOSS)**: foca o aprendizado nas amostras com maior gradiente, descartando as "fáceis"
- É significativamente mais rápido que XGBoost em dados com alta esparsidade

### 4.3 Hiperparâmetros utilizados

| Parâmetro | Valor | Motivação |
|---|---|---|
| `n_estimators` | 500 | Número de árvores. Mais árvores = mais capacidade, mas risco de overfitting. 500 é um bom equilíbrio para este tamanho de dataset. |
| `num_leaves` | 63 | Controla a complexidade de cada árvore. 63 = 2^6 - 1, o que permite capturar interações de até 6 features por árvore. |
| `learning_rate` | 0.05 | Taxa de aprendizado baixa + mais árvores = generalização melhor do que taxa alta + poucas árvores. |
| `min_child_samples` | 20 | Mínimo de amostras por folha. Evita que o modelo memorize padrões raros com poucos dados. |
| `subsample` | 0.8 | Usa 80% dos dados por árvore (bagging). Reduz overfitting e aumenta diversidade do ensemble. |
| `colsample_bytree` | 0.8 | Usa 80% das features por árvore. Mesmo princípio do Random Forest — reduz correlação entre árvores. |
| `objective` | `binary` | Problema de classificação binária: vitória (1) ou derrota (0). |
| `metric` | `binary_logloss` | Função de perda para classificação binária. Penaliza predições confiantes e erradas mais duramente. |

### 4.4 Como o sample_weight altera o aprendizado

Quando passamos `sample_weight` ao `.fit()`, o cálculo do gradiente e do hessiano (derivadas de primeira e segunda ordem da função de perda) é multiplicado pelo peso de cada amostra. Formalmente, em vez de minimizar:

$$L = \sum_{i} \ell(y_i, \hat{y}_i)$$

O modelo minimiza:

$$L = \sum_{i} w_i \cdot \ell(y_i, \hat{y}_i)$$

Onde w_i é o peso calculado pelo decaimento exponencial. Na prática, isso faz com que erros em partidas recentes "doam mais" durante o treinamento, forçando o modelo a priorizar o acerto nessas amostras.

---

## 5. Predição de win probability

### 5.1 Como a composição parcial vira um feature vector

Durante o draft, o número de picks cresce gradualmente (de 0 a 5 por lado). A qualquer momento, podemos representar o estado atual como:

```
Estado atual = {
  aliados: ["Orianna", "Vi"],        ← 2 picks feitos
  inimigos: ["Zed"],                 ← 1 pick feito
  lado: "azul",
  liga: "LCK",
  patch: "14.10",
  is_playoffs: False
}
```

Isso vira um vetor numérico:

```
X = [0,...,1,...,1,...,0,...,1,...,0,   0,  0, 2, 14.10, 1, 0, 0, ...]
     ←── aliados (170) ──→  ←── inimigos (170) ──→   ↑  ↑  ↑   ↑
                                                    side ↑ n_picks patch
                                                      playoffs
```

### 5.2 O que o modelo devolve

O LightGBM, com `objective='binary'`, aplica uma função sigmoide na saída bruta (log-odds) para transformá-la em probabilidade:

$$P(\text{vitória} \mid X) = \sigma(\text{raw score}) = \frac{1}{1 + e^{-\text{raw score}}}$$

O resultado é um número entre 0 e 1 representando a probabilidade estimada de vitória dado aquele estado do draft.

---

## 6. Sistema de sugestões por delta

### 6.1 A ideia central

Em vez de rankear campeões por win rate individual, o sistema pergunta: **"qual campeão, se adicionado agora, mais aumenta a chance de vitória?"**

Para cada campeão candidato c (não banido, não escolhido), calcula-se:

$$\Delta_c = P(\text{vitória} \mid \text{comp} + c) - P(\text{vitória} \mid \text{comp atual})$$

O ranking final é simplesmente a lista ordenada por Δ decrescente.

### 6.2 Por que delta e não probabilidade absoluta?

Usar a probabilidade absoluta da composição completa com c seria ideal, mas:

1. No começo do draft, há poucos picks — as probabilidades brutas têm alta variância
2. O delta captura o **valor marginal** de cada adição, que é o que importa na hora de escolher

### 6.3 Exemplo numérico (valores hipotéticos)

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
| Corki | 0.49 | -0.03 |

Resultado: **Azir** é sugerido em primeiro, pois adiciona +9 pontos percentuais de chance de vitória. Corki é contraindicado — adicioná-lo reduziria a estimativa de vitória.

---

## 7. Counter Analysis

### 7.1 Por que usar dados históricos em vez do ML para counters específicos?

O modelo LightGBM captura padrões gerais de composição, mas para counters específicos de matchup (ex.: "Malphite vs. ADCs de auto-attack") os dados históricos diretos têm uma vantagem: são **interpretáveis e auditáveis**.

A `counter_matrix` registra, para cada par (campeão, vs_campeão) em cada liga e patch:

```sql
SELECT wins, games FROM counter_matrix
WHERE champion = 'Malphite'
  AND vs_champion = 'Jinx'
  AND league = 'LCK'
  AND patch_major = '14.10'
```

### 7.2 A fórmula

Para um matchup (A vs B) em um contexto (liga, patch):

$$\text{win\_rate}(A \text{ vs } B) = \frac{\sum \text{vitórias de } A \text{ contra } B}{\sum \text{partidas com } A \text{ contra } B}$$

Aplicamos um filtro de amostra mínima (`MIN_SAMPLE_SIZE = 5`) para evitar conclusões baseadas em um número insignificante de partidas.

### 7.3 Combinação com o score do modelo

O score final de um campeão combina três fontes:

$$\text{score\_final} = w_1 \cdot \text{winrate\_base} + w_2 \cdot \text{sinergia} + w_3 \cdot \text{counter}$$

Com os pesos padrão:

| Componente | Peso padrão | Fonte dos dados |
|---|---|---|
| `winrate_base` | 0.30 | `counter_matrix` (soma geral) |
| `synergy` | 0.35 | `synergy_matrix` (pares aliados) |
| `counter` | 0.35 | `counter_matrix` (matchups específicos) |

Os pesos são configuráveis via o parâmetro `weights` da função `score_champion()`.

---

## 8. Sugestões por lane

### 8.1 O problema

O delta calculado acima não sabe se o campeão sugerido é um top laner ou um ADC. Se a equipe precisa de um suporte, não faz sentido sugerir Zed.

### 8.2 Affinity map: campeão → posições

A partir dos dados do banco, calculamos a frequência com que cada campeão aparece em cada posição:

$$\text{affinity}(c, \text{pos}) = \frac{\text{partidas onde } c \text{ jogou na posição pos}}{\text{total de partidas de } c}$$

Isso cria um mapa de afinidade. Exemplo hipotético:

| Campeão | top | jng | mid | bot | sup |
|---|---|---|---|---|---|
| Orianna | 0.02 | 0.00 | 0.96 | 0.02 | 0.00 |
| Vi | 0.05 | 0.92 | 0.02 | 0.00 | 0.01 |
| Thresh | 0.00 | 0.00 | 0.00 | 0.01 | 0.99 |
| Jinx | 0.00 | 0.00 | 0.02 | 0.97 | 0.01 |

### 8.3 Filtragem por posição necessária

Quando o usuário indica que precisa de, por exemplo, um `mid laner`, o sistema:

1. Calcula o delta para todos os candidatos (como descrito na seção 6)
2. Filtra apenas os campeões com `affinity(c, 'mid') >= threshold` (ex.: 0.5)
3. Retorna o top N filtrado

### 8.4 Agrupamento para visão completa

Quando nenhuma posição específica é solicitada, o sistema agrupa os top candidatos por posição principal, garantindo diversidade nas sugestões:

```
Top sugestões globais:
  mid:   Azir     (Δ = +0.09)
  top:   Gnar     (Δ = +0.07)
  jng:   Rell     (Δ = +0.06)
  bot:   Ezreal   (Δ = +0.05)
  sup:   Lulu     (Δ = +0.04)
```

Isso evita que a lista de sugestões seja dominada por, por exemplo, cinco mid laners quando o time precisa completar outras posições.

---

## Resumo visual da pipeline completa

```
CSV Oracle's Elixir
        │
        ▼
┌───────────────────┐
│  ingest.py        │  → matches, match_teams, match_picks
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ build_matrices.py │  → synergy_matrix, counter_matrix
└───────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Feature Engineering                                  │
│  • vetores binários aliados/inimigos (~170 dims cada) │
│  • contexto: side, playoffs, n_picks, patch, liga     │
│  • patch weighting: w = e^(-λ·d)                      │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  LightGBM (gradient boosting)                         │
│  • 500 árvores, num_leaves=63, lr=0.05                │
│  • sample_weight = decaimento exponencial por patch   │
│  • output: P(vitória | features)                      │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  Sistema de sugestões                                  │
│  • delta_c = P(comp + c) - P(comp atual)              │
│  • ranking por Δ decrescente                          │
│  • filtro por posição via affinity map                │
│  • score híbrido: synergy + counter + winrate_base    │
└───────────────────────────────────────────────────────┘
        │
        ▼
   API /suggest → Frontend React
```
