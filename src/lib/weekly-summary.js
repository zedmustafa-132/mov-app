// weekly-summary.js — Non-AI deterministic weekly synthesis for NXT FORM
import { calculateNutrientSum } from './nutrition/totals.js'

/**
 * Get the ISO date strings (YYYY-MM-DD) for a full 7-day week containing referenceDate.
 * weekStartDay: 0 for Sunday, 1 for Monday (default: 1).
 */
export function getWeekRange(referenceDate = new Date(), weekStartDay = 1) {
  let date
  if (typeof referenceDate === 'string') {
    const [y, m, d] = referenceDate.split('-').map(Number)
    date = new Date(y, m - 1, d)
  } else if (referenceDate instanceof Date) {
    date = new Date(referenceDate.getTime())
  } else {
    date = new Date()
  }

  // Current day of week: 0 (Sun) to 6 (Sat)
  const currentDay = date.getDay()
  // Calculate offset to week start
  const diff = (currentDay < weekStartDay ? 7 : 0) + currentDay - weekStartDay

  const startDate = new Date(date)
  startDate.setDate(date.getDate() - diff)

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    days.push(`${yyyy}-${mm}-${dd}`)
  }

  return {
    startIso: days[0],
    endIso: days[6],
    days
  }
}

/**
 * Deterministically compute the weekly summary from workouts, nutrition, weigh-ins, and targets.
 *
 * All calculations are pure, deterministic math with ZERO external AI dependencies.
 */
export function calculateWeeklySummary({
  workouts = [],
  nutritionDays = {},
  bodyweight = [],
  targets = {},
  weekStart = 1,
  referenceDate = new Date(),
  streak = 0,
  levelInfo = null
} = {}) {
  const weekRange = getWeekRange(referenceDate, weekStart)
  const { startIso, endIso, days } = weekRange

  // Targets with realistic defaults
  const calorieTarget = Number(targets.dailyCalories) || 2000
  const proteinTarget = Number(targets.macros?.proteinG) || 150
  const carbTarget = Number(targets.macros?.carbsG) || 200
  const fatTarget = Number(targets.macros?.fatG) || 65
  const waterTargetMl = Number(targets.waterMl) || 2500

  // 1. Analyze Nutrition
  const nutritionDaysSummary = []
  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0
  let totalWaterMl = 0
  let daysLoggedCount = 0
  let waterDaysMet = 0

  for (const dayStr of days) {
    const dayData = nutritionDays[dayStr]
    const entries = dayData?.entries || []
    const waterMl = Number(dayData?.waterMl) || 0
    const hasEntries = entries.length > 0

    if (hasEntries) {
      daysLoggedCount++
      const dayTotals = calculateNutrientSum(entries)
      totalCalories += dayTotals.calories
      totalProtein += dayTotals.protein
      totalCarbs += dayTotals.carbs
      totalFat += dayTotals.fat
      totalWaterMl += waterMl

      if (waterMl >= waterTargetMl) {
        waterDaysMet++
      }

      nutritionDaysSummary.push({
        date: dayStr,
        logged: true,
        calories: dayTotals.calories,
        protein: dayTotals.protein,
        carbs: dayTotals.carbs,
        fat: dayTotals.fat,
        waterMl,
        entryCount: entries.length
      })
    } else {
      nutritionDaysSummary.push({
        date: dayStr,
        logged: false,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        waterMl,
        entryCount: 0
      })
    }
  }

  // Averages on LOGGED days only (never dilute unlogged days as 0 kcal)
  const avgCalories = daysLoggedCount > 0 ? Math.round(totalCalories / daysLoggedCount) : 0
  const avgProtein = daysLoggedCount > 0 ? Math.round((totalProtein / daysLoggedCount) * 10) / 10 : 0
  const avgCarbs = daysLoggedCount > 0 ? Math.round((totalCarbs / daysLoggedCount) * 10) / 10 : 0
  const avgFat = daysLoggedCount > 0 ? Math.round((totalFat / daysLoggedCount) * 10) / 10 : 0
  const waterAvgMl = daysLoggedCount > 0 ? Math.round(totalWaterMl / daysLoggedCount) : 0

  const calorieDelta = avgCalories - calorieTarget
  const calorieDeltaPct = calorieTarget > 0 ? Math.round((calorieDelta / calorieTarget) * 100) : 0

  // 2. Analyze Workouts
  const weekWorkouts = workouts.filter(w => {
    const d = w.d || (w.start ? new Date(w.start).toISOString().slice(0, 10) : null)
    return d && d >= startIso && d <= endIso
  })

  let totalVolumeKg = 0
  let totalSets = 0
  const workoutDaysSet = new Set()

  for (const w of weekWorkouts) {
    const d = w.d || (w.start ? new Date(w.start).toISOString().slice(0, 10) : null)
    if (d) workoutDaysSet.add(d)

    for (const entry of w.entries || []) {
      for (const set of entry.sets || []) {
        if (set.done) {
          totalSets++
          const weight = Number(set.w) || 0
          const reps = Number(set.r) || 0
          if (weight > 0 && reps > 0) {
            totalVolumeKg += weight * reps
          }
        }
      }
    }
  }

  // 3. Analyze Bodyweight
  const weekWeighIns = (bodyweight || [])
    .filter(b => b.d && b.d >= startIso && b.d <= endIso && Number(b.w) > 0)
    .sort((a, b) => (a.d < b.d ? -1 : 1))

  const weighInCount = weekWeighIns.length
  const startWeight = weighInCount > 0 ? weekWeighIns[0].w : null
  const endWeight = weighInCount > 0 ? weekWeighIns[weighInCount - 1].w : null
  const weightDelta = weighInCount >= 2 ? Math.round((endWeight - startWeight) * 10) / 10 : null

  const weightDisclaimer = 'Short-term scale fluctuations reflect water and fluid retention, glycogen stores, sodium intake, and digestive transit rather than true changes in body fat or lean mass.'

  // 4. Rule-Based Deterministic Coach Insights
  const insights = []

  // Logging consistency
  if (daysLoggedCount === 0) {
    insights.push({
      type: 'warning',
      title: 'No Nutrition Logged',
      text: 'No food entries were logged for this week. Logging meals provides the essential feedback loop to ensure your energy intake matches your goal.'
    })
  } else if (daysLoggedCount < 4) {
    insights.push({
      type: 'warning',
      title: 'Partial Nutrition Logging',
      text: `Only ${daysLoggedCount} of 7 days were recorded. Calorie and macronutrient averages may be skewed; aim for at least 5 logged days for reliable progress indicators.`
    })
  } else {
    insights.push({
      type: 'positive',
      title: 'Consistent Meal Logging',
      text: `Great consistency! Logged ${daysLoggedCount} of 7 days, providing an accurate representation of your weekly nutrition.`
    })
  }

  // Calorie alignment (only meaningful if at least 3 days logged)
  if (daysLoggedCount >= 3) {
    if (Math.abs(calorieDeltaPct) <= 5) {
      insights.push({
        type: 'positive',
        title: 'Calorie Target Dialed In',
        text: `Your average intake of ${avgCalories} kcal was within ${Math.abs(calorieDeltaPct)}% of your daily ${calorieTarget} kcal target. Excellent precision!`
      })
    } else if (calorieDelta > 0) {
      insights.push({
        type: 'info',
        title: 'Caloric Surplus',
        text: `Averaged ${Math.abs(calorieDelta)} kcal/day above target (+${calorieDeltaPct}%). Favourable for muscle accretion; monitor weight rate of change to stay within your goal.`
      })
    } else {
      insights.push({
        type: 'info',
        title: 'Caloric Deficit',
        text: `Averaged ${Math.abs(calorieDelta)} kcal/day below target (${calorieDeltaPct}%). Supports fat loss; ensure adequate protein intake to preserve lean muscle.`
      })
    }
  }

  // Protein sufficiency
  if (daysLoggedCount >= 3) {
    const proteinRatio = proteinTarget > 0 ? avgProtein / proteinTarget : 1
    if (proteinRatio >= 0.9) {
      insights.push({
        type: 'positive',
        title: 'Protein Target Achieved',
        text: `Averaged ${avgProtein}g protein/day (${Math.round(proteinRatio * 100)}% of target), supporting optimal muscular recovery and repair.`
      })
    } else {
      insights.push({
        type: 'warning',
        title: 'Protein Below Target',
        text: `Averaged ${avgProtein}g protein/day against a ${proteinTarget}g target (${Math.round(proteinRatio * 100)}%). Prioritize protein staples like poultry, fish, eggs, tofu, Greek yogurt, or whey.`
      })
    }
  }

  // Training activity
  if (weekWorkouts.length >= 3) {
    insights.push({
      type: 'positive',
      title: 'Strong Gym Consistency',
      text: `Completed ${weekWorkouts.length} workouts this week, moving ${Math.round(totalVolumeKg).toLocaleString()} kg across ${totalSets} working sets.`
    })
  } else if (weekWorkouts.length > 0) {
    insights.push({
      type: 'info',
      title: 'Active Training Week',
      text: `Completed ${weekWorkouts.length} workout${weekWorkouts.length > 1 ? 's' : ''} with ${Math.round(totalVolumeKg).toLocaleString()} kg total volume.`
    })
  } else {
    insights.push({
      type: 'warning',
      title: 'No Workouts Recorded',
      text: 'No training sessions were logged this week. Even 1–2 short sessions help maintain neural adaptations and lean muscle mass.'
    })
  }

  // Weigh-in consistency
  if (weighInCount >= 3) {
    insights.push({
      type: 'positive',
      title: 'Reliable Weight Tracking',
      text: `${weighInCount} weigh-ins recorded. Regular morning measurements minimize the noise of daily water and sodium fluctuations.`
    })
  } else if (weighInCount >= 1) {
    insights.push({
      type: 'info',
      title: 'Weigh-in Tracking',
      text: `${weighInCount} weigh-in logged. Aim for 3–4 morning weigh-ins weekly to observe a reliable rolling trend.`
    })
  }

  return {
    weekRange,
    daysLoggedCount,
    totalCalories,
    avgCalories,
    calorieTarget,
    calorieDelta,
    calorieDeltaPct,
    avgProtein,
    proteinTarget,
    avgCarbs,
    carbTarget,
    avgFat,
    fatTarget,
    waterAvgMl,
    waterDaysMet,
    nutritionDays: nutritionDaysSummary,
    workoutsCompleted: weekWorkouts.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    totalSets,
    workoutDays: Array.from(workoutDaysSet),
    weighInCount,
    startWeight,
    endWeight,
    weightDelta,
    weightDisclaimer,
    streakDays: streak,
    levelInfo,
    insights
  }
}
