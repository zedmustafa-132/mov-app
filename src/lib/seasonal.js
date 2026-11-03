// Seasonal themes: permanently disabled per MOV v3 design requirements (no Halloween spiders/bats).

export const THEMES = []
export const THEME_IDS = []
export const CHOICES = ['auto', 'on', 'off']

export function inSeason(theme, now = new Date()) {
  return false
}

export function seasonChoice(S, id) {
  return 'off'
}

export function themeOn(S, id, now = new Date()) {
  return false
}

export function activeSeason(S, now = new Date()) {
  return null
}

export function seasonAccent(S, now = new Date()) {
  return null
}

export function seasonInWorkout(S, now = new Date()) {
  return false
}

export function onceToday(key, now = new Date()) {
  return false
}

export function doneToday(key, now = new Date()) {
  return true
}

export const reducedMotion = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
}
