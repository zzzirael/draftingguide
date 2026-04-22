import { useState, useEffect } from 'react'
import DraftBoard from './components/DraftBoard'
import './App.css'

export default function App() {
  const [leagues, setLeagues] = useState([])
  const [patches, setPatches] = useState([])
  const [champions, setChampions] = useState([])
  const [selectedLeague, setSelectedLeague] = useState('')
  const [selectedPatch, setSelectedPatch] = useState('')

  useEffect(() => {
    fetch('/leagues').then(r => r.json()).then(d => setLeagues(d.leagues || []))
    fetch('/patches').then(r => r.json()).then(d => setPatches(d.patches || []))
    fetch('/champions').then(r => r.json()).then(d => setChampions(d.champions || []))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>LoL Draft Simulator</h1>
        <div className="filters">
          <select value={selectedLeague} onChange={e => setSelectedLeague(e.target.value)}>
            <option value="">Todas as ligas</option>
            {leagues.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={selectedPatch} onChange={e => setSelectedPatch(e.target.value)}>
            <option value="">Todos os patches</option>
            {patches.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </header>
      <DraftBoard
        champions={champions}
        league={selectedLeague}
        patch={selectedPatch}
      />
    </div>
  )
}
