import { useState, useMemo } from 'react'
import './ChampionPool.css'

export default function ChampionPool({ champions, usedChampions, onSelect, activeSlot }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const used = new Set(usedChampions)
    return champions.filter(c =>
      !used.has(c) &&
      c.toLowerCase().includes(search.toLowerCase())
    )
  }, [champions, usedChampions, search])

  if (!activeSlot) {
    return (
      <div className="pool-idle">
        <div className="pool-idle-icon">⚔</div>
        <p>Clique em um slot de pick ou ban<br />para selecionar um campeão</p>
      </div>
    )
  }

  const slotLabel = activeSlot.type === 'ban'
    ? `Ban ${activeSlot.index + 1} — ${activeSlot.side === 'blue' ? 'Time Azul' : 'Time Vermelho'}`
    : `Pick ${activeSlot.index + 1} — ${activeSlot.side === 'blue' ? 'Time Azul' : 'Time Vermelho'}`

  return (
    <div className="champion-pool">
      <div className="pool-header">
        <span className={`pool-slot-label ${activeSlot.side}`}>{slotLabel}</span>
        <input
          autoFocus
          className="pool-search"
          placeholder="Buscar campeão..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="pool-empty">Nenhum campeão encontrado</div>
      ) : (
        <div className="pool-grid">
          {filtered.map(name => (
            <button
              key={name}
              className={`pool-champ ${activeSlot.type === 'ban' ? 'ban-mode' : ''}`}
              onClick={() => onSelect(name)}
              title={name}
            >
              <div className="pool-avatar">{name.slice(0, 2)}</div>
              <span className="pool-name">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
