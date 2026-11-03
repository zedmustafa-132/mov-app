import { EXIDX } from './exercises.js'

// Artwork follows the workout's meaning, never its position in a list.
const labels = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper body', fullbody: 'Full body', arms: 'Arms', core: 'Core', cardio: 'Cardio', mobility: 'Recovery & mobility' }
export const WORKOUT_ART = Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, Object.freeze({
  key, label, image: `/images/workouts/${key}.webp`, thumb: `/images/workouts/${key}-thumb.webp`,
  position: key === 'core' ? '72% 62%' : key === 'legs' ? '72% 48%' : '72% 30%'
})]))

const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function namedCategory(name) {
  if (/\b(full[ -]?body|total[ -]?body|whole[ -]?body|hiit|circuit|functional)\b/.test(name)) return 'fullbody'
  if (/\bupper([ -]?body)?\b/.test(name)) return 'upper'
  if (/\bpush\b/.test(name)) return 'push'
  if (/\bpull\b/.test(name)) return 'pull'
  if (/\b(legs?|lower([ -]?body)?|glutes?|quads?|hamstrings?|calves)\b/.test(name)) return 'legs'
  if (/\b(cardio|running|run|cycling|bike|spin|endurance|conditioning)\b/.test(name)) return 'cardio'
  if (/\b(mobility|recovery|rest|stretch|stretching|yoga|flexibility|warm[ -]?up|cool[ -]?down)\b/.test(name)) return 'mobility'
  if (/\b(core|abs|abdominals?|pilates)\b/.test(name)) return 'core'
  if (/\barms?\b/.test(name)) return 'arms'
  if (/\b(chest|shoulders?|press)\b/.test(name)) return 'push'
  if (/\b(back|rows?|lats?)\b/.test(name)) return 'pull'
  if (/\b(biceps?|triceps?|forearms?)\b/.test(name)) return 'arms'
  return null
}

export function workoutArtwork(workout) {
  const workouts = (Array.isArray(workout) ? workout : [workout]).filter(Boolean)
  const named = new Set(workouts.map(item => namedCategory(clean(item.name))).filter(Boolean))
  if (named.size === 1) return WORKOUT_ART[[...named][0]]
  if (named.size > 1) return WORKOUT_ART[[...named].every(key => ['push', 'pull', 'upper', 'arms'].includes(key)) ? 'upper' : 'fullbody']
  const counts = { push: 0, pull: 0, legs: 0, arms: 0, core: 0, cardio: 0, fullbody: 0 }
  for (const item of workouts) for (const entry of item.ex || item.entries || []) {
    const ex = EXIDX[entry.id] || entry
    const bp = clean(ex.bp || ex.bodyPart), category = clean(ex.cat || ex.category)
    if (category === 'cardio' || bp === 'cardio') counts.cardio++
    else if (/legs|glutes|calves/.test(bp)) counts.legs++
    else if (/chest|shoulder/.test(bp)) counts.push++
    else if (/back/.test(bp)) counts.pull++
    else if (/arms|forearm/.test(bp)) counts.arms++
    else if (/waist|abs|core/.test(bp)) counts.core++
    else if (/full body/.test(bp)) counts.fullbody++
  }
  if (counts.fullbody || counts.legs && counts.push + counts.pull + counts.arms > 0) return WORKOUT_ART.fullbody
  if (counts.push && counts.pull) return WORKOUT_ART.upper
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return WORKOUT_ART[ranked[0][1] ? ranked[0][0] : 'fullbody']
}

export function workoutArtStyle(workout, thumbnail = false) {
  const art = workoutArtwork(workout)
  return { '--workout-cover': `url("${thumbnail ? art.thumb : art.image}")`, '--workout-cover-position': art.position }
}
