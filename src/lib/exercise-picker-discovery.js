// A small entry point into the catalogue, rather than an alphabetical wall of variations.
// The active equipment profile is applied by the caller before suggestions are chosen.
const COMMON_EXERCISES = ['3948', '0662', '0025', '0293', '0150', '0294', '2258']

export function recentPickerIds(S = {}) {
  const workouts = [...(S.workouts || [])].sort((a, b) =>
    String(b.d || '').localeCompare(String(a.d || '')) || (Number(b.start) || 0) - (Number(a.start) || 0))
  const entries = [S.active, ...workouts].filter(Boolean).flatMap(w => [...(w.entries || [])].reverse())
  return [...new Set(entries.map(e => e.id).filter(Boolean))]
}

export function pickerSuggestions(S, available, limit = 6) {
  const byId = new Map(available.map(e => [e.id, e]))
  const ids = [...(S.favEx || []), ...recentPickerIds(S), ...COMMON_EXERCISES, ...available.map(e => e.id)]
  return [...new Set(ids)].filter(id => byId.has(id)).slice(0, limit).map(id => byId.get(id))
}
