// xp.js — Pure functional XP and leveling engine for NXT FORM
// Implements docs/GAMIFICATION.md §2 & §3

import { getTitleForLevel } from './titles.js'
import { getFormForLevel } from './forms.js'

/**
 * XP required to advance from level n to level n+1: round(100 * n^1.5)
 */
export function xpToNextLevel(level) {
  const lvl = Math.max(1, Number(level) || 1)
  return Math.round(100 * Math.pow(lvl, 1.5))
}

/**
 * Cumulative XP required to reach a specific level starting from 0 XP at Level 1.
 */
export function cumulativeXpForLevel(targetLevel) {
  const lvl = Math.max(1, Number(targetLevel) || 1)
  let total = 0
  for (let l = 1; l < lvl; l++) {
    total += xpToNextLevel(l)
  }
  return total
}

/**
 * Compute current level and progress info from lifetime XP.
 */
export function getLevelInfo(totalXp = 0) {
  const xp = Math.max(0, Number(totalXp) || 0)
  let level = 1
  let cumulative = 0

  while (true) {
    const cost = xpToNextLevel(level)
    if (xp >= cumulative + cost) {
      cumulative += cost
      level++
    } else {
      break
    }
  }

  const currentLevelFloor = cumulative
  const nextLevelCeiling = cumulative + xpToNextLevel(level)
  const xpIntoCurrentLevel = xp - currentLevelFloor
  const xpNeededForCurrentLevel = nextLevelCeiling - currentLevelFloor
  const progressPct = Math.min(100, Math.max(0, Math.round((xpIntoCurrentLevel / xpNeededForCurrentLevel) * 100)))

  return {
    level,
    totalXp: xp,
    currentLevelFloor,
    nextLevelCeiling,
    xpIntoCurrentLevel,
    xpNeededForCurrentLevel,
    progressPct,
    title: getTitleForLevel(level).title,
    form: getFormForLevel(level)
  }
}

/**
 * Compute daily XP earned on a specific date from nutrition and workout data.
 * @param {Object} params
 * @param {Array} params.nutritionEntries - Logged food entries for the day
 * @param {number} params.waterMl - Total water logged in ml
 * @param {Object} params.targets - Daily targets { calories, proteinG, waterMl }
 * @param {Array} params.workouts - Completed workouts for the day
 * @param {boolean} params.weighedIn - Whether bodyweight was logged on this day
 * @param {number} params.prCount - Number of personal records set on this day
 */
export function calculateDailyXp({
  nutritionEntries = [],
  waterMl = 0,
  targets = {},
  workouts = [],
  weighedIn = false,
  prCount = 0
} = {}) {
  let xp = 0
  const breakdown = []

  // 1. Food Logging
  const entries = Array.isArray(nutritionEntries) ? nutritionEntries : []
  if (entries.length > 0) {
    xp += 10
    breakdown.push({ label: 'Logged a meal', xp: 10 })

    const mealsLogged = new Set(entries.map(e => e.meal?.toLowerCase()))
    if (mealsLogged.has('breakfast') && mealsLogged.has('lunch') && mealsLogged.has('dinner')) {
      xp += 15
      breakdown.push({ label: 'Logged all 3 main meals', xp: 15 })
    }

    // Macro sums
    let totalCalories = 0
    let totalProtein = 0
    for (const e of entries) {
      totalCalories += e.nutrients?.calories ?? e.nutrients?.kcal ?? 0
      totalProtein += e.nutrients?.protein ?? e.nutrients?.proteinG ?? 0
    }

    // Calories within ±10% target band (must have target and be >=90% and <=110%)
    const targetCal = targets.dailyCalories || targets.calories || 2000
    if (totalCalories >= targetCal * 0.9 && totalCalories <= targetCal * 1.1) {
      xp += 20
      breakdown.push({ label: 'Calories in target zone (±10%)', xp: 20 })
    }

    // Protein target reached
    const targetProt = targets.proteinGrams || targets.proteinG || 150
    if (totalProtein >= targetProt) {
      xp += 15
      breakdown.push({ label: 'Hit daily protein target', xp: 15 })
    }
  }

  // 2. Hydration
  const targetWater = targets.waterMl || 3000
  if (waterMl >= targetWater) {
    xp += 10
    breakdown.push({ label: 'Hit hydration goal', xp: 10 })
  }

  // 3. Workouts
  const doneWorkouts = Array.isArray(workouts) ? workouts : []
  if (doneWorkouts.length > 0) {
    xp += 40
    breakdown.push({ label: 'Completed workout session', xp: 40 })

    if (doneWorkouts.length > 1) {
      xp += 20
      breakdown.push({ label: 'Second workout session', xp: 20 })
    }
  }

  // 4. Personal Records (max 3 PRs = 45 XP)
  const validPrs = Math.min(3, Math.max(0, Number(prCount) || 0))
  if (validPrs > 0) {
    const prXp = validPrs * 15
    xp += prXp
    breakdown.push({ label: `${validPrs} Personal Record${validPrs > 1 ? 's' : ''}`, xp: prXp })
  }

  // 5. Weigh-in
  if (weighedIn) {
    xp += 5
    breakdown.push({ label: 'Daily weigh-in', xp: 5 })
  }

  return {
    totalXp: xp,
    breakdown
  }
}

/**
 * Recompute cumulative lifetime XP purely from store and nutrition state.
 * Ensures data integrity: additions, edits, and deletions recalculate accurately without farming.
 */
export function calculateTotalUserXp(S = {}, nutritionDays = {}) {
  let totalXp = 0
  const targets = S.targets || {}
  const targetCal = targets.dailyCalories || 2000
  const targetProt = targets.proteinGrams || 150
  const targetWater = targets.waterMl || 3000

  // 1. Workouts by day
  const workoutsByDay = {}
  for (const w of (S.workouts || [])) {
    const d = w.d || 'unknown'
    if (!workoutsByDay[d]) workoutsByDay[d] = []
    workoutsByDay[d].push(w)
  }

  for (const [_, dayWorkouts] of Object.entries(workoutsByDay)) {
    if (dayWorkouts.length > 0) {
      totalXp += 40
      if (dayWorkouts.length > 1) totalXp += 20
    }
    for (const w of dayWorkouts) {
      if (w.prs?.length) {
        totalXp += Math.min(3, w.prs.length) * 15
      }
    }
  }

  // 2. Nutrition days
  for (const [_, dayData] of Object.entries(nutritionDays || {})) {
    const entries = dayData?.entries || []
    if (entries.length > 0) {
      totalXp += 10
      const meals = new Set(entries.map(e => e.meal?.toLowerCase()))
      if (meals.has('breakfast') && meals.has('lunch') && meals.has('dinner')) {
        totalXp += 15
      }
      let cals = 0
      let prot = 0
      for (const e of entries) {
        cals += e.nutrients?.calories ?? e.nutrients?.kcal ?? 0
        prot += e.nutrients?.protein ?? e.nutrients?.proteinG ?? 0
      }
      if (cals >= targetCal * 0.9 && cals <= targetCal * 1.1) {
        totalXp += 20
      }
      if (prot >= targetProt) {
        totalXp += 15
      }
    }
    if ((dayData?.waterMl || 0) >= targetWater) {
      totalXp += 10
    }
  }

  // 3. Weigh-ins
  totalXp += (S.bodyweight?.length || 0) * 5

  return Math.max(0, totalXp)
}
