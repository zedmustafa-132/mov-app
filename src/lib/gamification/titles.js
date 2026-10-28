// titles.js — Title and rank progression for NXT FORM
// Based on docs/GAMIFICATION.md §7

export const TITLES = [
  { level: 1, title: 'Rookie', desc: 'Starting the journey' },
  { level: 5, title: 'Trainee', desc: 'Building the foundation' },
  { level: 10, title: 'Athlete', desc: 'Consistent training and nutrition' },
  { level: 20, title: 'Contender', desc: 'Forging real strength and discipline' },
  { level: 30, title: 'Elite', desc: 'Top tier dedication and physique' },
  { level: 45, title: 'Champion', desc: 'Master of progressive overload' },
  { level: 60, title: 'Legend', desc: 'Unshakable consistency and mastery' },
  { level: 80, title: 'Mythic', desc: 'Transcended into ultimate form' }
]

/**
 * Get title and tier info for an account level.
 */
export function getTitleForLevel(level) {
  const lvl = Math.max(1, Number(level) || 1)
  let active = TITLES[0]
  for (const t of TITLES) {
    if (lvl >= t.level) active = t
    else break
  }
  return active
}
