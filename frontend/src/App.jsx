import { useState, useEffect } from 'react'
import MenuScreen     from './components/MenuScreen'
import DraftBoard     from './components/DraftBoard'
import AnalysisScreen from './components/AnalysisScreen'
import { initDDVersion } from './utils/ddragon'
import './App.css'

const STORAGE_KEY = 'draft-sim-v1'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) }
  catch { return null }
}

export default function App() {
  const [screen,    setScreen]    = useState('menu')
  const [champions, setChampions] = useState([])
  const [leagues,   setLeagues]   = useState([])
  const [patches,   setPatches]   = useState([])

  const [seriesConfig, setSeriesConfig] = useState(null)
  const [seriesState,  setSeriesState]  = useState(null)

  useEffect(() => {
    fetch('/leagues').then(r => r.json()).then(d => setLeagues(d.leagues || []))
    fetch('/patches').then(r => r.json()).then(d => setPatches(d.patches || []))
    fetch('/champions').then(r => r.json()).then(d => setChampions(d.champions || []))
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json()).then(v => initDDVersion(v[0])).catch(() => {})
  }, [])

  const handleStart = (config) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    setSeriesConfig(config)
    setSeriesState({ currentGame: 1, myWins: 0, oppWins: 0, fearlessUsed: [], games: [] })
    setScreen('draft')
  }

  const handleGameEnd = (winner, myPicks, oppPicks) => {
    setSeriesState(prev => {
      const myWins  = prev.myWins  + (winner === 'my'  ? 1 : 0)
      const oppWins = prev.oppWins + (winner === 'opp' ? 1 : 0)
      const fearlessUsed = seriesConfig?.fearless
        ? [...new Set([...prev.fearlessUsed, ...myPicks, ...oppPicks])]
        : prev.fearlessUsed
      return {
        currentGame: prev.currentGame + 1,
        myWins, oppWins, fearlessUsed,
        games: [...prev.games, { myPicks, oppPicks, winner }],
      }
    })
  }

  if (screen === 'menu') {
    return (
      <MenuScreen
        allChampions={champions}
        leagues={leagues}
        patches={patches}
        savedData={loadSaved()}
        onStart={handleStart}
        onAnalysis={() => setScreen('analysis')}
      />
    )
  }

  if (screen === 'analysis') {
    return (
      <AnalysisScreen
        allChampions={champions}
        leagues={leagues}
        patches={patches}
        onBack={() => setScreen('menu')}
      />
    )
  }

  return (
    <div className="app">
      <DraftBoard
        champions={champions}
        seriesConfig={seriesConfig}
        seriesState={seriesState}
        onGameEnd={handleGameEnd}
        onBackToMenu={() => setScreen('menu')}
      />
    </div>
  )
}
