import './SuggestionCard.css'

export default function SuggestionCard({ rank, data }) {
  const { champion, score, base_winrate, synergy, counter } = data

  const bar = (value) => (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      <span className="bar-label">{Math.round(value * 100)}%</span>
    </div>
  )

  return (
    <div className="suggestion-card">
      <div className="card-header">
        <span className="card-rank">#{rank}</span>
        <span className="card-name">{champion}</span>
        <span className="card-score">{Math.round(score * 100)}</span>
      </div>
      <div className="card-stats">
        <div className="stat-row">
          <span className="stat-name">Win Rate</span>
          {bar(base_winrate)}
        </div>
        <div className="stat-row">
          <span className="stat-name">Sinergia</span>
          {bar(synergy)}
        </div>
        <div className="stat-row">
          <span className="stat-name">Counter</span>
          {bar(counter)}
        </div>
      </div>
    </div>
  )
}
