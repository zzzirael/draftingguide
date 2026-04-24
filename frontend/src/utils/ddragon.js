// Champion name → Data Dragon key normalization
// Oracle's Elixir names that differ from ddragon keys
const OVERRIDES = {
  'Wukong':          'MonkeyKing',
  'Nunu & Willump':  'Nunu',
  'Renata Glasc':    'Renata',
  'LeBlanc':         'Leblanc',
  "Bel'Veth":        'Belveth',
  "Cho'Gath":        'Chogath',
  "Kai'Sa":          'Kaisa',
  "Kha'Zix":         'Khazix',
  "Vel'Koz":         'Velkoz',
  "Fiddlesticks":    'Fiddlesticks',
}

let _version = '15.1.1'

export function initDDVersion(v) {
  if (v) _version = v
}

export function getDDVersion() {
  return _version
}

export function champKey(name) {
  if (!name) return ''
  if (OVERRIDES[name]) return OVERRIDES[name]
  return name.replace(/[^a-zA-Z0-9]/g, '')
}

// Square icon (120×120) — versioned
export function champIconUrl(name) {
  const key = champKey(name)
  if (!key) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${_version}/img/champion/${key}.png`
}

// Cinematic loading screen art (1215×717) — version-independent
export function champLoadingUrl(name) {
  const key = champKey(name)
  if (!key) return ''
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${key}_0.jpg`
}
