// quests.js — Deterministic rule-based daily and weekly quest generator for NXT FORM
// Implements docs/GAMIFICATION.md §10

/**
 * Generate 3 daily quests for a given date and evaluate their completion against logged data.
 * @param {Object} context
 * @param {string} context.dateStr - YYYY-MM-DD
 * @param {boolean} context.isRestDay - Whether today is a scheduled rest day
 * @param {Object} context.dayNutrition - Today's nutrition record { entries, waterMl }
 * @param {Array} context.dayWorkouts - Workouts completed today
 * @param {boolean} context.weighedInToday - Whether user logged weight today
 * @param {Object} context.targets - User targets { calories, proteinGrams, waterMl }
 * @returns {Array<{ id: string, title: string, desc: string, xp: number, completed: boolean, progress: number, maxProgress: number }>}
 */
export function getDailyQuests({
  dateStr,
  isRestDay = false,
  dayNutrition = { entries: [], waterMl: 0 },
  dayWorkouts = [],
  weighedInToday = false,
  targets = {}
} = {}) {
  const entries = dayNutrition.entries || []
  const waterMl = dayNutrition.waterMl || 0
  const workouts = dayWorkouts || []

  let totalProt = 0
  for (const e of entries) {
    totalProt += e.nutrients?.protein ?? e.nutrients?.proteinG ?? 0
  }
  const protTarget = targets.proteinGrams || 150

  const quests = []

  // Quest 1: Nutrition logging
  const mealsLogged = new Set(entries.map(e => e.meal?.toLowerCase()))
  const mealCount = mealsLogged.size
  quests.push({
    id: `quest_meals_${dateStr}`,
    category: 'nutrition',
    title: 'Log at least 2 meals',
    desc: 'Keep your food diary active today',
    xp: 20,
    completed: mealCount >= 2,
    progress: Math.min(2, mealCount),
    maxProgress: 2
  })

  // Quest 2: Hydration
  const targetWater = Math.min(2500, targets.waterMl || 2500)
  quests.push({
    id: `quest_water_${dateStr}`,
    category: 'hydration',
    title: `Hydrate: drink ${Math.round(targetWater / 1000 * 10) / 10}L water`,
    desc: 'Reach your hydration milestone today',
    xp: 15,
    completed: waterMl >= targetWater,
    progress: Math.min(targetWater, waterMl),
    maxProgress: targetWater,
    unit: 'ml'
  })

  // Quest 3: Workout or Rest/Protein
  if (isRestDay) {
    quests.push({
      id: `quest_rest_${dateStr}`,
      category: 'recovery',
      title: 'Active Recovery: Hit Protein Target',
      desc: `Fuel muscle repair with ${protTarget}g protein`,
      xp: 25,
      completed: totalProt >= protTarget,
      progress: Math.min(protTarget, Math.round(totalProt)),
      maxProgress: protTarget,
      unit: 'g'
    })
  } else {
    quests.push({
      id: `quest_workout_${dateStr}`,
      category: 'training',
      title: "Finish Today's Training Session",
      desc: 'Complete your planned workout with focused effort',
      xp: 30,
      completed: workouts.length > 0,
      progress: workouts.length > 0 ? 1 : 0,
      maxProgress: 1
    })
  }

  return quests
}

/**
 * Generate weekly quests for the active week.
 */
export function getWeeklyQuests({
  weekWorkoutsCount = 0,
  weekProteinDays = 0,
  plannedWorkouts = 3
} = {}) {
  const targetSessions = Math.max(2, Math.min(5, plannedWorkouts))
  return [
    {
      id: 'weekly_workouts',
      title: `Complete ${targetSessions} workouts this week`,
      desc: 'Consistency is the engine of progression',
      xp: 100,
      completed: weekWorkoutsCount >= targetSessions,
      progress: Math.min(targetSessions, weekWorkoutsCount),
      maxProgress: targetSessions
    },
    {
      id: 'weekly_protein',
      title: 'Hit protein target 4 days this week',
      desc: 'Optimal recovery for maximum strength adaptations',
      xp: 120,
      completed: weekProteinDays >= 4,
      progress: Math.min(4, weekProteinDays),
      maxProgress: 4
    }
  ]
}
