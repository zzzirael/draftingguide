import { useMemo } from 'react'
import { detectArchetype, TAG_META } from './champion-archetypes'
import './SuggestionPanel.css'

const LANE_LABELS = { top: 'Top', jng: 'Jng', mid: 'Mid', bot: 'Bot', sup: 'Sup' }
const LANE_ICONS  = { top: '🗡', jng: '🌲', mid: '⚡', bot: '🏹', sup: '🛡' }
const LANE_ORDER  = ['top', 'jng', 'mid', 'bot', 'sup']

// ── Archetype bar ─────────────────────────────────────────────────────────────

function ArchetypeBar({ alliedPicks }) {
  const result = useMemo(() => detectArchetype(alliedPicks), [alliedPicks])
  if (!result) return null

  return (
    <div className="archetype-bar">
      <span className="archetype-label">COMP</span>

      {result.primary ? (
        <span className="archetype-primary" style={{ color: result.primary.color }}>
          {result.primary.icon} {result.primary.label.toUpperCase()}
        </span>
      ) : (
        <span className="archetype-neutral">BALANCEADA</span>
      )}

      {result.secondary.length > 0 && (
        <span className="archetype-sep">·</span>
      )}

      <div className="archetype-tags">
        {result.secondary.map(a => (
          <span key={a.key} className="archetype-tag" style={{ color: a.color }}>
            {a.icon} {a.label}
          </span>
        ))}
        {Object.entries(result.counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .filter(([tag]) => TAG_META[tag])
          .map(([tag, count]) => (
            <span key={tag} className="archetype-count-tag">
              {TAG_META[tag].icon} ×{count}
            </span>
          ))
        }
      </div>

      {result.gaps.length > 0 && (
        <div className="archetype-gaps">
          {result.gaps.map(g => (
            <span key={g} className="archetype-gap">⚠ {g}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Opponent comp alert ───────────────────────────────────────────────────────

function OppCompAlert({ alerts }) {
  if (!alerts?.length) return null
  return (
    <div className="opp-comp-alerts">
      {alerts.map((a, i) => {
        const complete = a.matched.length === a.champions.length
        return (
          <div key={i} className={`opp-comp-alert${complete ? ' occ-complete' : ''}`}>
            <div className="occ-header">
              <span className="occ-warn">{complete ? '🚨' : '⚠'}</span>
              <span className="occ-label">PADRÃO INIMIGO</span>
              <span className="occ-name">{a.name}</span>
              <span className="occ-count">{a.matched.length}/{a.champions.length}</span>
            </div>
            <div className="occ-champs">
              {a.champions.map(c => (
                <span
                  key={c}
                  className={`occ-champ ${a.matched.includes(c) ? 'occ-confirmed' : 'occ-pending'}`}
                >
                  {c}{a.matched.includes(c) ? ' ✓' : ' ?'}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Win probability bar ───────────────────────────────────────────────────────

function WinBar({ probability, mySide }) {
  const myPct  = Math.round((probability ?? 0.5) * 100)
  const oppPct = 100 - myPct
  const isBlue = mySide === 'blue'
  const bluePct = isBlue ? myPct  : oppPct
  const redPct  = isBlue ? oppPct : myPct

  const noteColor = (pct) => pct >= 55 ? '#4caf50' : pct >= 45 ? '#c8aa6e' : '#e84057'

  return (
    <div className="win-bar-wrap">
      <div className="win-bar-labels">
        <span style={{ color: '#4a9fdc', fontWeight: 700, fontSize: '0.78rem' }}>
          Azul {isBlue ? '(Você)' : ''} — {bluePct}%
        </span>
        <span className="wbl-center">Probabilidade de Vitória</span>
        <span style={{ color: '#e84057', fontWeight: 700, fontSize: '0.78rem' }}>
          {redPct}% — Vermelho {!isBlue ? '(Você)' : ''}
        </span>
      </div>
      <div className="win-bar">
        <div className="win-bar-blue" style={{ width: `${bluePct}%` }} />
        <div className="win-bar-red"  style={{ width: `${redPct}%`  }} />
      </div>
      <div className="win-bar-note" style={{ color: noteColor(isBlue ? bluePct : redPct) }}>
        {isBlue ? bluePct : redPct}% de chance de vitória para o seu time
      </div>
    </div>
  )
}

// ── Mini champion card ────────────────────────────────────────────────────────

function MiniChamp({ champion, winProb, delta, primaryPosition, inPool, onClick }) {
  const pct      = Math.round((winProb ?? 0.5) * 100)
  const deltaPct = Math.round(Math.abs(delta ?? 0) * 100)
  const isPos    = (delta ?? 0) >= 0
  const laneIcon = LANE_ICONS[primaryPosition]

  return (
    <div
      className={`mini-champ${inPool ? ' mini-in-pool' : ''}`}
      onClick={() => onClick?.(champion)}
      title={`${champion} — ${pct}% win rate${inPool ? ' ✓ no pool' : ''}`}
    >
      <div className="mini-avatar">{champion.slice(0, 2)}</div>
      <div className="mini-info">
        <div className="mini-top-row">
          <span className="mini-name">{champion}</span>
          {inPool && <span className="mini-pool-badge">✓</span>}
          {laneIcon && !inPool && (
            <span className="mini-lane-badge" title={LANE_LABELS[primaryPosition]}>
              {laneIcon} <span className="mini-lane-label">{LANE_LABELS[primaryPosition]}</span>
            </span>
          )}
        </div>
        <span className={`mini-delta ${isPos ? 'pos' : 'neg'}`}>
          {isPos ? '+' : '-'}{deltaPct}%
        </span>
      </div>
      <div className="mini-right">
        <span className="mini-pct">{pct}%</span>
        <div className="mini-bar">
          <div className="mini-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── Ban suggestions ───────────────────────────────────────────────────────────

function BanSuggestions({ banSuggestions, allPoolSet, onBan }) {
  if (!banSuggestions?.length) return (
    <div className="empty-msg">Adicione picks para ver quais campeões banir.</div>
  )
  return (
    <div className="ban-suggestions">
      <div className="ban-hint">
        {banSuggestions.length > 0
          ? 'Esses campeões são os maiores counters dos seus picks:'
          : 'Faça picks para ver sugestões de ban contextuais.'}
      </div>
      {banSuggestions.map(s => {
        const dropPct  = Math.abs(Math.round(s.threat_delta * 100))
        const laneIcon = LANE_ICONS[s.primary_position]
        const inPool   = allPoolSet?.has(s.champion)
        return (
          <div
            key={s.champion}
            className={`ban-card${inPool ? ' ban-in-pool' : ''}`}
            onClick={() => onBan?.(s.champion)}
            title={`Banir ${s.champion} — evita queda de ${dropPct}% na sua WP`}
          >
            <div className="ban-avatar">{s.champion.slice(0, 2)}</div>
            <div className="ban-info">
              <span className="ban-name">{s.champion}</span>
              {laneIcon && <span className="ban-lane-icon">{laneIcon}</span>}
              {inPool && <span className="ban-pool-note">✓ pool</span>}
            </div>
            <div className="ban-threat">
              <span className="ban-delta">-{dropPct}%</span>
              <div className="ban-bar">
                <div className="ban-bar-fill" style={{ width: `${Math.min(dropPct * 3, 100)}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Lane suggestions ──────────────────────────────────────────────────────────

function LaneSuggestions({ byLane, activePosition, poolByLane, onPick }) {
  return (
    <div className="lane-suggestions">
      {LANE_ORDER.map(lane => {
        const picks    = byLane[lane] || []
        const isActive = lane === activePosition
        const lanePool = poolByLane?.[lane]
        return (
          <div key={lane} className={`lane-row ${isActive ? 'lane-active' : ''}`}>
            <div className="lane-header">
              <span className="lane-icon">{LANE_ICONS[lane]}</span>
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
                  primaryPosition={p.primary_position}
                  inPool={lanePool ? lanePool.has(p.champion) : false}
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

// ── Counter analysis ──────────────────────────────────────────────────────────

function CounterAnalysis({ counterAnalysis, allPoolSet, onPick }) {
  if (!counterAnalysis?.length) return null
  return (
    <div className="counter-section">
      <div className="section-title counter-title">⚔ Counters aos picks inimigos</div>
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
                primaryPosition={p.primary_position}
                inPool={allPoolSet ? allPoolSet.has(p.champion) : false}
                onClick={onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SuggestionPanel({
  winProbability, suggestions, byLane, counterAnalysis, banSuggestions,
  oppCompAlerts,
  loading, mySide, alliedPicks, enemyPicks, activeSlot, activePosition,
  myTeamPlayers,
  onPickSuggestion, onBanSuggestion,
}) {
  const hasAllied   = alliedPicks.filter(Boolean).length > 0
  const hasEnemy    = enemyPicks.filter(Boolean).length  > 0
  const hasAny      = hasAllied || hasEnemy
  const hasLanes    = byLane && Object.values(byLane).some(arr => arr?.length > 0)
  const hasCounters = counterAnalysis?.length > 0
  const isBanPhase  = activeSlot?.type === 'ban'

  // Pool lookups
  const poolByLane = useMemo(() => {
    if (!myTeamPlayers?.length) return {}
    const map = {}
    myTeamPlayers.forEach(p => { if (p.pool?.length) map[p.role] = new Set(p.pool) })
    return map
  }, [myTeamPlayers])

  const allPoolSet = useMemo(() => {
    if (!myTeamPlayers?.length) return null
    const all = myTeamPlayers.flatMap(p => p.pool || [])
    return all.length ? new Set(all) : null
  }, [myTeamPlayers])

  return (
    <div className="suggestion-panel">
      <div className="panel-top">
        <WinBar probability={hasAllied ? winProbability : null} mySide={mySide} />
        {loading && <span className="loading-badge">calculando...</span>}
      </div>

      <ArchetypeBar alliedPicks={alliedPicks} />

      <OppCompAlert alerts={oppCompAlerts} />

      {!hasAny && (
        <div className="panel-idle">
          <div className="idle-icon">⚔</div>
          <p>Adicione picks ao draft para ver sugestões de counters e sinergias.</p>
        </div>
      )}

      {hasAny && !hasAllied && hasEnemy && (
        <div className="panel-enemy-only">
          <div className="enemy-only-label">
            ⚔ Analisando composição inimiga — escolha um pick para ver counters completos
          </div>
        </div>
      )}

      {hasAny && (
        <div className="panel-body">
          {/* Left col: ban suggestions during ban phase, pick suggestions otherwise */}
          <div className="panel-col">
            {isBanPhase ? (
              <>
                <div className="section-title ban-title">
                  🚫 Sugestões de Ban
                  <span className="active-pos-hint"> — fase de banimentos</span>
                </div>
                <BanSuggestions
                  banSuggestions={banSuggestions}
                  allPoolSet={allPoolSet}
                  onBan={onBanSuggestion}
                />
              </>
            ) : (
              <>
                <div className="section-title">
                  Sugestões por Lane
                  {activePosition && (
                    <span className="active-pos-hint">
                      {' '}— {LANE_ICONS[activePosition]} {LANE_LABELS[activePosition]} em foco
                    </span>
                  )}
                </div>
                {hasLanes
                  ? <LaneSuggestions
                      byLane={byLane}
                      activePosition={activePosition}
                      poolByLane={poolByLane}
                      onPick={onPickSuggestion}
                    />
                  : <div className="empty-msg">Aguardando dados...</div>
                }
              </>
            )}
          </div>

          {/* Right col: counter analysis (always) */}
          <div className="panel-col">
            {hasCounters
              ? <CounterAnalysis
                  counterAnalysis={counterAnalysis}
                  allPoolSet={allPoolSet}
                  onPick={onPickSuggestion}
                />
              : (
                <div className="counter-placeholder">
                  <div className="section-title counter-title">⚔ Counters aos picks inimigos</div>
                  <div className="empty-msg">
                    {hasEnemy
                      ? 'Sem dados suficientes para os picks inimigos selecionados.'
                      : 'Adicione picks inimigos para ver counters específicos.'}
                  </div>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
