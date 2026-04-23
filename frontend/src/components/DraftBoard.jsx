import { useState, useCallback, useEffect } from 'react'
import TeamSide from './TeamSide'
import ChampionPool from './ChampionPool'
import SuggestionPanel from './SuggestionPanel'
import './DraftBoard.css'

const DRAFT_ORDER = [
  { step: 1,  phase: 'Banimentos — Fase 1', side: 'blue', type: 'ban',  index: 0 },
  { step: 2,  phase: 'Banimentos — Fase 1', side: 'red',  type: 'ban',  index: 0 },
  { step: 3,  phase: 'Banimentos — Fase 1', side: 'blue', type: 'ban',  index: 1 },
  { step: 4,  phase: 'Banimentos — Fase 1', side: 'red',  type: 'ban',  index: 1 },
  { step: 5,  phase: 'Banimentos — Fase 1', side: 'blue', type: 'ban',  index: 2 },
  { step: 6,  phase: 'Banimentos — Fase 1', side: 'red',  type: 'ban',  index: 2 },
  { step: 7,  phase: 'Picks — Fase 1', side: 'blue', type: 'pick', index: 0 },
  { step: 8,  phase: 'Picks — Fase 1', side: 'red',  type: 'pick', index: 0 },
  { step: 9,  phase: 'Picks — Fase 1', side: 'red',  type: 'pick', index: 1 },
  { step: 10, phase: 'Picks — Fase 1', side: 'blue', type: 'pick', index: 1 },
  { step: 11, phase: 'Picks — Fase 1', side: 'blue', type: 'pick', index: 2 },
  { step: 12, phase: 'Picks — Fase 1', side: 'red',  type: 'pick', index: 2 },
  { step: 13, phase: 'Banimentos — Fase 2', side: 'red',  type: 'ban',  index: 3 },
  { step: 14, phase: 'Banimentos — Fase 2', side: 'blue', type: 'ban',  index: 3 },
  { step: 15, phase: 'Banimentos — Fase 2', side: 'red',  type: 'ban',  index: 4 },
  { step: 16, phase: 'Banimentos — Fase 2', side: 'blue', type: 'ban',  index: 4 },
  { step: 17, phase: 'Picks — Fase 2', side: 'red',  type: 'pick', index: 3 },
  { step: 18, phase: 'Picks — Fase 2', side: 'blue', type: 'pick', index: 3 },
  { step: 19, phase: 'Picks — Fase 2', side: 'blue', type: 'pick', index: 4 },
  { step: 20, phase: 'Picks — Fase 2', side: 'red',  type: 'pick', index: 4 },
]

const PHASE_COLORS = {
  'Banimentos — Fase 1': '#7a1a1a',
  'Picks — Fase 1':      '#1a4a7a',
  'Banimentos — Fase 2': '#7a1a1a',
  'Picks — Fase 2':      '#1a4a7a',
}

const EMPTY5      = () => Array(5).fill(null)
const EMPTY_LANES = () => Array(5).fill('')

function buildSlotOrderMap() {
  const map = {}
  DRAFT_ORDER.forEach(d => { map[`${d.side}-${d.type}-${d.index}`] = d.step })
  return map
}
const SLOT_ORDER_MAP = buildSlotOrderMap()

export default function DraftBoard({ champions, mySide, league, patch }) {
  const [bluePicks, setBluePicks] = useState(EMPTY5())
  const [redPicks,  setRedPicks]  = useState(EMPTY5())
  const [blueBans,  setBlueBans]  = useState(EMPTY5())
  const [redBans,   setRedBans]   = useState(EMPTY5())

  const [bluePickLanes, setBluePickLanes] = useState(EMPTY_LANES())
  const [redPickLanes,  setRedPickLanes]  = useState(EMPTY_LANES())

  const [draftStep,  setDraftStep]  = useState(0)
  const [activeSlot, setActiveSlot] = useState(DRAFT_ORDER[0])

  const [suggestions,     setSuggestions]     = useState([])
  const [byLane,          setByLane]          = useState({})
  const [counterAnalysis, setCounterAnalysis] = useState([])
  const [winProbability,  setWinProbability]  = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [activePosition,  setActivePosition]  = useState(null)

  const alliedPicks   = mySide === 'blue' ? bluePicks : redPicks
  const enemyPicks    = mySide === 'blue' ? redPicks  : bluePicks
  const usedChampions = [...bluePicks, ...redPicks, ...blueBans, ...redBans].filter(Boolean)

  const currentDraftEntry = DRAFT_ORDER[draftStep] ?? null
  const isDraftComplete   = draftStep >= DRAFT_ORDER.length

  const advanceDraftStep = useCallback((bp, rp, bb, rb, fromStep) => {
    let next = fromStep
    while (next < DRAFT_ORDER.length) {
      const d   = DRAFT_ORDER[next]
      const arr = d.side === 'blue'
        ? (d.type === 'pick' ? bp : bb)
        : (d.type === 'pick' ? rp : rb)
      if (!arr[d.index]) break
      next++
    }
    if (next < DRAFT_ORDER.length) {
      setDraftStep(next)
      setActiveSlot(DRAFT_ORDER[next])
    } else {
      setDraftStep(DRAFT_ORDER.length)
      setActiveSlot(null)
    }
  }, [])

  // Triggers whenever either allied OR enemy picks exist — not just allied
  const fetchSuggestions = useCallback(async (bp, rp, bb, rb, slotEntry, laneOverride = null) => {
    if (champions.length === 0) return
    const allied = (mySide === 'blue' ? bp : rp).filter(Boolean)
    const enemy  = (mySide === 'blue' ? rp : bp).filter(Boolean)
    const bans   = [...bb, ...rb].filter(Boolean)

    if (allied.length === 0 && enemy.length === 0) {
      setSuggestions([]); setByLane({}); setCounterAnalysis([]); setWinProbability(null)
      return
    }

    const pos = laneOverride ?? (slotEntry?.type === 'pick' ? (slotEntry.position ?? null) : null)
    setActivePosition(pos)
    setLoading(true)
    try {
      const available = champions.filter(c => !bans.includes(c) && !bp.includes(c) && !rp.includes(c))
      const res = await fetch('/suggest-ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allied_picks:        allied,
          enemy_picks:         enemy,
          banned:              bans,
          available_champions: available,
          side:                mySide,
          league:              league || null,
          patch_major:         patch  || null,
          active_position:     pos,
          top_n:               15,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setByLane(data.by_lane || {})
      setCounterAnalysis(data.counter_analysis || [])
      setWinProbability(data.current_win_probability ?? null)
    } catch {
      setSuggestions([]); setByLane({}); setCounterAnalysis([]); setWinProbability(null)
    } finally {
      setLoading(false)
    }
  }, [champions, mySide, league, patch])

  useEffect(() => {
    fetchSuggestions(bluePicks, redPicks, blueBans, redBans, activeSlot)
  }, [league, patch, mySide])

  const selectChampion = useCallback((champion) => {
    if (!activeSlot) return
    const { side, type, index } = activeSlot

    const update = (prev) => { const n = [...prev]; n[index] = champion; return n }

    let bp = bluePicks, rp = redPicks, bb = blueBans, rb = redBans
    if      (side === 'blue' && type === 'pick') { bp = update(bluePicks); setBluePicks(bp) }
    else if (side === 'red'  && type === 'pick') { rp = update(redPicks);  setRedPicks(rp)  }
    else if (side === 'blue' && type === 'ban')  { bb = update(blueBans);  setBlueBans(bb)  }
    else if (side === 'red'  && type === 'ban')  { rb = update(redBans);   setRedBans(rb)   }

    const nextStep = DRAFT_ORDER.findIndex((d, i) =>
      i > draftStep &&
      !(d.side === 'blue' && d.type === 'pick' ? bp
        : d.side === 'red' && d.type === 'pick' ? rp
        : d.side === 'blue' ? bb : rb)[d.index]
    )
    const next      = nextStep === -1 ? DRAFT_ORDER.length : nextStep
    const nextEntry = DRAFT_ORDER[next] ?? null
    setDraftStep(next)
    setActiveSlot(nextEntry)
    fetchSuggestions(bp, rp, bb, rb, nextEntry)
  }, [activeSlot, draftStep, bluePicks, redPicks, blueBans, redBans, fetchSuggestions])

  const removeChampion = useCallback((side, type, index) => {
    const update = (prev) => { const n = [...prev]; n[index] = null; return n }
    let bp = bluePicks, rp = redPicks, bb = blueBans, rb = redBans
    if      (side === 'blue' && type === 'pick') { bp = update(bluePicks); setBluePicks(bp) }
    else if (side === 'red'  && type === 'pick') { rp = update(redPicks);  setRedPicks(rp)  }
    else if (side === 'blue' && type === 'ban')  { bb = update(blueBans);  setBlueBans(bb)  }
    else if (side === 'red'  && type === 'ban')  { rb = update(redBans);   setRedBans(rb)   }
    advanceDraftStep(bp, rp, bb, rb, 0)
    fetchSuggestions(bp, rp, bb, rb, DRAFT_ORDER[0])
  }, [bluePicks, redPicks, blueBans, redBans, advanceDraftStep, fetchSuggestions])

  const handleSlotClick = useCallback((side, type, index) => {
    const clicked = DRAFT_ORDER.find(d => d.side === side && d.type === type && d.index === index)
    setActiveSlot(prev =>
      prev?.side === side && prev?.type === type && prev?.index === index
        ? null
        : (clicked ?? { side, type, index })
    )
  }, [])

  const handleLaneChange = useCallback((side, index, lane) => {
    if (side === 'blue') {
      setBluePickLanes(prev => { const n = [...prev]; n[index] = lane; return n })
    } else {
      setRedPickLanes(prev => { const n = [...prev]; n[index] = lane; return n })
    }
    // If this is the active pick slot, re-fetch with the newly chosen lane as active_position
    if (activeSlot?.side === side && activeSlot?.index === index && activeSlot?.type === 'pick') {
      fetchSuggestions(bluePicks, redPicks, blueBans, redBans, activeSlot, lane)
    }
  }, [activeSlot, bluePicks, redPicks, blueBans, redBans, fetchSuggestions])

  const handlePickSuggestion = useCallback((champion) => {
    if (!activeSlot || activeSlot.type !== 'pick' || activeSlot.side !== mySide) {
      const nextMySlot = DRAFT_ORDER.find(d =>
        d.side === mySide && d.type === 'pick' &&
        !(mySide === 'blue' ? bluePicks : redPicks)[d.index]
      )
      if (nextMySlot) setActiveSlot(nextMySlot)
    }
    setTimeout(() => selectChampion(champion), 0)
  }, [activeSlot, mySide, bluePicks, redPicks, selectChampion])

  const resetDraft = () => {
    setBluePicks(EMPTY5());      setRedPicks(EMPTY5())
    setBlueBans(EMPTY5());       setRedBans(EMPTY5())
    setBluePickLanes(EMPTY_LANES()); setRedPickLanes(EMPTY_LANES())
    setDraftStep(0);             setActiveSlot(DRAFT_ORDER[0])
    setSuggestions([]);          setByLane({})
    setCounterAnalysis([]);      setWinProbability(null)
    setActivePosition(null)
  }

  const currentPhase = currentDraftEntry?.phase ?? (isDraftComplete ? 'Draft Completo' : '')
  const phaseColor   = PHASE_COLORS[currentPhase] ?? '#1e2d40'

  return (
    <div className="draft-root">
      <div className="phase-bar" style={{ borderColor: phaseColor }}>
        <div className="phase-steps">
          {DRAFT_ORDER.map((d, i) => (
            <div
              key={i}
              className={`phase-dot ${d.type} ${d.side} ${i === draftStep ? 'current' : ''} ${i < draftStep ? 'done' : ''}`}
              title={`${d.step}. ${d.side === 'blue' ? 'Azul' : 'Vermelho'} — ${d.type === 'ban' ? 'Ban' : 'Pick'}`}
            />
          ))}
        </div>
        <span className="phase-label" style={{ color: phaseColor === '#1e2d40' ? '#785a28' : phaseColor }}>
          {isDraftComplete
            ? '✓ Draft Completo'
            : `Passo ${currentDraftEntry?.step ?? '—'} — ${currentPhase} — ${currentDraftEntry?.side === 'blue' ? 'Time Azul' : 'Time Vermelho'}`
          }
        </span>
        <button className="reset-btn-inline" onClick={resetDraft}>Resetar</button>
      </div>

      <div className="draft-main">
        <TeamSide
          side="blue"
          isMySide={mySide === 'blue'}
          picks={bluePicks}
          bans={blueBans}
          lanes={bluePickLanes}
          activeSlot={activeSlot?.side === 'blue' ? activeSlot : null}
          currentDraftSlot={currentDraftEntry?.side === 'blue' ? currentDraftEntry : null}
          slotOrderMap={SLOT_ORDER_MAP}
          onSlotClick={(type, index) => handleSlotClick('blue', type, index)}
          onRemove={(type, index) => removeChampion('blue', type, index)}
          onLaneChange={(index, lane) => handleLaneChange('blue', index, lane)}
        />

        <div className="pool-wrap">
          <ChampionPool
            champions={champions}
            usedChampions={usedChampions}
            onSelect={selectChampion}
            activeSlot={activeSlot}
          />
        </div>

        <TeamSide
          side="red"
          isMySide={mySide === 'red'}
          picks={redPicks}
          bans={redBans}
          lanes={redPickLanes}
          activeSlot={activeSlot?.side === 'red' ? activeSlot : null}
          currentDraftSlot={currentDraftEntry?.side === 'red' ? currentDraftEntry : null}
          slotOrderMap={SLOT_ORDER_MAP}
          onSlotClick={(type, index) => handleSlotClick('red', type, index)}
          onRemove={(type, index) => removeChampion('red', type, index)}
          onLaneChange={(index, lane) => handleLaneChange('red', index, lane)}
        />
      </div>

      <SuggestionPanel
        winProbability={winProbability}
        suggestions={suggestions}
        byLane={byLane}
        counterAnalysis={counterAnalysis}
        loading={loading}
        mySide={mySide}
        alliedPicks={alliedPicks}
        enemyPicks={enemyPicks}
        activeSlot={activeSlot}
        activePosition={activePosition}
        onPickSuggestion={handlePickSuggestion}
      />
    </div>
  )
}
