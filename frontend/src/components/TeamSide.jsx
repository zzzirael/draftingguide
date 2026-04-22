import './TeamSide.css'

const POSITIONS = ['Top', 'Jng', 'Mid', 'Bot', 'Sup']

function ChampAvatar({ name, side }) {
  if (!name) return null
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className={`champ-avatar ${side}`} title={name}>
      <span>{initials}</span>
    </div>
  )
}

export default function TeamSide({
  side,        // 'blue' | 'red'
  isMySide,
  picks,       // array of champion names (up to 5)
  bans,        // array of champion names (up to 5)
  activeSlot,  // { type: 'pick'|'ban', index: number } | null
  onSlotClick,
  onRemove,
}) {
  const isBlue = side === 'blue'

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
          const isActive = activeSlot?.type === 'ban' && activeSlot?.index === i
          return (
            <div
              key={i}
              className={`ban-slot ${isActive ? 'active' : ''} ${bans[i] ? 'filled' : ''}`}
              onClick={() => onSlotClick('ban', i)}
              title={bans[i] || 'Banimento'}
            >
              {bans[i] ? (
                <>
                  <span className="ban-name">{bans[i].slice(0, 4)}</span>
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
          const isActive = activeSlot?.type === 'pick' && activeSlot?.index === i
          const champ    = picks[i]
          return (
            <div
              key={i}
              className={`pick-slot ${side} ${isActive ? 'active' : ''} ${champ ? 'filled' : ''}`}
              onClick={() => onSlotClick('pick', i)}
            >
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
                  <span className="pick-empty-label">Selecionar campeão</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
