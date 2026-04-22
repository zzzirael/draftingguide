import { useState, useCallback, useEffect } from 'react'
import TeamSide from './TeamSide'
import ChampionPool from './ChampionPool'
import SuggestionPanel from './SuggestionPanel'
import './DraftBoard.css'

const EMPTY5 = () => Array(5).fill(null)

export default function DraftBoard({ champions, mySide, league, patch }) {
  const [bluePicks,  setBluePicks]  = useState(EMPTY5())
  const [redPicks,   setRedPicks]   = useState(EMPTY5())
  const [blueBans,   setBlueBans]   = useState(EMPTY5())
  const [redBans,    setRedBans]    = useState(EMPTY5())
  const [activeSlot, setActiveSlot] = useState(null) // { side, type, index }

  const [suggestions,     setSuggestions]     = useState([])
  const [winProbability,  setWinProbability]  = useState(null)
  const [loading,         setLoading]         = useState(false)

  const alliedPicks = mySide === 'blue' ? bluePicks : redPicks
  const enemyPicks  = mySide === 'blue' ? redPicks  : bluePicks

  const usedChampions = [
    ...bluePicks, ...redPicks, ...blueBans, ...redBans
  ].filter(Boolean)

  // Fetch suggestions whenever draft state changes
  const fetchSuggestions = useCallback(async (bp, rp, bb, rb) => {
    if (champions.length === 0) return
    const allied = mySide === 'blue' ? bp : rp
    const enemy  = mySide === 'blue' ? rp : bp
    const bans   = [...bb, ...rb].filter(Boolean)

    if (allied.filter(Boolean).length === 0) {
      setSuggestions([])
      setWinProbability(null)
      return
    }

    setLoading(true)
    try {
      const available = champions.filter(
        c => !bans.includes(c) && !bp.includes(c) && !rp.includes(c)
      )
      const res = await fetch('/suggest-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allied_picks:        allied.filter(Boolean),
          enemy_picks:         enemy.filter(Boolean),
          banned:              bans,
          available_champions: available,
          side:                mySide,
          league:              league || null,
          patch_major:         patch  || null,
          top_n:               8,
        }),
      })
      if (!res.ok) throw new Error('ML não disponível')
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setWinProbability(data.current_win_probability ?? null)
    } catch {
      setSuggestions([])
      setWinProbability(null)
    } finally {
      setLoading(false)
    }
  }, [champions, mySide, league, patch])

  // Re-fetch when filters change
  useEffect(() => {
    fetchSuggestions(bluePicks, redPicks, blueBans, redBans)
  }, [league, patch, mySide])

  const selectChampion = useCallback((champion) => {
    if (!activeSlot) return
    const { side, type, index } = activeSlot

    const setter = side === 'blue'
      ? (type === 'pick' ? setBluePicks : setBlueBans)
      : (type === 'pick' ? setRedPicks  : setRedBans)

    setter(prev => {
      const next = [...prev]
      next[index] = champion
      // trigger fetch with updated state
      const bp = side === 'blue' && type === 'pick' ? next : bluePicks
      const rp = side === 'red' && type === 'pick' ? next : redPicks
      const bb = side === 'blue' && type === 'ban'  ? next : blueBans
      const rb = side === 'red' && type === 'ban'   ? next : redBans
      setTimeout(() => fetchSuggestions(bp, rp, bb, rb), 0)
      return next
    })

    // advance to next empty slot automatically
    setActiveSlot(prev => {
      if (!prev) return null
      const arr = type === 'pick'
        ? (side === 'blue' ? bluePicks : redPicks)
        : (side === 'blue' ? blueBans  : redBans)
      const nextIdx = arr.findIndex((v, i) => i > index && !v)
      if (nextIdx === -1) return null
      return { side, type, index: nextIdx }
    })
  }, [activeSlot, bluePicks, redPicks, blueBans, redBans, fetchSuggestions])

  const removeChampion = useCallback((side, type, index) => {
    const setter = side === 'blue'
      ? (type === 'pick' ? setBluePicks : setBlueBans)
      : (type === 'pick' ? setRedPicks  : setRedBans)

    setter(prev => {
      const next = [...prev]
      next[index] = null
      const bp = side === 'blue' && type === 'pick' ? next : bluePicks
      const rp = side === 'red' && type === 'pick' ? next : redPicks
      const bb = side === 'blue' && type === 'ban'  ? next : blueBans
      const rb = side === 'red' && type === 'ban'   ? next : redBans
      setTimeout(() => fetchSuggestions(bp, rp, bb, rb), 0)
      return next
    })
  }, [bluePicks, redPicks, blueBans, redBans, fetchSuggestions])

  const handleSlotClick = useCallback((side, type, index) => {
    setActiveSlot(prev =>
      prev?.side === side && prev?.type === type && prev?.index === index
        ? null
        : { side, type, index }
    )
  }, [])

  // Pick suggestion directly into next available allied slot
  const handlePickSuggestion = useCallback((champion) => {
    const picks = mySide === 'blue' ? bluePicks : redPicks
    const nextIdx = picks.findIndex(v => !v)
    if (nextIdx === -1) return
    setActiveSlot({ side: mySide, type: 'pick', index: nextIdx })
    setTimeout(() => selectChampion(champion), 0)
  }, [mySide, bluePicks, redPicks, selectChampion])

  const resetDraft = () => {
    setBluePicks(EMPTY5()); setRedPicks(EMPTY5())
    setBlueBans(EMPTY5());  setRedBans(EMPTY5())
    setActiveSlot(null); setSuggestions([]); setWinProbability(null)
  }

  return (
    <div className="draft-root">
      <div className="draft-main">
        {/* Blue Side */}
        <TeamSide
          side="blue"
          isMySide={mySide === 'blue'}
          picks={bluePicks}
          bans={blueBans}
          activeSlot={activeSlot?.side === 'blue' ? activeSlot : null}
          onSlotClick={(type, index) => handleSlotClick('blue', type, index)}
          onRemove={(type, index) => removeChampion('blue', type, index)}
        />

        {/* Champion Pool */}
        <div className="pool-wrap">
          <ChampionPool
            champions={champions}
            usedChampions={usedChampions}
            onSelect={selectChampion}
            activeSlot={activeSlot}
          />
          <button className="reset-btn" onClick={resetDraft}>Resetar Draft</button>
        </div>

        {/* Red Side */}
        <TeamSide
          side="red"
          isMySide={mySide === 'red'}
          picks={redPicks}
          bans={redBans}
          activeSlot={activeSlot?.side === 'red' ? activeSlot : null}
          onSlotClick={(type, index) => handleSlotClick('red', type, index)}
          onRemove={(type, index) => removeChampion('red', type, index)}
        />
      </div>

      {/* Suggestions Panel */}
      <SuggestionPanel
        winProbability={winProbability}
        suggestions={suggestions}
        loading={loading}
        mySide={mySide}
        alliedPicks={alliedPicks}
        enemyPicks={enemyPicks}
        onPickSuggestion={handlePickSuggestion}
      />
    </div>
  )
}
