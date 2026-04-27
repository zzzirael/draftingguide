import { useState, useEffect, useMemo, useRef } from 'react'
import { detectArchetype } from './champion-archetypes'
import ChampImg from './ChampImg'
import './AnalysisScreen.css'

const ROLES = [
  { key: 'top', icon: '🗡', label: 'Top' },
  { key: 'jng', icon: '🌲', label: 'Jng' },
  { key: 'mid', icon: '⚡', label: 'Mid' },
  { key: 'bot', icon: '🏹', label: 'Bot' },
  { key: 'sup', icon: '🛡', label: 'Sup' },
]
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.key, r]))
const LANE_ORDER = ['top', 'jng', 'mid', 'bot', 'sup']

// ── Champion search slot ──────────────────────────────────────────────────────

function ChampSlot({ value, role, allChampions, usedChampions, side, onChange, onRoleChange }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const inputRef = useRef()

  const options = useMemo(() =>
    query.length < 1 ? [] :
    allChampions
      .filter(c => !usedChampions.includes(c) && c.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8),
    [allChampions, usedChampions, query]
  )

  const select = (c) => { onChange(c); setQuery(''); setOpen(false) }
  const clear  = ()  => { onChange(null); setQuery('') }

  return (
    <div className={`champ-slot cs-${side}`}>
      <div className="cs-roles">
        {ROLES.map(r => (
          <button
            key={r.key}
            className={`cs-role-btn ${role === r.key ? 'cs-role-active' : ''}`}
            onClick={() => onRoleChange(role === r.key ? null : r.key)}
            title={r.label}
          >{r.icon}</button>
        ))}
      </div>
      <div className="cs-champ">
        {value ? (
          <div className="cs-filled">
            <ChampImg name={value} className="cs-champ-img" />
            {role && <span className="cs-role-badge">{ROLE_MAP[role]?.icon}</span>}
            <span className="cs-name">{value}</span>
            <button className="cs-clear" onClick={clear}>×</button>
          </div>
        ) : (
          <div className="cs-search-wrap">
            <input
              ref={inputRef}
              className="cs-input"
              placeholder="Campeão..."
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {open && options.length > 0 && (
              <div className="cs-dropdown">
                {options.map(c => (
                  <div key={c} className="cs-opt" onMouseDown={() => select(c)}>
                    <ChampImg name={c} className="cs-opt-icon" />
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Win probability bar ───────────────────────────────────────────────────────

function WinBar({ blue, red }) {
  const bp = Math.round(blue * 100)
  const rp = Math.round(red  * 100)
  const advColor = (pct) => pct >= 55 ? '#4caf50' : pct >= 45 ? '#c8aa6e' : '#e84057'
  return (
    <div className="an-winbar-wrap">
      <div className="an-winbar-labels">
        <span style={{ color: '#4a9fdc', fontWeight: 700, fontSize: '0.82rem' }}>Azul — {bp}%</span>
        <span className="an-winbar-center">WIN PROBABILITY</span>
        <span style={{ color: '#e84057', fontWeight: 700, fontSize: '0.82rem' }}>{rp}% — Verm</span>
      </div>
      <div className="an-winbar">
        <div className="an-wb-blue" style={{ width: `${bp}%` }} />
        <div className="an-wb-red"  style={{ width: `${rp}%` }} />
      </div>
      <div className="an-winbar-sub">
        <span style={{ color: advColor(bp) }}>Azul {bp}%</span>
        <span> · </span>
        <span style={{ color: advColor(rp) }}>Verm {rp}%</span>
      </div>
    </div>
  )
}

// ── Archetype row ─────────────────────────────────────────────────────────────

function ArchetypeRow({ bluePicks, redPicks }) {
  const blue = useMemo(() => detectArchetype(bluePicks.filter(Boolean)), [bluePicks])
  const red  = useMemo(() => detectArchetype(redPicks.filter(Boolean)),  [redPicks])
  if (!blue && !red) return null
  const renderArch = (a, side) => !a ? null : (
    <div className={`an-arch an-arch-${side}`}>
      {a.primary
        ? <span className="an-arch-primary" style={{ color: a.primary.color }}>{a.primary.icon} {a.primary.label.toUpperCase()}</span>
        : <span className="an-arch-neutral">BALANCEADA</span>}
      <div className="an-arch-tags">
        {a.secondary.map(s => (
          <span key={s.key} className="an-arch-tag" style={{ color: s.color }}>{s.icon} {s.label}</span>
        ))}
      </div>
      {a.gaps.length > 0 && (
        <div className="an-arch-gaps">
          {a.gaps.map(g => <span key={g} className="an-arch-gap">⚠ {g}</span>)}
        </div>
      )}
    </div>
  )
  return (
    <div className="an-archetypes">
      {renderArch(blue, 'blue')}
      <div className="an-arch-divider">ARQUÉTIPOS</div>
      {renderArch(red, 'red')}
    </div>
  )
}

// ── Synergy panel ─────────────────────────────────────────────────────────────

function SynergyPanel({ synergies, side }) {
  if (!synergies?.length) return (
    <div className="an-syn-empty">Dados insuficientes</div>
  )
  return (
    <div className="an-syn-list">
      {synergies.map((s, i) => {
        const pct = Math.round((s.win_rate ?? 0.5) * 100)
        const color = pct >= 55 ? '#4caf50' : pct >= 45 ? '#c8aa6e' : '#e84057'
        return (
          <div key={i} className="an-syn-row">
            <span className="an-syn-pair">
              <ChampImg name={s.champion_a} className="an-syn-icon" />
              {s.champion_a}
              <span className="an-syn-plus">+</span>
              <ChampImg name={s.champion_b} className="an-syn-icon" />
              {s.champion_b}
            </span>
            <div className="an-syn-bar-wrap">
              <div className="an-syn-bar">
                <div className="an-syn-fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="an-syn-pct" style={{ color }}>{pct}%</span>
            </div>
            <span className="an-syn-games">{s.games}g</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Lane matchups ─────────────────────────────────────────────────────────────

function LaneMatchups({ matchups }) {
  if (!matchups?.length) return null
  const sorted = [...matchups].sort(
    (a, b) => LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane)
  )
  return (
    <div className="an-matchups">
      {sorted.map(m => {
        const bp  = m.blue_win_rate != null ? Math.round(m.blue_win_rate * 100) : null
        const rp  = bp != null ? 100 - bp : null
        const adv = bp != null ? bp - 50 : 0
        const col = adv > 3 ? '#4caf50' : adv < -3 ? '#e84057' : '#c8aa6e'
        return (
          <div key={m.lane} className="an-mu-row">
            <span className="an-mu-lane">{ROLE_MAP[m.lane]?.icon} {ROLE_MAP[m.lane]?.label}</span>
            <span className="an-mu-blue">
              <ChampImg name={m.blue_champion} className="an-mu-icon" />
              {m.blue_champion}
            </span>
            <span className="an-mu-vs">vs</span>
            <span className="an-mu-red">
              <ChampImg name={m.red_champion} className="an-mu-icon" />
              {m.red_champion}
            </span>
            {bp != null ? (
              <>
                <div className="an-mu-bar">
                  <div className="an-mu-fill-blue" style={{ width: `${bp}%` }} />
                  <div className="an-mu-fill-red"  style={{ width: `${rp}%` }} />
                </div>
                <span className="an-mu-pct" style={{ color: col }}>{bp}%</span>
                <span className="an-mu-pct an-mu-red-pct">{rp}%</span>
                {m.games > 0 && <span className="an-mu-games">{m.games}g</span>}
              </>
            ) : (
              <span className="an-mu-nodata">sem dados</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Counter matrix ────────────────────────────────────────────────────────────

function CounterMatrix({ matrix, bluePicks, redPicks }) {
  if (!matrix?.length) return null
  const validBlue = bluePicks.filter(Boolean)
  const validRed  = redPicks.filter(Boolean)
  if (!validBlue.length || !validRed.length) return null

  const cellColor = (wr) => {
    if (wr == null) return 'transparent'
    if (wr >= 0.56) return 'rgba(76,175,80,0.25)'
    if (wr >= 0.52) return 'rgba(76,175,80,0.10)'
    if (wr <= 0.44) return 'rgba(232,64,87,0.25)'
    if (wr <= 0.48) return 'rgba(232,64,87,0.10)'
    return 'rgba(200,170,110,0.08)'
  }
  const cellText = (wr) => {
    if (wr == null) return '—'
    const pct = Math.round(wr * 100)
    return `${pct}%`
  }
  const textColor = (wr) => {
    if (wr == null) return '#2a3a4c'
    if (wr >= 0.53) return '#4caf50'
    if (wr <= 0.47) return '#e84057'
    return '#c8aa6e'
  }

  return (
    <div className="an-matrix-wrap">
      <table className="an-matrix">
        <thead>
          <tr>
            <th className="an-matrix-corner">Azul ↓ / Verm →</th>
            {validRed.map(c => (
              <th key={c} className="an-matrix-col-head" title={c}>
                <ChampImg name={c} className="an-matrix-icon" />
                <span className="an-matrix-head-name">{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td className="an-matrix-row-head">
                <div className="an-matrix-row-inner">
                  <ChampImg name={row[0]?.blue_champion} className="an-matrix-icon" />
                  {row[0]?.blue_champion}
                </div>
              </td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="an-matrix-cell"
                  style={{ background: cellColor(cell.win_rate) }}
                  title={`${cell.blue_champion} vs ${cell.red_champion}: ${cellText(cell.win_rate)} (${cell.games}g)`}
                >
                  <span style={{ color: textColor(cell.win_rate) }}>{cellText(cell.win_rate)}</span>
                  {cell.games > 0 && <span className="an-matrix-games">{cell.games}g</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Pick order stats (Leaguepedia) ────────────────────────────────────────────

function PickOrderStats({ champion, league, patch }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!champion) return
    const p = new URLSearchParams({ champion })
    if (league) p.append('league', league)
    if (patch)  p.append('patch_major', patch)
    fetch(`/draft-stats?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
  }, [champion, league, patch])

  if (!data?.by_slot?.length) return null

  return (
    <div className="an-pick-order">
      <div className="an-po-header">
        <ChampImg name={data.champion} className="an-po-champ-img" />
        <div className="an-po-title">{data.champion}</div>
      </div>
      {data.first_pick_rate != null && (
        <div className="an-po-first">
          First-pick rate: <strong>{Math.round(data.first_pick_rate * 100)}%</strong>
          {' '}({data.total_games} partidas)
        </div>
      )}
      <div className="an-po-slots">
        {data.by_slot.map(s => {
          const pct = s.win_rate != null ? Math.round(s.win_rate * 100) : null
          const col = pct != null ? (pct >= 55 ? '#4caf50' : pct <= 45 ? '#e84057' : '#c8aa6e') : '#2a3a4c'
          return (
            <div key={s.slot} className="an-po-slot">
              <span className="an-po-slot-num">Pick {s.slot}</span>
              <div className="an-po-bar">
                {pct != null && <div className="an-po-fill" style={{ width: `${pct}%`, background: col }} />}
              </div>
              <span className="an-po-pct" style={{ color: col }}>
                {pct != null ? `${pct}%` : '—'}
              </span>
              <span className="an-po-games">{s.games}g</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AnalysisScreen({ allChampions, leagues, patches, onBack }) {
  const [league,    setLeague]    = useState('')
  const [patch,     setPatch]     = useState('')
  const [bluePicks, setBluePicks] = useState(Array(5).fill(null))
  const [redPicks,  setRedPicks]  = useState(Array(5).fill(null))
  const [blueRoles, setBlueRoles] = useState(Array(5).fill(null))
  const [redRoles,  setRedRoles]  = useState(Array(5).fill(null))
  const [result,    setResult]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [focusedChamp, setFocusedChamp] = useState(null)

  const usedChampions = [...bluePicks, ...redPicks].filter(Boolean)

  const hasData = [...bluePicks, ...redPicks].filter(Boolean).length >= 2

  const updateBlue = (i, v)  => setBluePicks(p => { const n = [...p]; n[i] = v; return n })
  const updateRed  = (i, v)  => setRedPicks(p  => { const n = [...p]; n[i] = v; return n })
  const updateBR   = (i, v)  => setBlueRoles(p => { const n = [...p]; n[i] = v; return n })
  const updateRR   = (i, v)  => setRedRoles(p  => { const n = [...p]; n[i] = v; return n })

  useEffect(() => {
    if (!hasData) { setResult(null); setError(null); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/analyze-comp', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blue_picks:  bluePicks,
            red_picks:   redPicks,
            blue_roles:  blueRoles,
            red_roles:   redRoles,
            league:      league || null,
            patch_major: patch  || null,
          }),
        })
        if (!res.ok) {
          setError(`Erro do servidor (${res.status}) — verifique se o backend está atualizado.`)
          return
        }
        setResult(await res.json())
      } catch {
        setError('Não foi possível conectar ao backend. Certifique-se de que o servidor está rodando na porta 8001.')
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [bluePicks, redPicks, blueRoles, redRoles, league, patch])

  const allPicksForArch = { blue: bluePicks, red: redPicks }

  return (
    <div className="analysis-screen">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="an-header">
        <button className="an-back-btn" onClick={onBack}>← Menu</button>
        <div className="an-title-wrap">
          <span className="an-title">Análise de Draft</span>
          <span className="an-sub">Pós-jogo · Sem sugestões</span>
        </div>
        {loading && <span className="an-loading">calculando...</span>}
        <div className="an-ctx">
          <select className="an-ctx-sel" value={league} onChange={e => setLeague(e.target.value)}>
            <option value="">Todas as ligas</option>
            {leagues.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="an-ctx-sel" value={patch} onChange={e => setPatch(e.target.value)}>
            <option value="">Todos os patches</option>
            {patches.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* ── Team inputs ────────────────────────────────────── */}
      <div className="an-teams">
        <div className="an-team an-team-blue">
          <div className="an-team-label">TIME AZUL</div>
          {Array(5).fill(null).map((_, i) => (
            <ChampSlot
              key={i}
              value={bluePicks[i]}
              role={blueRoles[i]}
              allChampions={allChampions}
              usedChampions={usedChampions}
              side="blue"
              onChange={v => { updateBlue(i, v); if (v) setFocusedChamp(v) }}
              onRoleChange={v => updateBR(i, v)}
            />
          ))}
        </div>

        <div className="an-vs">VS</div>

        <div className="an-team an-team-red">
          <div className="an-team-label">TIME VERMELHO</div>
          {Array(5).fill(null).map((_, i) => (
            <ChampSlot
              key={i}
              value={redPicks[i]}
              role={redRoles[i]}
              allChampions={allChampions}
              usedChampions={usedChampions}
              side="red"
              onChange={v => { updateRed(i, v); if (v) setFocusedChamp(v) }}
              onRoleChange={v => updateRR(i, v)}
            />
          ))}
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────── */}
      {result && (
        <div className="an-results">

          {/* Win probability */}
          <WinBar blue={result.win_probability.blue} red={result.win_probability.red} />

          {/* Archetypes */}
          <ArchetypeRow bluePicks={bluePicks} redPicks={redPicks} />

          {/* Lane matchups */}
          {result.lane_matchups?.length > 0 && (
            <section className="an-section">
              <div className="an-section-title">MATCHUPS DE LANE</div>
              <LaneMatchups matchups={result.lane_matchups} />
            </section>
          )}
          {result.lane_matchups?.length === 0 && (
            <div className="an-section-hint">
              Atribua roles aos campeões para ver os matchups de lane.
            </div>
          )}

          {/* Synergies */}
          <div className="an-synergies-row">
            <section className="an-section an-section-half">
              <div className="an-section-title an-blue-title">SINERGIAS — AZUL</div>
              <SynergyPanel synergies={result.synergies.blue} side="blue" />
            </section>
            <section className="an-section an-section-half">
              <div className="an-section-title an-red-title">SINERGIAS — VERM</div>
              <SynergyPanel synergies={result.synergies.red} side="red" />
            </section>
          </div>

          {/* Counter matrix */}
          {result.counter_matrix?.length > 0 && (
            <section className="an-section">
              <div className="an-section-title">MATRIX DE COUNTERS</div>
              <div className="an-matrix-legend">
                WR do campeão <strong>azul</strong> contra cada campeão <strong>vermelho</strong>
                <span className="leg-green">■ vantagem</span>
                <span className="leg-red">■ desvantagem</span>
              </div>
              <CounterMatrix
                matrix={result.counter_matrix}
                bluePicks={bluePicks}
                redPicks={redPicks}
              />
            </section>
          )}

          {/* Pick order stats (Leaguepedia) */}
          {focusedChamp && (
            <section className="an-section">
              <div className="an-section-title">DRAFT ORDER — LEAGUEPEDIA</div>
              <div className="an-po-hint">
                Selecione um campeão para ver em qual slot ele performa melhor.
                Dados disponíveis após <code>python setup.py --leaguepedia</code>.
              </div>
              <div className="an-po-grid">
                {[...bluePicks, ...redPicks].filter(Boolean).map(c => (
                  <PickOrderStats key={c} champion={c} league={league} patch={patch} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      {error && (
        <div className="an-error">
          <span className="an-error-icon">⚠</span>
          {error}
        </div>
      )}

      {!hasData && !error && (
        <div className="an-empty">
          <div className="an-empty-icon">⊞</div>
          <p>Preencha pelo menos 2 campeões para ver a análise.</p>
          <p className="an-empty-sub">Atribua roles para ver matchups de lane.</p>
        </div>
      )}
    </div>
  )
}
