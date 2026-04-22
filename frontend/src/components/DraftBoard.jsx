import { useState, useCallback, useEffect, useMemo } from 'react'
import TeamSide from './TeamSide'
import ChampionPool from './ChampionPool'
import SuggestionPanel from './SuggestionPanel'
import './DraftBoard.css'

// Ordem oficial do draft competitivo do LoL (20 passos)
const DRAFT_ORDER = [
  // Ban Phase 1 — alternando azul/vermelho
  { step: 1,  phase: 'Banimentos — Fase 1', side: 'blue', type: 'ban',  index: 0 },
  { step: 2,  phase: 'Banimentos — Fase 1', side: 'red',  type: 'ban',  index: 0 },
  { step: 3,  phase: 'Banimentos — Fase 1', side: 'blue', type: 'ban',  index: 1 },
  { step: 4,  phase: 'Banimentos — Fase 1', side: 'red',  type: 'ban',  index: 1 },
  { step: 5,  phase: 'Banimentos — Fase 1', side: 'blue', type: 'ban',  index: 2 },
  { step: 6,  phase: 'Banimentos — Fase 1', side: 'red',  type: 'ban',  index: 2 },
  // Pick Phase 1
  { step: 7,  phase: 'Picks — Fase 1', side: 'blue', type: 'pick', index: 0, position: 'top' },
  { step: 8,  phase: 'Picks — Fase 1', side: 'red',  type: 'pick', index: 0, position: 'top' },
  { step: 9,  phase: 'Picks — Fase 1', side: 'red',  type: 'pick', index: 1, position: 'jng' },
  { step: 10, phase: 'Picks — Fase 1', side: 'blue', type: 'pick', index: 1, position: 'jng' },
  { step: 11, phase: 'Picks — Fase 1', side: 'blue', type: 'pick', index: 2, position: 'mid' },
  { step: 12, phase: 'Picks — Fase 1', side: 'red',  type: 'pick', index: 2, position: 'mid' },
  // Ban Phase 2 — vermelho primeiro
  { step: 13, phase: 'Banimentos — Fase 2', side: 'red',  type: 'ban',  index: 3 },
  { step: 14, phase: 'Banimentos — Fase 2', side: 'blue', type: 'ban',  index: 3 },
  { step: 15, phase: 'Banimentos — Fase 2', side: 'red',  type: 'ban',  index: 4 },
  { step: 16, phase: 'Banimentos — Fase 2', side: 'blue', type: 'ban',  index: 4 },
  // Pick Phase 2
  { step: 17, phase: 'Picks — Fase 2', side: 'red',  type: 'pick', index: 3, position: 'bot' },
  { step: 18, phase: 'Picks — Fase 2', side: 'blue', type: 'pick', index: 3, position: 'bot' },
  { step: 19, phase: 'Picks — Fase 2', side: 'blue', type: 'pick', index: 4, position: 'sup' },
  { step: 20, phase: 'Picks — Fase 2', side: 'red',  type: 'pick', index: 4, position: 'sup' },
]

const PHASE_COLORS = {
  'Banimentos — Fase 1': '#7a1a1a',
  'Picks — Fase 1':      '#1a4a7a',
  'Banimentos — Fase 2': '#7a1a1a',
  'Picks — Fase 2':      '#1a4a7a',
}

const EMPTY5 = () => Array(5).fill(null)

// Monta slot de pick order por { side, type, index }
function buildSlotOrderMap() {
  const map = {}
  DRAFT_ORDER.forEach(d => {
    const key = `${d.side}-${d.type}-${d.index}`
    map[key] = d.step
  })
  return map
}
const SLOT_ORDER_MAP = buildSlotOrderMap()

export default function DraftBoard({ champions, mySide, league, patch }) {
  const [bluePicks, setBluePicks] = useState(EMPTY5())
  const [redPicks,  setRedPicks]  = useState(EMPTY5())
  const [blueBans,  setBlueBans]  = useState(EMPTY5())
  const [redBans,   setRedBans]   = useState(EMPTY5())

  const [draftStep,  setDraftStep]  = useState(0)  // 0-based index into DRAFT_ORDER
  const [activeSlot, setActiveSlot] = useState(DRAFT_ORDER[0])  // follows draft order or manual click

  const [suggestions,    setSuggestions]    = useState([])
  const [byLane,         setByLane]         = useState({})
  const [counterAnalysis, setCounterAnalysis] = useState([])
  const [winProbability, setWinProbability] = useState(null)
  const [loading,        setLoading]        = useState(false)

  const alliedPicks = mySide === 'blue' ? bluePicks : redPicks
  const enemyPicks  = mySide === 'blue' ? redPicks  : bluePicks
  const usedChampions = [...bluePicks, ...redPicks, ...blueBans, ...redBans].filter(Boolean)

  const currentDraftEntry = DRAFT_ORDER[draftStep] ?? null
  const isDraftComplete   = draftStep >= DRAFT_ORDER.length

  // Advance draft step to next unfilled slot
  const advanceDraftStep = useCallback((bp, rp, bb, rb, fromStep) => {
    let next = fromStep
    while (next < DRAFT_ORDER.length) {
      const d = DRAFT_ORDER[next]
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

  const fetchSuggestions = useCallback(async (bp, rp, bb, rb, slotEntry) => {
    if (champions.length === 0) return
    const allied = (mySide === 'blue' ? bp : rp).filter(Boolean)
    const enemy  = (mySide === 'blue' ? rp : bp).filter(Boolean)
    const bans   = [...bb, ...rb].filter(Boolean)
    if (allied.length === 0) { setSuggestions([]); setByLane({}); setCounterAnalysis([]); setWinProbability(null); return }

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
          active_position:     slotEntry?.position ?? null,
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
    if (side === 'blue' && type === 'pick') { bp = update(bluePicks); setBluePicks(bp) }
    else if (side === 'red'  && type === 'pick') { rp = update(redPicks);  setRedPicks(rp)  }
    else if (side === 'blue' && type === 'ban')  { bb = update(blueBans);  setBlueBans(bb)  }
    else if (side === 'red'  && type === 'ban')  { rb = update(redBans);   setRedBans(rb)   }

    const nextStep = DRAFT_ORDER.findIndex((d, i) =>
      i > draftStep &&
      !(d.side === 'blue' && d.type === 'pick' ? bp : d.side === 'red' && d.type === 'pick' ? rp : d.side === 'blue' ? bb : rb)[d.index]
    )
    const next = nextStep === -1 ? DRAFT_ORDER.length : nextStep
    const nextEntry = DRAFT_ORDER[next] ?? null
    setDraftStep(next)
    setActiveSlot(nextEntry)
    fetchSuggestions(bp, rp, bb, rb, nextEntry)
  }, [activeSlot, draftStep, bluePicks, redPicks, blueBans, redBans, fetchSuggestions])

  const removeChampion = useCallback((side, type, index) => {
    const update = (prev) => { const n = [...prev]; n[index] = null; return n }
    let bp = bluePicks, rp = redPicks, bb = blueBans, rb = redBans
    if (side === 'blue' && type === 'pick') { bp = update(bluePicks); setBluePicks(bp) }
    else if (side === 'red'  && type === 'pick') { rp = update(redPicks);  setRedPicks(rp)  }
    else if (side === 'blue' && type === 'ban')  { bb = update(blueBans);  setBlueBans(bb)  }
    else if (side === 'red'  && type === 'ban')  { rb = update(redBans);   setRedBans(rb)   }
    advanceDraftStep(bp, rp, bb, rb, 0)
    fetchSuggestions(bp, rp, bb, rb, DRAFT_ORDER[0])
  }, [bluePicks, redPicks, blueBans, redBans, advanceDraftStep, fetchSuggestions])

  const handleSlotClick = useCallback((side, type, index) => {
    const clicked = DRAFT_ORDER.find(d => d.side === side && d.type === type && d.index === index)
    setActiveSlot(prev =>
      prev?.side === side && prev?.type === type && prev?.index === index ? null : (clicked ?? { side, type, index })
    )
  }, [])

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
    setBluePicks(EMPTY5()); setRedPicks(EMPTY5())
    setBlueBans(EMPTY5());  setRedBans(EMPTY5())
    setDraftStep(0); setActiveSlot(DRAFT_ORDER[0])
    setSuggestions([]); setByLane({}); setCounterAnalysis([]); setWinProbability(null)
  }

  const currentPhase = currentDraftEntry?.phase ?? (isDraftComplete ? 'Draft Completo' : '')
  const phaseColor   = PHASE_COLORS[currentPhase] ?? '#1e2d40'

  return (
    <div className="draft-root">
      {/* Phase indicator */}
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
            : `Passo ${(currentDraftEntry?.step ?? '—')} — ${currentPhase} — ${currentDraftEntry?.side === 'blue' ? 'Time Azul' : 'Time Vermelho'}`
          }
        </span>
      </div>

      <div className="draft-main">
        <TeamSide
          side="blue"
          isMySide={mySide === 'blue'}
          picks={bluePicks}
          bans={blueBans}
          activeSlot={activeSlot?.side === 'blue' ? activeSlot : null}
          currentDraftSlot={currentDraftEntry?.side === 'blue' ? currentDraftEntry : null}
          slotOrderMap={SLOT_ORDER_MAP}
          onSlotClick={(type, index) => handleSlotClick('blue', type, index)}
          onRemove={(type, index) => removeChampion('blue', type, index)}
        />

        <div className="pool-wrap">
          <ChampionPool
            champions={champions}
            usedChampions={usedChampions}
            onSelect={selectChampion}
            activeSlot={activeSlot}
          />
          <button className="reset-btn" onClick={resetDraft}>Resetar Draft</button>
        </div>

        <TeamSide
          side="red"
          isMySide={mySide === 'red'}
          picks={redPicks}
          bans={redBans}
          activeSlot={activeSlot?.side === 'red' ? activeSlot : null}
          currentDraftSlot={currentDraftEntry?.side === 'red' ? currentDraftEntry : null}
          slotOrderMap={SLOT_ORDER_MAP}
          onSlotClick={(type, index) => handleSlotClick('red', type, index)}
          onRemove={(type, index) => removeChampion('red', type, index)}
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
        onPickSuggestion={handlePickSuggestion}
      />
    </div>
  )
}
