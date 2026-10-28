// stats.js — RPG Character Attributes engine for NXT FORM (Strength, Endurance, Agility, Vitality, Discipline)
// Implements docs/GAMIFICATION.md §6 (attributes 1–99)

/**
 * Clamp a stat score between 1 and 99.
 */
function clampStat(val) {
  return Math.min(99, Math.max(1, Math.round(val)))
}

/**
 * Calculate the 5 core RPG stats for the user's Character Sheet.
 * @param {Object} data
 * @param {Array} data.workouts - Completed workouts array from store
 * @param {Object} data.nutritionDays - Monthly nutrition days data
 * @param {number} data.streak - Active daily streak count
 * @param {Array} data.bodyweight - Weigh-ins array
 * @param {Object} data.targets - Nutrition & fitness targets
 * @returns {Object} { strength, endurance, agility, vitality, discipline, totalAverage }
 */
export function calculateCharacterStats({
  workouts = [],
  nutritionDays = {},
  streak = 0,
  bodyweight = [],
  targets = {}
} = {}) {
  const allWorkouts = Array.isArray(workouts) ? workouts : []
  const days = nutritionDays || {}
  const streakDays = Math.max(0, Number(streak) || 0)

  // 1. STRENGTH (1–99): Volume, completed sets, PRs
  let totalVolumeKg = 0
  let heavySets = 0
  let prPoints = 0

  for (const w of allWorkouts) {
    totalVolumeKg += w.vol || 0
    if (w.prs?.length) prPoints += w.prs.length * 2
    if (Array.isArray(w.entries)) {
      for (const e of w.entries) {
        if (Array.isArray(e.sets)) {
          heavySets += e.sets.filter(s => s && !s.warmup && s.w > 0).length
        }
      }
    }
  }

  // Base 10 + log volume + heavy sets + PR points
  const strengthRaw = 10 +
    (allWorkouts.length * 1.5) +
    (Math.log10(Math.max(1, totalVolumeKg)) * 6) +
    (heavySets * 0.15) +
    (prPoints * 1.2)
  const strength = clampStat(strengthRaw)

  // 2. ENDURANCE (1–99): Cardio minutes, session frequency, workout consistency
  let cardioMinutes = 0
  for (const w of allWorkouts) {
    if (w.cardioDur) cardioMinutes += Math.round(w.cardioDur / 60)
    else if (w.dur) cardioMinutes += Math.round(w.dur / 120) // partial contribution from general duration
  }
  const enduranceRaw = 10 + (allWorkouts.length * 1.8) + (cardioMinutes * 0.12)
  const endurance = clampStat(enduranceRaw)

  // 3. AGILITY (1–99): Bodyweight exercise sets, variety, core/mobility
  let bodyweightSets = 0
  for (const w of allWorkouts) {
    if (Array.isArray(w.entries)) {
      for (const e of w.entries) {
        // e.g. assisted, bodyweight, or high reps
        if (e.mode === 'bw' || e.isBw || (e.sets || []).some(s => s.w === 0 && s.r > 0)) {
          bodyweightSets += (e.sets || []).length
        }
      }
    }
  }
  const agilityRaw = 10 + (bodyweightSets * 1.2) + (allWorkouts.length * 0.8)
  const agility = clampStat(agilityRaw)

  // 4. VITALITY (1–99): Nutrition consistency, protein target hits, water target hits
  const loggedDays = Object.values(days)
  let proteinHits = 0
  let waterHits = 0
  let caloriesInRange = 0

  const protTarget = targets.proteinGrams || 150
  const calTarget = targets.dailyCalories || 2000
  const waterTarget = targets.waterMl || 3000

  for (const d of loggedDays) {
    if (!d || !d.entries?.length) continue
    let dayKcal = 0
    let dayProt = 0
    for (const e of d.entries) {
      dayKcal += e.nutrients?.calories ?? e.nutrients?.kcal ?? 0
      dayProt += e.nutrients?.protein ?? e.nutrients?.proteinG ?? 0
    }
    if (dayProt >= protTarget) proteinHits++
    if (dayKcal >= calTarget * 0.9 && dayKcal <= calTarget * 1.1) caloriesInRange++
    if ((d.waterMl || 0) >= waterTarget) waterHits++
  }

  const vitalityRaw = 10 +
    (loggedDays.length * 1.5) +
    (proteinHits * 2.5) +
    (waterHits * 1.5) +
    (caloriesInRange * 2.0)
  const vitality = clampStat(vitalityRaw)

  // 5. DISCIPLINE (1–99): Daily streak, logging count, weigh-ins
  const disciplineRaw = 10 +
    (streakDays * 3.5) +
    (allWorkouts.length * 1.0) +
    (bodyweight.length * 1.5) +
    (loggedDays.length * 1.0)
  const discipline = clampStat(disciplineRaw)

  const totalAverage = Math.round((strength + endurance + agility + vitality + discipline) / 5)

  return {
    strength,
    endurance,
    agility,
    vitality,
    discipline,
    totalAverage
  }
}
