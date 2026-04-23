import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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

const LANE_ICONS  = { top: '🗡', jng: '🌲', mid: '⚡', bot: '🏹', sup: '🛡' }
const LANE_ORDER  = ['top', 'jng', 'mid', 'bot', 'sup']

// ── MatchupBar ────────────────────────────────────────────────────────────────
function MatchupBar({ items, mySide }) {
  if (!items.length) return null
  const isBlue = mySide === 'blue'
  return (
    <div className="matchup-bar">
      <span className="mu-label">MATCHUPS</span>
      <div className="mu-list">
        {items.map(({ lane, myChamp, oppChamp, data }) => {
          const myPct  = data?.win_rate != null ? Math.round(data.win_rate * 100) : null
          const oppPct = myPct != null ? 100 - myPct : null
          const advantage = myPct != null ? myPct - 50 : 0
          const advColor  = advantage > 3 ? '#4caf50' : advantage < -3 ? '#e84057' : '#c8aa6e'
          return (
            <div key={lane} className="mu-card">
              <div className="mu-lane-icon">{LANE_ICONS[lane]}</div>
              <div className="mu-content">
                <div className="mu-champs">
                  <span className={`mu-champ ${isBlue ? 'mu-blue' : 'mu-red'}`}>{myChamp}</span>
                  <span className="mu-vs">vs</span>
                  <span className={`mu-champ ${isBlue ? 'mu-red' : 'mu-blue'}`}>{oppChamp}</span>
                </div>
                {myPct != null ? (
                  <div className="mu-stats">
                    <span className="mu-pct" style={{ color: advColor }}>{myPct}%</span>
                    <div className="mu-bar">
                      <div className="mu-my"  style={{ width: `${myPct}%`,  background: isBlue ? '#1a4a8a' : '#7a1a1a' }} />
                      <div className="mu-opp" style={{ width: `${oppPct}%`, background: isBlue ? '#7a1a1a' : '#1a4a8a' }} />
                    </div>
                    <span className="mu-pct mu-opp-pct">{oppPct}%</span>
                    {data.games > 0 && <span className="mu-games">{data.games}g</span>}
                  </div>
                ) : (
                  <div className="mu-loading">buscando dados···</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

export default function DraftBoard({ champions, seriesConfig, seriesState, onGameEnd, onBackToMenu }) {
  const mySide       = seriesConfig?.mySide      ?? 'blue'
  const league       = seriesConfig?.league      ?? null
  const patch        = seriesConfig?.patch       ?? null
  const fearless     = seriesConfig?.fearless    ?? false
  const format       = seriesConfig?.format      ?? 'bo1'
  const winsNeeded   = seriesConfig?.winsNeeded  ?? 1
  const myTeamName   = seriesConfig?.myTeam?.name   ?? 'Meu Time'
  const oppTeamName  = seriesConfig?.oppTeam?.name  ?? 'Adversário'
  const fearlessUsed = seriesState?.fearlessUsed ?? []
  const currentGame  = seriesState?.currentGame  ?? 1
  const myWins       = seriesState?.myWins       ?? 0
  const oppWins      = seriesState?.oppWins      ?? 0

  const seriesOver = myWins >= winsNeeded || oppWins >= winsNeeded

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

  // Game result state (set after draft complete)
  const [gameWinner, setGameWinner] = useState(null)

  // ── Lane matchup data ──────────────────────────────────────────────────────
  const [matchupData, setMatchupData] = useState({})
  const lastFetchedMatchup = useRef({})

  const laneMatchups = useMemo(() => {
    const myPicks  = mySide === 'blue' ? bluePicks      : redPicks
    const myLanes  = mySide === 'blue' ? bluePickLanes  : redPickLanes
    const oppPicks = mySide === 'blue' ? redPicks       : bluePicks
    const oppLanes = mySide === 'blue' ? redPickLanes   : bluePickLanes
    return LANE_ORDER.map(lane => {
      const myIdx  = myLanes.findIndex(l => l === lane)
      const oppIdx = oppLanes.findIndex(l => l === lane)
      return {
        lane,
        myChamp:  myIdx  >= 0 ? myPicks[myIdx]   : null,
        oppChamp: oppIdx >= 0 ? oppPicks[oppIdx]  : null,
      }
    })
  }, [mySide, bluePicks, redPicks, bluePickLanes, redPickLanes])

  useEffect(() => {
    laneMatchups.forEach(({ lane, myChamp, oppChamp }) => {
      const key = myChamp && oppChamp ? `${myChamp}|${oppChamp}|${league}|${patch}` : null
      if (!key) {
        if (lastFetchedMatchup.current[lane]) {
          delete lastFetchedMatchup.current[lane]
          setMatchupData(p => { const n = { ...p }; delete n[lane]; return n })
        }
        return
      }
      if (lastFetchedMatchup.current[lane] === key) return
      lastFetchedMatchup.current[lane] = key
      const params = new URLSearchParams({ champion: myChamp, vs: oppChamp })
      if (league) params.append('league', league)
      if (patch)  params.append('patch_major', patch)
      fetch(`/matchup?${params}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setMatchupData(p => ({ ...p, [lane]: data })) })
        .catch(() => {})
    })
  }, [laneMatchups, league, patch])

  const alliedPicks   = mySide === 'blue' ? bluePicks : redPicks
  const enemyPicks    = mySide === 'blue' ? redPicks  : bluePicks
  const usedChampions = [...bluePicks, ...redPicks, ...blueBans, ...redBans, ...fearlessUsed].filter(Boolean)

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
      setDraftStep(next); setActiveSlot(DRAFT_ORDER[next])
    } else {
      setDraftStep(DRAFT_ORDER.length); setActiveSlot(null)
    }
  }, [])

  const fetchSuggestions = useCallback(async (bp, rp, bb, rb, slotEntry, laneOverride = null) => {
    if (champions.length === 0) return
    const allied = (mySide === 'blue' ? bp : rp).filter(Boolean)
    const enemy  = (mySide === 'blue' ? rp : bp).filter(Boolean)
    const bans   = [...bb, ...rb, ...fearlessUsed].filter(Boolean)

    if (allied.length === 0 && enemy.length === 0) {
      setSuggestions([]); setByLane({}); setCounterAnalysis([]); setWinProbability(null)
      return
    }

    const pos = laneOverride ?? (slotEntry?.type === 'pick' ? (slotEntry.position ?? null) : null)
    setActivePosition(pos)
    setLoading(true)
    try {
      const available = champions.filter(c =>
        !bans.includes(c) && !bp.includes(c) && !rp.includes(c)
      )
      const res = await fetch('/suggest-ml', {
        method:  'POST',
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
  }, [champions, mySide, league, patch, fearlessUsed])

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
    setDraftStep(next); setActiveSlot(nextEntry)
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
        ? null : (clicked ?? { side, type, index })
    )
  }, [])

  const handleLaneChange = useCallback((side, index, lane) => {
    if (side === 'blue') setBluePickLanes(prev => { const n = [...prev]; n[index] = lane; return n })
    else                 setRedPickLanes(prev  => { const n = [...prev]; n[index] = lane; return n })
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
    setActivePosition(null);     setGameWinner(null)
    setMatchupData({});          lastFetchedMatchup.current = {}
  }

  const handleGameWinner = (winner) => {
    const myP  = (mySide === 'blue' ? bluePicks : redPicks).filter(Boolean)
    const oppP = (mySide === 'blue' ? redPicks  : bluePicks).filter(Boolean)
    setGameWinner(winner)
    onGameEnd(winner, myP, oppP)
  }

  const currentPhase = currentDraftEntry?.phase ?? (isDraftComplete ? 'Draft Completo' : '')
  const phaseColor   = PHASE_COLORS[currentPhase] ?? '#1e2d40'
  const totalGames   = format === 'bo5' ? 5 : format === 'bo3' ? 3 : 1

  return (
    <div className="draft-root">

      {/* ── Series bar ─────────────────────────────────────── */}
      <div className="series-bar">
        <button className="back-btn" onClick={onBackToMenu}>← Menu</button>

        <div className="series-info">
          <span className="series-fmt">{format.toUpperCase()}</span>
          {fearless && <span className="series-tag fearless-tag">⚡ FEARLESS</span>}
          {format !== 'bo1' && (
            <span className="series-game">
              Jogo {Math.min(currentGame, totalGames)} de {totalGames}
            </span>
          )}
        </div>

        <div className="series-score">
          <span className={`score-team ${mySide === 'blue' ? 'score-blue' : 'score-red'}`}>
            {myTeamName || 'Meu Time'}
          </span>
          <span className="score-nums">
            <span className={myWins > oppWins ? 'score-leading' : ''}>{myWins}</span>
            <span className="score-dash">—</span>
            <span className={oppWins > myWins ? 'score-leading' : ''}>{oppWins}</span>
          </span>
          <span className={`score-team ${mySide === 'blue' ? 'score-red' : 'score-blue'}`}>
            {oppTeamName || 'Adversário'}
          </span>
        </div>

        <div className="series-meta">
          {league && <span className="meta-tag">{league}</span>}
          {patch  && <span className="meta-tag">{patch}</span>}
        </div>
      </div>

      {/* ── Fearless locked row ────────────────────────────── */}
      {fearless && fearlessUsed.length > 0 && (
        <div className="fearless-bar">
          <span className="fearless-bar-label">🔒 FEARLESS</span>
          <div className="fearless-chips">
            {fearlessUsed.map(c => (
              <span key={c} className="fearless-chip">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Phase bar ──────────────────────────────────────── */}
      <div className="phase-bar" style={{ borderColor: phaseColor }}>
        <div className="phase-steps">
          {DRAFT_ORDER.map((d, i) => (
            <div
              key={i}
              className={`phase-dot ${d.type} ${d.side} ${i === draftStep ? 'current' : ''} ${i < draftStep ? 'done' : ''}`}
              title={`${d.step}. ${d.side === 'blue' ? 'Azul' : 'Verm'} — ${d.type === 'ban' ? 'Ban' : 'Pick'}`}
            />
          ))}
        </div>
        <span className="phase-label" style={{ color: phaseColor === '#1e2d40' ? '#785a28' : phaseColor }}>
          {isDraftComplete
            ? '✓ Draft Completo'
            : `Passo ${currentDraftEntry?.step ?? '—'} — ${currentPhase} — ${currentDraftEntry?.side === 'blue' ? 'Time Azul' : 'Time Vermelho'}`
          }
        </span>
        {!isDraftComplete && (
          <button className="reset-btn-inline" onClick={resetDraft}>Resetar</button>
        )}
      </div>

      {/* ── Game result (after draft complete) ────────────── */}
      {isDraftComplete && !seriesOver && (
        <div className="game-result-bar">
          {!gameWinner ? (
            <>
              <span className="result-label">Jogo {currentGame} completo — Quem venceu?</span>
              <button
                className={`result-btn result-my ${mySide === 'blue' ? 'result-blue' : 'result-red'}`}
                onClick={() => handleGameWinner('my')}
              >
                {mySide === 'blue' ? '🔵' : '🔴'} {myTeamName || 'Meu Time'}
              </button>
              <button
                className={`result-btn result-opp ${mySide === 'blue' ? 'result-red' : 'result-blue'}`}
                onClick={() => handleGameWinner('opp')}
              >
                {mySide === 'blue' ? '🔴' : '🔵'} {oppTeamName || 'Adversário'}
              </button>
              <button className="reset-btn-inline" onClick={resetDraft}>Resetar Jogo</button>
            </>
          ) : (
            <>
              <span className="result-label">
                {gameWinner === 'my'
                  ? `✓ ${myTeamName || 'Meu Time'} venceu!`
                  : `✓ ${oppTeamName || 'Adversário'} venceu!`}
              </span>
              {format !== 'bo1' && (
                <button className="next-game-btn" onClick={resetDraft}>
                  ▶ Próximo Jogo ({format.toUpperCase()} · Jogo {currentGame + 1})
                </button>
              )}
              <button className="reset-btn-inline" onClick={resetDraft}>Novo Draft</button>
            </>
          )}
        </div>
      )}

      {/* ── Series over ────────────────────────────────────── */}
      {seriesOver && isDraftComplete && (
        <div className="series-over-bar">
          <span className="series-over-label">
            🏆 Série encerrada —{' '}
            {myWins >= winsNeeded
              ? `${myTeamName || 'Meu Time'} venceu ${myWins}–${oppWins}`
              : `${oppTeamName || 'Adversário'} venceu ${oppWins}–${myWins}`}
          </span>
          <button className="back-btn" onClick={onBackToMenu}>← Novo Setup</button>
        </div>
      )}

      {/* ── Draft main ─────────────────────────────────────── */}
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
            fearlessLocked={fearlessUsed}
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

      <MatchupBar
        items={laneMatchups
          .filter(m => m.myChamp && m.oppChamp)
          .map(m => ({ ...m, data: matchupData[m.lane] || null }))}
        mySide={mySide}
      />

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
        myTeamPlayers={seriesConfig?.myTeam?.players ?? []}
        onPickSuggestion={handlePickSuggestion}
      />
    </div>
  )
}
