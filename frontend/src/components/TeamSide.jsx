import { champLoadingUrl } from '../utils/ddragon'
import ChampImg from './ChampImg'
import './TeamSide.css'

const LANE_OPTIONS = [
  { key: 'top', icon: '🗡', label: 'Top' },
  { key: 'jng', icon: '🌲', label: 'Jng' },
  { key: 'mid', icon: '⚡', label: 'Mid' },
  { key: 'bot', icon: '🏹', label: 'Bot' },
  { key: 'sup', icon: '🛡', label: 'Sup' },
]

const LANE_MAP = Object.fromEntries(LANE_OPTIONS.map(l => [l.key, l]))

function LanePicker({ value, onChange, side }) {
  return (
    <div className="lane-picker" onClick={e => e.stopPropagation()}>
      {LANE_OPTIONS.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`lane-btn ${value === key ? `sel-${side}` : ''}`}
          title={label}
          onClick={e => { e.stopPropagation(); onChange(value === key ? '' : key) }}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}

export default function TeamSide({
  side,
  isMySide,
  picks,
  bans,
  lanes,
  activeSlot,
  currentDraftSlot,
  slotOrderMap,
  onSlotClick,
  onRemove,
  onLaneChange,
}) {
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
          {side === 'blue' ? '🔵 Time Azul' : '🔴 Time Vermelho'}
        </span>
        {isMySide && <span className="my-team-badge">SEU TIME</span>}
      </div>

      {/* Bans */}
      <div className="bans-row">
        {Array.from({ length: 5 }).map((_, i) => {
          const isDraft = isCurrentDraft('ban', i)
          const isAct   = isActive('ban', i)
          const num     = orderNum('ban', i)
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
                  <ChampImg name={bans[i]} className="ban-champ-icon" />
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
          const lane    = lanes?.[i] || ''
          const laneInfo = LANE_MAP[lane]
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
                  {/* Cinematic loading art background */}
                  <div
                    className="pick-art"
                    style={{ backgroundImage: `url(${champLoadingUrl(champ)})` }}
                  />
                  {/* Gradient overlay + content */}
                  <div className="pick-overlay">
                    <div className="pick-info">
                      <span className="pick-champ">{champ}</span>
                      {laneInfo && (
                        <span className={`pick-lane-tag ${side}`}>
                          {laneInfo.icon} {laneInfo.label}
                        </span>
                      )}
                    </div>
                    <LanePicker value={lane} onChange={v => onLaneChange(i, v)} side={side} />
                    <button className="remove-btn" onClick={e => { e.stopPropagation(); onRemove('pick', i) }}>×</button>
                  </div>
                </>
              ) : (
                <div className="pick-empty-row">
                  <div className={`pick-empty-avatar ${side}`}>
                    {laneInfo ? laneInfo.icon : '·'}
                  </div>
                  <span className="pick-empty-label">
                    {isDraft ? 'Vez de escolher...' : 'Selecionar campeão'}
                  </span>
                  <LanePicker value={lane} onChange={v => onLaneChange(i, v)} side={side} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
