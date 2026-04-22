import './SuggestionPanel.css'

const LANE_LABELS = { top: 'Top', jng: 'Jungle', mid: 'Mid', bot: 'Bot', sup: 'Suporte' }
const LANE_ORDER  = ['top', 'jng', 'mid', 'bot', 'sup']

function WinBar({ probability, mySide }) {
  const myPct  = Math.round((probability ?? 0.5) * 100)
  const oppPct = 100 - myPct
  const isBlue = mySide === 'blue'
  const bluePct = isBlue ? myPct  : oppPct
  const redPct  = isBlue ? oppPct : myPct

  const getColor = (pct) => pct >= 55 ? '#4caf50' : pct >= 45 ? '#c8aa6e' : '#e84057'

  return (
    <div className="win-bar-wrap">
      <div className="win-bar-labels">
        <span style={{ color: '#4a9fdc', fontWeight: 700, fontSize: '0.8rem' }}>
          Azul {isBlue ? '(Você)' : ''} — {bluePct}%
        </span>
        <span className="wbl-center">Probabilidade de Vitória</span>
        <span style={{ color: '#e84057', fontWeight: 700, fontSize: '0.8rem' }}>
          {redPct}% — Vermelho {!isBlue ? '(Você)' : ''}
        </span>
      </div>
      <div className="win-bar">
        <div className="win-bar-blue" style={{ width: `${bluePct}%` }} />
        <div className="win-bar-red"  style={{ width: `${redPct}%`  }} />
      </div>
      <div className="win-bar-note" style={{ color: getColor(isBlue ? bluePct : redPct) }}>
        {isBlue ? bluePct : redPct}% de chance de vitória para o seu time
      </div>
    </div>
  )
}

function MiniChamp({ champion, winProb, delta, onClick }) {
  const pct      = Math.round(winProb * 100)
  const deltaPct = Math.round(Math.abs(delta) * 100)
  const isPos    = delta >= 0
  return (
    <div className="mini-champ" onClick={() => onClick && onClick(champion)} title={`${champion} — ${pct}% win rate`}>
      <div className="mini-avatar">{champion.slice(0, 2)}</div>
      <div className="mini-info">
        <span className="mini-name">{champion}</span>
        <span className={`mini-delta ${isPos ? 'pos' : 'neg'}`}>
          {isPos ? '+' : '-'}{deltaPct}%
        </span>
      </div>
      <div className="mini-bar">
        <div className="mini-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mini-pct">{pct}%</span>
    </div>
  )
}

function LaneSuggestions({ byLane, activeSlot, onPick }) {
  const activePos = activeSlot?.type === 'pick' ? activeSlot?.position : null

  return (
    <div className="lane-suggestions">
      {LANE_ORDER.map(lane => {
        const picks   = byLane[lane] || []
        const isActive = lane === activePos
        return (
          <div key={lane} className={`lane-row ${isActive ? 'lane-active' : ''}`}>
            <div className="lane-header">
              <span className="lane-icon">{getLaneIcon(lane)}</span>
              <span className="lane-name">{LANE_LABELS[lane]}</span>
              {isActive && <span className="lane-now">← agora</span>}
            </div>
            <div className="lane-picks">
              {picks.length === 0 && <span className="lane-empty">—</span>}
              {picks.map(p => (
                <MiniChamp
                  key={p.champion}
                  champion={p.champion}
                  winProb={p.win_probability}
                  delta={p.delta}
                  onClick={onPick}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CounterAnalysis({ counterAnalysis, onPick }) {
  if (!counterAnalysis || counterAnalysis.length === 0) return null

  return (
    <div className="counter-section">
      <div className="section-title counter-title">
        ⚔ Counters aos picks inimigos
      </div>
      {counterAnalysis.map(({ vs, best_picks }) => (
        <div key={vs} className="counter-row">
          <div className="counter-header">
            <span className="counter-vs-label">vs</span>
            <span className="counter-enemy">{vs}</span>
            <span className="counter-sub">— picks recomendados</span>
          </div>
          <div className="counter-picks">
            {best_picks.map(p => (
              <MiniChamp
                key={p.champion}
                champion={p.champion}
                winProb={p.win_probability}
                delta={p.delta}
                onClick={onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function getLaneIcon(lane) {
  return { top: '🗡', jng: '🌲', mid: '⚡', bot: '🏹', sup: '🛡' }[lane] ?? '⚔'
}

export default function SuggestionPanel({
  winProbability, suggestions, byLane, counterAnalysis,
  loading, mySide, alliedPicks, enemyPicks, activeSlot, onPickSuggestion,
}) {
  const hasData      = alliedPicks.filter(Boolean).length > 0
  const hasLanes     = byLane && Object.values(byLane).some(arr => arr?.length > 0)
  const hasCounters  = counterAnalysis?.length > 0

  return (
    <div className="suggestion-panel">
      {/* Win probability */}
      <div className="panel-top">
        <WinBar probability={hasData ? winProbability : null} mySide={mySide} />
        {loading && <span className="loading-badge">calculando...</span>}
      </div>

      {!hasData && (
        <div className="panel-idle">
          <div className="idle-icon">⚔</div>
          <p>Selecione um pick aliado para ver as recomendações por lane e análise de counters.</p>
        </div>
      )}

      {hasData && (
        <div className="panel-body">
          {/* Lane suggestions */}
          <div className="panel-col">
            <div className="section-title">Sugestões por Lane</div>
            {hasLanes
              ? <LaneSuggestions byLane={byLane} activeSlot={activeSlot} onPick={onPickSuggestion} />
              : <div className="empty-msg">Aguardando dados...</div>
            }
          </div>

          {/* Counter analysis */}
          <div className="panel-col">
            {hasCounters
              ? <CounterAnalysis counterAnalysis={counterAnalysis} onPick={onPickSuggestion} />
              : (
                <div className="counter-placeholder">
                  <div className="section-title">⚔ Counters aos picks inimigos</div>
                  <div className="empty-msg">Adicione picks inimigos para ver counters específicos.</div>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
