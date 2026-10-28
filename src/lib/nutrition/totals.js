// totals.js — day and meal nutrient aggregation and date helpers for NXT FORM

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * Get current date string (YYYY-MM-DD) in user's local timezone.
 */
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate totals for a list of food log entries (either for a meal or for the entire day).
 */
export function calculateNutrientSum(entries = []) {
  const sum = {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    count: 0
  }

  for (const entry of entries) {
    if (!entry) continue
    const n = entry.nutrients || {}
    sum.kcal += n.kcal ?? n.calories ?? 0
    sum.proteinG += n.proteinG ?? n.protein ?? 0
    sum.carbsG += n.carbsG ?? n.carbs ?? 0
    sum.fatG += n.fatG ?? n.fat ?? 0
    sum.fiberG += n.fiberG ?? n.fiber ?? 0
    sum.sugarG += n.sugarG ?? n.sugar ?? 0
    sum.sodiumMg += n.sodiumMg ?? n.sodium ?? 0
    sum.count++
  }

  const roundedKcal = Math.round(sum.kcal)
  const roundedProtein = Math.round(sum.proteinG * 10) / 10
  const roundedCarbs = Math.round(sum.carbsG * 10) / 10
  const roundedFat = Math.round(sum.fatG * 10) / 10
  const roundedFiber = Math.round(sum.fiberG * 10) / 10
  const roundedSugar = Math.round(sum.sugarG * 10) / 10
  const roundedSodium = Math.round(sum.sodiumMg)

  return {
    kcal: roundedKcal,
    calories: roundedKcal,
    proteinG: roundedProtein,
    protein: roundedProtein,
    carbsG: roundedCarbs,
    carbs: roundedCarbs,
    fatG: roundedFat,
    fat: roundedFat,
    fiberG: roundedFiber,
    fiber: roundedFiber,
    sugarG: roundedSugar,
    sugar: roundedSugar,
    sodiumMg: roundedSodium,
    sodium: roundedSodium,
    count: sum.count
  }
}

export const computeDayTotals = calculateNutrientSum

/**
 * Calculate complete daily dashboard statistics against user targets.
 */
export function calculateDayDashboard(entries = [], waterMl = 0, targets = {}) {
  const allEntries = Array.isArray(entries) ? entries : []
  const consumed = calculateNutrientSum(allEntries)

  const targetKcal = targets.calories || 2000
  const targetProtein = targets.proteinG || 150
  const targetCarbs = targets.carbsG || 200
  const targetFat = targets.fatG || 65
  const targetWater = targets.waterMl || 3000

  const remainingKcal = targetKcal - consumed.kcal

  // Group by meal
  const meals = {
    breakfast: { entries: [], totals: null },
    lunch: { entries: [], totals: null },
    dinner: { entries: [], totals: null },
    snack: { entries: [], totals: null }
  }

  for (const entry of allEntries) {
    const type = entry.meal && meals[entry.meal] ? entry.meal : 'snack'
    meals[type].entries.push(entry)
  }

  for (const type of MEAL_TYPES) {
    meals[type].totals = calculateNutrientSum(meals[type].entries)
  }

  return {
    consumed,
    targets: {
      calories: targetKcal,
      proteinG: targetProtein,
      carbsG: targetCarbs,
      fatG: targetFat,
      waterMl: targetWater
    },
    remainingKcal,
    percentages: {
      calories: Math.min(200, Math.round((consumed.kcal / targetKcal) * 100)),
      protein: Math.min(200, Math.round((consumed.proteinG / targetProtein) * 100)),
      carbs: Math.min(200, Math.round((consumed.carbsG / targetCarbs) * 100)),
      fat: Math.min(200, Math.round((consumed.fatG / targetFat) * 100)),
      water: Math.min(200, Math.round(((waterMl || 0) / targetWater) * 100))
    },
    waterMl: waterMl || 0,
    meals
  }
}

/**
 * Format a YYYY-MM-DD date string into a friendly title.
 */
export function formatFriendlyDate(dateStr) {
  if (!dateStr) return ''
  const today = getLocalDateString()
  if (dateStr === today) return 'Today'

  const d = new Date(`${dateStr}T12:00:00`)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === getLocalDateString(yesterday)) return 'Yesterday'

  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
