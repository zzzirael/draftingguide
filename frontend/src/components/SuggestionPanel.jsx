import './SuggestionPanel.css'

function WinBar({ probability, mySide }) {
  const myPct   = Math.round((probability ?? 0.5) * 100)
  const oppPct  = 100 - myPct
  const isBlue  = mySide === 'blue'

  return (
    <div className="win-bar-wrap">
      <div className="win-bar-labels">
        <span className="wbl-side blue-text">Azul {isBlue ? '(Você)' : ''}</span>
        <span className="wbl-center">Probabilidade de Vitória</span>
        <span className="wbl-side red-text">Vermelho {!isBlue ? '(Você)' : ''}</span>
      </div>
      <div className="win-bar">
        <div
          className="win-bar-blue"
          style={{ width: `${isBlue ? myPct : oppPct}%` }}
        />
        <div
          className="win-bar-red"
          style={{ width: `${isBlue ? oppPct : myPct}%` }}
        />
      </div>
      <div className="win-bar-pcts">
        <span className="blue-text">{isBlue ? myPct : oppPct}%</span>
        <span className="red-text">{isBlue ? oppPct : myPct}%</span>
      </div>
    </div>
  )
}

function SuggestionRow({ rank, data, onClick }) {
  const { champion, win_probability, delta } = data
  const pct      = Math.round(win_probability * 100)
  const deltaPct = delta >= 0
    ? `+${Math.round(delta * 100)}%`
    : `${Math.round(delta * 100)}%`
  const deltaClass = delta >= 0.03 ? 'delta-good' : delta >= 0 ? 'delta-neutral' : 'delta-bad'

  return (
    <div className="suggestion-row" onClick={() => onClick && onClick(champion)}>
      <span className="sug-rank">#{rank}</span>
      <div className="sug-avatar">{champion.slice(0, 2)}</div>
      <span className="sug-name">{champion}</span>
      <div className="sug-bar-wrap">
        <div className="sug-bar">
          <div className="sug-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="sug-pct">{pct}%</span>
      </div>
      <span className={`sug-delta ${deltaClass}`}>{deltaPct}</span>
    </div>
  )
}

function CompTips({ alliedPicks, enemyPicks }) {
  const tips = []

  const n = alliedPicks.filter(Boolean).length
  const nEnemy = enemyPicks.filter(Boolean).length

  if (n === 0) {
    tips.push({ icon: '💡', text: 'Selecione o primeiro pick para ver sugestões personalizadas.' })
  } else {
    if (n < 5) {
      tips.push({ icon: '🎯', text: `Composição parcial: ${n}/5 picks. Continue para aumentar a precisão.` })
    } else {
      tips.push({ icon: '✅', text: 'Composição completa! O modelo avalia a comp inteira.' })
    }
    if (nEnemy > 0) {
      tips.push({ icon: '⚔', text: `${nEnemy} pick(s) inimigo(s) identificados — counters considerados no score.` })
    }
    if (n >= 3) {
      tips.push({ icon: '📊', text: 'Score calculado por LightGBM treinado com dados competitivos reais, ponderados por patch.' })
    }
  }

  return (
    <div className="comp-tips">
      {tips.map((t, i) => (
        <div key={i} className="tip-row">
          <span className="tip-icon">{t.icon}</span>
          <span className="tip-text">{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export default function SuggestionPanel({
  winProbability,
  suggestions,
  loading,
  mySide,
  alliedPicks,
  enemyPicks,
  onPickSuggestion,
}) {
  const hasSuggestions = suggestions && suggestions.length > 0
  const showProb = winProbability !== null && winProbability !== undefined

  return (
    <div className="suggestion-panel">
      {/* Win probability bar */}
      <div className="panel-section">
        <WinBar probability={showProb ? winProbability : 0.5} mySide={mySide} />
      </div>

      <div className="panel-body">
        {/* Sugestões */}
        <div className="panel-section suggestions-section">
          <div className="section-title">
            Picks Recomendados
            {loading && <span className="loading-dot"> ·</span>}
          </div>

          {!hasSuggestions && !loading && (
            <div className="empty-msg">Selecione picks para ver sugestões</div>
          )}

          {hasSuggestions && (
            <div className="suggestions-list">
              {suggestions.slice(0, 8).map((s, i) => (
                <SuggestionRow
                  key={s.champion}
                  rank={i + 1}
                  data={s}
                  onClick={onPickSuggestion}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dicas contextuais */}
        <div className="panel-section tips-section">
          <div className="section-title">Análise da Composição</div>
          <CompTips alliedPicks={alliedPicks} enemyPicks={enemyPicks} />
        </div>
      </div>
    </div>
  )
}
