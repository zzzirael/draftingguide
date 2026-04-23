import { useState, useEffect } from 'react'
import DraftBoard from './components/DraftBoard'
import './App.css'

export default function App() {
  const [leagues, setLeagues]   = useState([])
  const [patches, setPatches]   = useState([])
  const [champions, setChampions] = useState([])
  const [league, setLeague]     = useState('')
  const [patch, setPatch]       = useState('')
  const [mySide, setMySide]     = useState('blue')

  useEffect(() => {
    fetch('/leagues').then(r => r.json()).then(d => setLeagues(d.leagues || []))
    fetch('/patches').then(r => r.json()).then(d => {
      setPatches(d.patches || [])
      // não auto-seleciona patch — dados recentes podem não ter amostra suficiente
    })
    fetch('/champions').then(r => r.json()).then(d => setChampions(d.champions || []))
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="brand-icon">⚔</span>
          <span className="brand-name">Draft Simulator</span>
          <span className="brand-sub">Competitivo</span>
        </div>

        <div className="header-controls">
          <div className="side-selector">
            <span className="ctrl-label">Meu time</span>
            <button
              className={`side-btn blue-btn ${mySide === 'blue' ? 'active' : ''}`}
              onClick={() => setMySide('blue')}
            >Azul</button>
            <button
              className={`side-btn red-btn ${mySide === 'red' ? 'active' : ''}`}
              onClick={() => setMySide('red')}
            >Vermelho</button>
          </div>

          <div className="ctrl-group">
            <span className="ctrl-label">Liga</span>
            <select value={league} onChange={e => setLeague(e.target.value)}>
              <option value="">Todas</option>
              {leagues.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="ctrl-group">
            <span className="ctrl-label">Patch</span>
            <select value={patch} onChange={e => setPatch(e.target.value)}>
              <option value="">Todos</option>
              {patches.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </header>

      <DraftBoard
        champions={champions}
        mySide={mySide}
        league={league}
        patch={patch}
      />
    </div>
  )
}
