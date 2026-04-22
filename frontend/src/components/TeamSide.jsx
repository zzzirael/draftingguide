import './TeamSide.css'

const POSITIONS = ['Top', 'Jng', 'Mid', 'Bot', 'Sup']

function ChampAvatar({ name, side }) {
  if (!name) return null
  return (
    <div className={`champ-avatar ${side}`} title={name}>
      <span>{name.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

export default function TeamSide({
  side,
  isMySide,
  picks,
  bans,
  activeSlot,
  currentDraftSlot,   // slot atual na ordem do draft (pulse)
  slotOrderMap,       // { 'blue-pick-0': 7, ... }
  onSlotClick,
  onRemove,
}) {
  const isBlue = side === 'blue'

  const isCurrentDraft = (type, index) =>
    currentDraftSlot?.type === type && currentDraftSlot?.index === index

  const isActive = (type, index) =>
    activeSlot?.type === type && activeSlot?.index === index

  const orderNum = (type, index) =>
    slotOrderMap?.[`${side}-${type}-${index}`] ?? null

  return (
    <div className={`team-side ${side}-side`}>
      <div className="team-header">
        <span className={`team-label ${side}-label`}>
          {isBlue ? '🔵 Time Azul' : '🔴 Time Vermelho'}
        </span>
        {isMySide && <span className="my-team-badge">SEU TIME</span>}
      </div>

      {/* Bans */}
      <div className="bans-row">
        {Array.from({ length: 5 }).map((_, i) => {
          const isDraft  = isCurrentDraft('ban', i)
          const isAct    = isActive('ban', i)
          const num      = orderNum('ban', i)
          return (
            <div
              key={i}
              className={`ban-slot ${isAct ? 'active' : ''} ${isDraft ? 'draft-current' : ''} ${bans[i] ? 'filled' : ''}`}
              onClick={() => onSlotClick('ban', i)}
              title={bans[i] || `Ban ${i + 1}`}
            >
              {num && !bans[i] && <span className="slot-order-num">{num}</span>}
              {bans[i] ? (
                <>
                  <span className="ban-name">{bans[i].slice(0, 5)}</span>
                  <button className="remove-btn" onClick={e => { e.stopPropagation(); onRemove('ban', i) }}>×</button>
                </>
              ) : (
                <span className="ban-empty">Ban</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Picks */}
      <div className="picks-col">
        {Array.from({ length: 5 }).map((_, i) => {
          const isDraft = isCurrentDraft('pick', i)
          const isAct   = isActive('pick', i)
          const champ   = picks[i]
          const num     = orderNum('pick', i)
          return (
            <div
              key={i}
              className={`pick-slot ${side} ${isAct ? 'active' : ''} ${isDraft ? 'draft-current' : ''} ${champ ? 'filled' : ''}`}
              onClick={() => onSlotClick('pick', i)}
            >
              {num && !champ && (
                <span className={`slot-order-num pick-order ${isDraft ? 'order-current' : ''}`}>{num}</span>
              )}

              {champ ? (
                <>
                  <ChampAvatar name={champ} side={side} />
                  <div className="pick-info">
                    <span className="pick-champ">{champ}</span>
                    <span className="pick-pos">{POSITIONS[i]}</span>
                  </div>
                  <button className="remove-btn" onClick={e => { e.stopPropagation(); onRemove('pick', i) }}>×</button>
                </>
              ) : (
                <>
                  <div className={`pick-empty-avatar ${side}`}>{POSITIONS[i]}</div>
                  <span className="pick-empty-label">
                    {isDraft ? 'Vez de escolher...' : 'Selecionar campeão'}
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
