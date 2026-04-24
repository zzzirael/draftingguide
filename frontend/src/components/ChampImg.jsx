import { useState } from 'react'
import { champIconUrl } from '../utils/ddragon'

// Reusable champion image. Falls back to styled initials on load error.
// Apply sizing/shape via className — same class works on both <img> and fallback <div>.
export default function ChampImg({ name, className = '', style = {} }) {
  const [failed, setFailed] = useState(false)

  if (!name || failed) {
    return (
      <div className={`champ-img-fallback ${className}`} style={style}>
        {name ? name.slice(0, 2).toUpperCase() : '?'}
      </div>
    )
  }

  return (
    <img
      src={champIconUrl(name)}
      alt={name}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      loading="lazy"
      draggable={false}
    />
  )
}
