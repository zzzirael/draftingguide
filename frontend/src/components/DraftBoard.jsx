import { useState } from 'react'
import ChampionGrid from './ChampionGrid'
import SuggestionCard from './SuggestionCard'
import './DraftBoard.css'

const POSITIONS = ['top', 'jng', 'mid', 'bot', 'sup']

export default function DraftBoard({ champions, league, patch }) {
  const [alliedPicks, setAlliedPicks] = useState([])
  const [enemyPicks, setEnemyPicks] = useState([])
  const [banned, setBanned] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeSlot, setActiveSlot] = useState(null) // { team: 'ally'|'enemy'|'ban', index }
  const [search, setSearch] = useState('')

  const usedChampions = [...alliedPicks, ...enemyPicks, ...banned]
  const filteredChampions = champions.filter(c =>
    !usedChampions.includes(c) &&
    c.toLowerCase().includes(search.toLowerCase())
  )

  const fetchSuggestions = async (allied, enemy, bans) => {
    if (champions.length === 0) return
    setLoading(true)
    try {
      const available = champions.filter(c => !bans.includes(c) && !allied.includes(c) && !enemy.includes(c))
      const res = await fetch('/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allied_picks: allied,
          enemy_picks: enemy,
          banned: bans,
          available_champions: available,
          league: league || null,
          patch_major: patch || null,
          top_n: 10,
        })
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const selectChampion = (champion) => {
    if (!activeSlot) return
    const { team, index } = activeSlot

    let newAllied = [...alliedPicks]
    let newEnemy = [...enemyPicks]
    let newBanned = [...banned]

    if (team === 'ally') {
      newAllied[index] = champion
      setAlliedPicks(newAllied)
    } else if (team === 'enemy') {
      newEnemy[index] = champion
      setEnemyPicks(newEnemy)
    } else if (team === 'ban') {
      newBanned[index] = champion
      setBanned(newBanned)
    }

    setActiveSlot(null)
    setSearch('')
    fetchSuggestions(
      team === 'ally' ? newAllied.filter(Boolean) : alliedPicks.filter(Boolean),
      team === 'enemy' ? newEnemy.filter(Boolean) : enemyPicks.filter(Boolean),
      team === 'ban' ? newBanned.filter(Boolean) : banned.filter(Boolean),
    )
  }

  const removeChampion = (team, index) => {
    if (team === 'ally') {
      const next = [...alliedPicks]
      next.splice(index, 1)
      setAlliedPicks(next)
      fetchSuggestions(next.filter(Boolean), enemyPicks.filter(Boolean), banned.filter(Boolean))
    } else if (team === 'enemy') {
      const next = [...enemyPicks]
      next.splice(index, 1)
      setEnemyPicks(next)
      fetchSuggestions(alliedPicks.filter(Boolean), next.filter(Boolean), banned.filter(Boolean))
    } else {
      const next = [...banned]
      next.splice(index, 1)
      setBanned(next)
      fetchSuggestions(alliedPicks.filter(Boolean), enemyPicks.filter(Boolean), next.filter(Boolean))
    }
  }

  const isActive = (team, index) => activeSlot?.team === team && activeSlot?.index === index

  const renderSlots = (team, picks, max, label) => (
    <div className="slot-group">
      <div className="slot-label">{label}</div>
      <div className="slots">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`slot ${isActive(team, i) ? 'slot-active' : ''} ${picks[i] ? 'slot-filled' : ''}`}
            onClick={() => setActiveSlot({ team, index: i })}
          >
            {picks[i] ? (
              <>
                <span className="slot-champ">{picks[i]}</span>
                <button className="slot-remove" onClick={e => { e.stopPropagation(); removeChampion(team, i) }}>×</button>
              </>
            ) : (
              <span className="slot-empty">{team === 'ban' ? 'Ban' : POSITIONS[i] || '+'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="draft-board">
      <div className="draft-left">
        {renderSlots('ally', alliedPicks, 5, 'Time Aliado')}
        {renderSlots('ban', banned, 10, 'Banimentos')}
        {renderSlots('enemy', enemyPicks, 5, 'Time Inimigo')}

        {activeSlot && (
          <div className="champion-search">
            <input
              autoFocus
              placeholder="Buscar campeão..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <ChampionGrid champions={filteredChampions} onSelect={selectChampion} />
          </div>
        )}
      </div>

      <div className="draft-right">
        <h2>Sugestões</h2>
        {loading && <div className="loading">Calculando...</div>}
        {!loading && suggestions.length === 0 && (
          <div className="empty-state">Selecione picks para ver sugestões</div>
        )}
        {suggestions.map((s, i) => (
          <SuggestionCard key={s.champion} rank={i + 1} data={s} />
        ))}
      </div>
    </div>
  )
}
