import './ChampionGrid.css'

export default function ChampionGrid({ champions, onSelect }) {
  if (champions.length === 0) {
    return <div className="grid-empty">Nenhum campeão encontrado</div>
  }

  return (
    <div className="champion-grid">
      {champions.map(name => (
        <button key={name} className="champion-btn" onClick={() => onSelect(name)}>
          {name}
        </button>
      ))}
    </div>
  )
}
