import { useState, useRef, useMemo } from 'react'
import './MenuScreen.css'

const ROLES = [
  { key: 'top', icon: '🗡', label: 'Top' },
  { key: 'jng', icon: '🌲', label: 'Jng' },
  { key: 'mid', icon: '⚡', label: 'Mid' },
  { key: 'bot', icon: '🏹', label: 'Bot' },
  { key: 'sup', icon: '🛡', label: 'Sup' },
]

const EMPTY_PLAYERS = () => ROLES.map(r => ({ role: r.key, name: '', pool: [] }))
const EMPTY_TEAM = () => ({ name: '', players: EMPTY_PLAYERS() })

function PoolInput({ pool, allChampions, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const inputRef = useRef()

  const options = useMemo(() =>
    allChampions
      .filter(c => !pool.includes(c) && c.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8),
    [allChampions, pool, query]
  )

  const add = (c) => {
    onChange([...pool, c])
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="pool-input-wrap">
      {pool.map(c => (
        <span key={c} className="pool-chip">
          {c}
          <button className="chip-rm" onMouseDown={() => onChange(pool.filter(x => x !== c))}>×</button>
        </span>
      ))}
      <div className="pool-search-wrap">
        <input
          ref={inputRef}
          className="pool-search"
          placeholder={pool.length === 0 ? '+ adicionar...' : '+'}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && options.length > 0 && (
          <div className="pool-dropdown">
            {options.map(c => (
              <div key={c} className="pool-opt" onMouseDown={() => add(c)}>{c}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TeamPanel({ label, isMyTeam, team, mySide, allChampions, onChange, onSideChange }) {
  const upName   = (name)       => onChange({ ...team, name })
  const upPlayer = (i, f, val)  => {
    const p = [...team.players]; p[i] = { ...p[i], [f]: val }; onChange({ ...team, players: p })
  }

  return (
    <div className={`team-panel ${isMyTeam ? 'my-panel' : 'opp-panel'}`}>
      <div className="panel-head">
        <span className={`panel-badge ${isMyTeam ? 'badge-my' : 'badge-opp'}`}>{label}</span>
        <input
          className="team-name-inp"
          placeholder="Nome do time..."
          value={team.name}
          onChange={e => upName(e.target.value)}
        />
        {isMyTeam && (
          <div className="side-mini-btns">
            <button
              className={`side-mini ${mySide === 'blue' ? 'side-mini-active-blue' : ''}`}
              onClick={() => onSideChange('blue')}
              title="Lado Azul"
            >🔵 Azul</button>
            <button
              className={`side-mini ${mySide === 'red' ? 'side-mini-active-red' : ''}`}
              onClick={() => onSideChange('red')}
              title="Lado Vermelho"
            >🔴 Verm</button>
          </div>
        )}
      </div>

      <div className="panel-players">
        {ROLES.map((role, i) => (
          <div key={role.key} className="player-row">
            <span className="role-ico" title={role.label}>{role.icon}</span>
            <input
              className="player-name-inp"
              placeholder={role.label}
              value={team.players[i].name}
              onChange={e => upPlayer(i, 'name', e.target.value)}
            />
            <PoolInput
              pool={team.players[i].pool}
              allChampions={allChampions}
              onChange={pool => upPlayer(i, 'pool', pool)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MenuScreen({ allChampions, leagues, patches, savedData, onStart }) {
  const [format,   setFormat]   = useState(savedData?.format   ?? 'bo3')
  const [fearless, setFearless] = useState(savedData?.fearless ?? false)
  const [mySide,   setMySide]   = useState(savedData?.mySide   ?? 'blue')
  const [league,   setLeague]   = useState(savedData?.league   ?? '')
  const [patch,    setPatch]    = useState(savedData?.patch    ?? '')
  const [myTeam,   setMyTeam]   = useState(savedData?.myTeam   ?? EMPTY_TEAM())
  const [oppTeam,  setOppTeam]  = useState(savedData?.oppTeam  ?? EMPTY_TEAM())

  const winsNeeded = format === 'bo5' ? 3 : format === 'bo3' ? 2 : 1
  const totalGames = format === 'bo5' ? 5 : format === 'bo3' ? 3 : 1

  return (
    <div className="menu-screen">
      <div className="menu-brand">
        <span className="menu-brand-icon">⚔</span>
        <div>
          <div className="menu-brand-title">Draft Simulator</div>
          <div className="menu-brand-sub">League of Legends Competitivo</div>
        </div>
      </div>

      <div className="menu-config-row">
        <div className="config-card">
          <div className="config-card-label">FORMATO DA SÉRIE</div>
          <div className="format-btns">
            {[
              { id: 'bo1', label: 'BO1', sub: '1 jogo' },
              { id: 'bo3', label: 'BO3', sub: 'MD3' },
              { id: 'bo5', label: 'BO5', sub: 'MD5' },
            ].map(f => (
              <button
                key={f.id}
                className={`fmt-btn ${format === f.id ? 'fmt-active' : ''}`}
                onClick={() => setFormat(f.id)}
              >
                <span className="fmt-label">{f.label}</span>
                <span className="fmt-sub">{f.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="config-card">
          <div className="config-card-label">FEARLESS DRAFT</div>
          <button
            className={`fearless-btn ${fearless ? 'fearless-on' : 'fearless-off'}`}
            onClick={() => setFearless(v => !v)}
          >
            {fearless ? '⚡ ATIVO' : '○ DESATIVADO'}
          </button>
          {fearless && (
            <div className="fearless-desc">
              Campeões usados em jogos anteriores ficam bloqueados para o restante da série
            </div>
          )}
        </div>

        <div className="config-card">
          <div className="config-card-label">CONTEXTO</div>
          <div className="ctx-selects">
            <select className="ctx-sel" value={league} onChange={e => setLeague(e.target.value)}>
              <option value="">Todas as ligas</option>
              {leagues.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="ctx-sel" value={patch} onChange={e => setPatch(e.target.value)}>
              <option value="">Todos os patches</option>
              {patches.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="menu-teams-row">
        <TeamPanel
          label="MEU TIME"
          isMyTeam
          team={myTeam}
          mySide={mySide}
          allChampions={allChampions}
          onChange={setMyTeam}
          onSideChange={setMySide}
        />
        <div className="teams-vs">VS</div>
        <TeamPanel
          label="ADVERSÁRIO"
          isMyTeam={false}
          team={oppTeam}
          mySide={mySide}
          allChampions={allChampions}
          onChange={setOppTeam}
          onSideChange={() => {}}
        />
      </div>

      <div className="menu-footer">
        <div className="start-info">
          <span className="start-info-fmt">{format.toUpperCase()}</span>
          {fearless && <span className="start-info-tag fearless-tag">⚡ FEARLESS</span>}
          <span className="start-info-detail">
            melhor de {totalGames} · {winsNeeded} vitória{winsNeeded > 1 ? 's' : ''} para ganhar
          </span>
        </div>
        <button
          className="start-btn"
          onClick={() => onStart({ format, fearless, mySide, league, patch, myTeam, oppTeam, winsNeeded })}
        >
          ▶ INICIAR DRAFT
        </button>
      </div>
    </div>
  )
}
