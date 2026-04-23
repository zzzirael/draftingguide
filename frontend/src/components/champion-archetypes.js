// Champion archetype tags for composition detection
// Tags: poke | dive | engage | teamfight | pick | split | protect | push
export const CHAMP_TAGS = {
  // ── Top ─────────────────────────────────────────────────────────────────────
  Aatrox:         ['dive', 'engage', 'teamfight'],
  Camille:        ['dive', 'pick', 'split'],
  "Cho'Gath":     ['engage', 'teamfight'],
  Darius:         ['dive', 'engage'],
  Fiora:          ['split'],
  Gangplank:      ['poke', 'teamfight', 'split'],
  Garen:          ['dive'],
  Gnar:           ['engage', 'teamfight'],
  Gwen:           ['dive'],
  Irelia:         ['dive', 'split'],
  Jax:            ['split', 'dive'],
  Jayce:          ['poke', 'split'],
  Kayle:          ['protect', 'teamfight'],
  Kennen:         ['engage', 'teamfight'],
  "K'Sante":      ['engage', 'dive'],
  Malphite:       ['engage', 'teamfight'],
  Nasus:          ['split', 'push'],
  Olaf:           ['dive'],
  Ornn:           ['engage', 'teamfight'],
  Quinn:          ['poke', 'split'],
  Renekton:       ['dive', 'engage'],
  Rumble:         ['poke', 'teamfight'],
  Shen:           ['engage', 'protect'],
  Singed:         ['push'],
  Sion:           ['engage', 'push', 'teamfight'],
  Teemo:          ['poke'],
  Tryndamere:     ['split'],
  Urgot:          ['dive', 'teamfight'],
  Vladimir:       ['teamfight', 'poke'],
  Volibear:       ['dive', 'engage'],
  Yorick:         ['split', 'push'],
  Poppy:          ['engage', 'dive'],
  Trundle:        ['dive'],
  Pantheon:       ['dive', 'pick'],
  Grasp:          ['engage', 'teamfight'],
  Illaoi:         ['teamfight'],
  Heimerdinger:   ['poke', 'push'],
  Maokai:         ['engage', 'teamfight'],
  Zac:            ['engage', 'teamfight'],
  Gragas:         ['engage', 'teamfight'],

  // ── Jungle ──────────────────────────────────────────────────────────────────
  Amumu:          ['engage', 'teamfight'],
  "Bel'Veth":     ['dive'],
  Diana:          ['dive', 'teamfight'],
  Ekko:           ['pick', 'dive'],
  Elise:          ['pick', 'dive'],
  Evelynn:        ['pick'],
  Fiddlesticks:   ['teamfight', 'pick'],
  Graves:         ['poke', 'dive'],
  Hecarim:        ['dive', 'engage'],
  Ivern:          ['protect'],
  "Jarvan IV":    ['engage', 'dive', 'teamfight'],
  "Kha'Zix":      ['pick'],
  Kindred:        ['pick'],
  "Lee Sin":      ['pick', 'dive'],
  Lillia:         ['poke', 'teamfight'],
  "Master Yi":    ['dive'],
  Nidalee:        ['poke'],
  Nocturne:       ['pick', 'dive'],
  Nunu:           ['engage', 'teamfight'],
  "Rek'Sai":      ['dive'],
  Rengar:         ['pick'],
  Sejuani:        ['engage', 'teamfight'],
  Shyvana:        ['teamfight'],
  Talon:          ['pick'],
  Udyr:           ['dive', 'push'],
  Viego:          ['pick', 'dive'],
  Vi:             ['dive', 'engage'],
  Warwick:        ['pick', 'dive'],
  Wukong:         ['engage', 'teamfight'],
  "Xin Zhao":     ['dive', 'engage'],
  Kayn:           ['pick', 'dive'],
  Briar:          ['dive'],
  Rammus:         ['engage', 'dive'],

  // ── Mid ─────────────────────────────────────────────────────────────────────
  Ahri:           ['pick', 'dive'],
  Akali:          ['pick', 'dive'],
  Akshan:         ['poke'],
  Anivia:         ['teamfight', 'push'],
  Annie:          ['engage', 'teamfight'],
  "Aurelion Sol": ['teamfight', 'push'],
  Azir:           ['poke', 'teamfight'],
  Cassiopeia:     ['teamfight', 'poke'],
  Corki:          ['poke'],
  Fizz:           ['pick', 'dive'],
  Galio:          ['engage', 'teamfight'],
  Katarina:       ['teamfight', 'dive'],
  LeBlanc:        ['pick'],
  Lissandra:      ['engage', 'pick'],
  Lux:            ['poke'],
  Malzahar:       ['pick'],
  Orianna:        ['teamfight', 'poke'],
  Qiyana:         ['pick', 'dive'],
  Ryze:           ['push', 'teamfight'],
  Sylas:          ['teamfight'],
  Syndra:         ['poke', 'pick'],
  Taliyah:        ['push', 'poke', 'teamfight'],
  "Twisted Fate": ['pick', 'push'],
  Veigar:         ['pick', 'teamfight'],
  Vex:            ['teamfight', 'pick'],
  Viktor:         ['poke', 'teamfight'],
  Yone:           ['dive', 'teamfight'],
  Yasuo:          ['dive', 'teamfight'],
  Zed:            ['pick', 'dive'],
  Ziggs:          ['poke', 'push'],
  Zoe:            ['poke', 'pick'],
  Hwei:           ['poke', 'teamfight'],
  Naafiri:        ['pick', 'dive'],
  Xerath:         ['poke'],
  "Vel'Koz":      ['poke', 'teamfight'],

  // ── Bot ─────────────────────────────────────────────────────────────────────
  Aphelios:       ['poke', 'teamfight'],
  Ashe:           ['poke', 'engage', 'teamfight'],
  Caitlyn:        ['poke', 'push'],
  Draven:         ['poke'],
  Ezreal:         ['poke'],
  Jinx:           ['teamfight', 'poke'],
  Jhin:           ['poke', 'pick'],
  "Kai'Sa":       ['dive'],
  Kalista:        ['teamfight'],
  "Kog'Maw":      ['poke'],
  Lucian:         ['poke'],
  "Miss Fortune": ['teamfight', 'poke'],
  Nilah:          ['teamfight'],
  Samira:         ['dive', 'teamfight'],
  Sivir:          ['push', 'teamfight'],
  Tristana:       ['dive', 'push'],
  Twitch:         ['teamfight', 'pick'],
  Varus:          ['poke', 'pick'],
  Vayne:          ['split', 'dive'],
  Xayah:          ['teamfight'],
  Zeri:           ['dive', 'teamfight'],
  Smolder:        ['poke', 'teamfight'],

  // ── Support ──────────────────────────────────────────────────────────────────
  Alistar:        ['engage', 'protect'],
  Bard:           ['pick', 'engage'],
  Blitzcrank:     ['pick', 'engage'],
  Braum:          ['protect', 'engage'],
  Janna:          ['protect'],
  Karma:          ['protect', 'poke'],
  Leona:          ['engage'],
  Lulu:           ['protect'],
  Milio:          ['protect'],
  Morgana:        ['pick', 'protect'],
  Nami:           ['teamfight', 'protect', 'poke'],
  Nautilus:       ['engage', 'pick'],
  Pyke:           ['pick', 'dive'],
  Rakan:          ['engage', 'teamfight'],
  Renata:         ['teamfight', 'protect'],
  Seraphine:      ['teamfight', 'poke', 'protect'],
  Soraka:         ['protect'],
  Sona:           ['teamfight', 'poke', 'protect'],
  Thresh:         ['engage', 'pick', 'protect'],
  Yuumi:          ['protect'],
  Zilean:         ['protect', 'teamfight'],
  Zyra:           ['poke', 'teamfight'],
  Senna:          ['poke', 'protect'],
}

// ── Archetype definitions (ordered by match priority) ───────────────────────

const ARCHETYPE_DEFS = [
  { key: 'teamfight', label: 'Teamfight',          icon: '⚔',  color: '#4a9fdc', minScore: 2 },
  { key: 'poke',      label: 'Poke',               icon: '🎯', color: '#c8aa6e', minScore: 2 },
  { key: 'dive',      label: 'Dive',               icon: '🗡', color: '#e84057', minScore: 2 },
  { key: 'pick',      label: 'Pick / Catch',        icon: '🕸', color: '#9b59b6', minScore: 2 },
  { key: 'protect',   label: 'Protect the Carry',  icon: '🛡', color: '#3498db', minScore: 2 },
  { key: 'split',     label: 'Split Push',          icon: '↔',  color: '#27ae60', minScore: 1 },
  { key: 'engage',    label: 'Engage / CC',         icon: '⚡', color: '#e67e22', minScore: 2 },
]

const TAG_META = {
  teamfight: { icon: '⚔',  label: 'Teamfight', color: '#4a9fdc' },
  poke:      { icon: '🎯', label: 'Poke',      color: '#c8aa6e' },
  dive:      { icon: '🗡', label: 'Dive',      color: '#e84057' },
  engage:    { icon: '⚡', label: 'Engage',    color: '#e67e22' },
  pick:      { icon: '🕸', label: 'Pick',      color: '#9b59b6' },
  split:     { icon: '↔',  label: 'Split',     color: '#27ae60' },
  protect:   { icon: '🛡', label: 'Protect',   color: '#3498db' },
  push:      { icon: '🏰', label: 'Push',      color: '#506070' },
}

export { TAG_META }

// ── detectArchetype ──────────────────────────────────────────────────────────
// Returns: { primary, secondary, counts, gaps, pickCount } | null

export function detectArchetype(allies) {
  const picks = allies.filter(Boolean)
  if (picks.length < 2) return null

  // Accumulate tag counts
  const counts = {}
  picks.forEach(c => {
    ;(CHAMP_TAGS[c] || []).forEach(t => { counts[t] = (counts[t] || 0) + 1 })
  })

  // Score archetypes
  const scored = ARCHETYPE_DEFS
    .map(a => ({ ...a, score: counts[a.key] || 0 }))
    .filter(a => a.score >= a.minScore)
    .sort((a, b) => b.score - a.score)

  // Gap detection (meaningful at 3+ picks)
  const gaps = []
  if (picks.length >= 3) {
    const engageTotal = (counts.engage || 0) + (counts.dive || 0)
    if (engageTotal < 2) gaps.push('Sem engage')
    if ((counts.protect || 0) === 0 && (counts.teamfight || 0) < 2)
      gaps.push('Sem proteção ao carry')
  }
  if (picks.length >= 4) {
    if ((counts.teamfight || 0) === 0 && (counts.poke || 0) === 0)
      gaps.push('Falta damage em teamfight')
  }

  return {
    primary:   scored[0] || null,
    secondary: scored.slice(1, 2),
    counts,
    gaps,
    pickCount: picks.length,
  }
}
