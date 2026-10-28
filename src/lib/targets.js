// targets.js — deterministic personal nutrition and workout plan calculation engine for NXT FORM
// Based on Mifflin–St Jeor, Katch–McArdle, TDEE, macro ratios, and openGym starter routines.
// See docs/PLAN_ENGINE.md for complete mathematical rationale.

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,       // Desk job, little walking
  light: 1.375,         // Desk job + 1–3 workouts/week
  moderate: 1.55,       // 3–5 workouts/week or active job
  active: 1.725,        // 6–7 hard sessions/week or physical job
  very_active: 1.9      // Daily hard training or athlete
}

export const KCAL_PER_KG_FAT = 7700

/**
 * Calculate Basal Metabolic Rate (BMR) in kcal/day.
 * Uses Katch–McArdle if body fat percentage is provided; otherwise Mifflin–St Jeor.
 */
export function calculateBmr({ weightKg, heightCm, age, sex, bodyFatPercent }) {
  if (typeof bodyFatPercent === 'number' && bodyFatPercent > 0 && bodyFatPercent < 70) {
    const leanMassKg = weightKg * (1 - bodyFatPercent / 100)
    return Math.round(370 + 21.6 * leanMassKg)
  }

  // Mifflin–St Jeor formula
  let s = -78 // neutral average if sex is omitted
  if (sex === 'male') s = 5
  else if (sex === 'female') s = -161

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s
  return Math.round(Math.max(800, bmr))
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE) in kcal/day.
 */
export function calculateTdee({ bmr, activityLevel }) {
  const factor = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate
  return Math.round(bmr * factor)
}

/**
 * Calculate Daily Calorie Target and Projected Timeline.
 */
export function calculateGoalCalories({
  tdee,
  bmr,
  weightKg,
  targetWeightKg,
  goal = 'fat_loss',
  pace = 'moderate',
  sex = null,
  experience = 'intermediate'
}) {
  const currentWt = Number(weightKg) || 70
  const targetWt = Number(targetWeightKg) || currentWt

  // Absolute minimum safety floor
  let floor = 1350
  if (sex === 'female') floor = 1200
  else if (sex === 'male') floor = 1500
  floor = Math.max(floor, bmr)

  let dailyAdjust = 0
  let weeklyRateKg = 0
  let isCapped = false

  if (goal === 'fat_loss') {
    // Loss rates as % of body weight per week
    const ratePercent = pace === 'relaxed' ? 0.0025 : pace === 'aggressive' ? 0.0085 : 0.005
    weeklyRateKg = currentWt * ratePercent
    dailyAdjust = -Math.round((weeklyRateKg * KCAL_PER_KG_FAT) / 7)

    // Safety: cap deficit at 25% of TDEE and 1,000 kcal/day
    const maxDeficit = Math.min(Math.round(tdee * 0.25), 1000)
    if (Math.abs(dailyAdjust) > maxDeficit) {
      dailyAdjust = -maxDeficit
      weeklyRateKg = (maxDeficit * 7) / KCAL_PER_KG_FAT
      isCapped = true
    }

    // Safety: floor
    if (tdee + dailyAdjust < floor) {
      dailyAdjust = -(tdee - floor)
      weeklyRateKg = Math.max(0.05, (Math.abs(dailyAdjust) * 7) / KCAL_PER_KG_FAT)
      isCapped = true
    }
  } else if (goal === 'muscle_gain') {
    // Lean surplus based on experience
    let monthlyRatePercent = 0.005 // 0.5% per month for intermediate
    if (experience === 'beginner') monthlyRatePercent = 0.01
    else if (experience === 'advanced') monthlyRatePercent = 0.0025

    const paceMultiplier = pace === 'relaxed' ? 0.5 : pace === 'aggressive' ? 1.5 : 1.0
    const monthlyRateKg = currentWt * monthlyRatePercent * paceMultiplier
    weeklyRateKg = monthlyRateKg / 4.33
    dailyAdjust = Math.round((weeklyRateKg * KCAL_PER_KG_FAT) / 7)

    // Safety cap: max surplus 20% of TDEE
    const maxSurplus = Math.round(tdee * 0.2)
    if (dailyAdjust > maxSurplus) {
      dailyAdjust = maxSurplus
      isCapped = true
    }
  }

  // Calculate final target, rounded to nearest 10 kcal
  const targetCalories = Math.max(floor, Math.round((tdee + dailyAdjust) / 10) * 10)

  // Timeline estimation
  let estimatedWeeks = 0
  const weightDiff = Math.abs(currentWt - targetWt)
  if (weightDiff > 0.1 && weeklyRateKg > 0.01) {
    // Dynamic week-by-week simulation accounting for rate scaling as weight changes
    let simWeight = currentWt
    const targetDirection = targetWt > currentWt ? 1 : -1
    let weeks = 0
    while (weeks < 104) { // Max 2-year projection
      weeks++
      const weekLoss = simWeight * (weeklyRateKg / currentWt)
      simWeight += targetDirection * weekLoss
      if (targetDirection < 0 && simWeight <= targetWt) break
      if (targetDirection > 0 && simWeight >= targetWt) break
    }
    estimatedWeeks = weeks
  }

  return {
    targetCalories,
    dailyAdjust,
    dailyDeficitSurplus: dailyAdjust,
    weeklyRateKg: Math.round(weeklyRateKg * 100) / 100,
    estimatedWeeks,
    isCapped,
    floor
  }
}

/**
 * Calculate Macronutrients in grams.
 */
export function calculateMacros({ calories, weightKg, heightCm, goal = 'fat_loss', dietPreference = 'balanced' }) {
  const wt = Number(weightKg) || 70
  const htM = (Number(heightCm) || 170) / 100
  const bmi = wt / (htM * htM)

  // If BMI >= 30, use reference weight at BMI 25 for protein to avoid excess recommendations
  const referenceWeightKg = bmi >= 30 ? 25 * (htM * htM) : wt

  // Protein targets (g/kg reference weight)
  let proteinRatio = 1.8
  if (goal === 'fat_loss') proteinRatio = 2.0
  else if (goal === 'maintenance') proteinRatio = 1.6

  if (dietPreference === 'high_protein') proteinRatio += 0.3

  let proteinG = Math.round(referenceWeightKg * proteinRatio)
  let proteinKcal = proteinG * 4

  // Fat targets: 25% to 30% of total calories, minimum 0.6g/kg current weight for hormonal health
  const minFatG = Math.round(wt * 0.6)
  let fatPercent = goal === 'maintenance' ? 0.3 : 0.25
  if (dietPreference === 'low_carb') fatPercent = 0.40
  else if (dietPreference === 'low_fat') fatPercent = 0.20

  let fatKcal = Math.round(calories * fatPercent)
  let fatG = Math.max(minFatG, Math.round(fatKcal / 9))
  fatKcal = fatG * 9

  // Carbs: remainder of calories
  let carbKcal = Math.max(0, calories - proteinKcal - fatKcal)
  let carbsG = Math.round(carbKcal / 4)

  // Re-adjust protein/carbs if calories exceed target after fat floor
  const totalKcal = proteinG * 4 + fatG * 9 + carbsG * 4
  const diff = calories - totalKcal
  if (diff !== 0) {
    carbsG = Math.max(0, carbsG + Math.round(diff / 4))
  }

  return {
    proteinG,
    carbsG,
    fatG,
    proteinKcal: proteinG * 4,
    carbsKcal: carbsG * 4,
    fatKcal: fatG * 9
  }
}

/**
 * Calculate Water and Fibre Targets.
 */
export function calculateHealthTargets({ weightKg, calories, trainingHoursPerWeek = 3 }) {
  const wt = Number(weightKg) || 70
  // 35 ml/kg baseline + 500 ml per workout hour spread over the week
  const workoutAddonMl = Math.round(((trainingHoursPerWeek * 500) / 7))
  const waterMl = Math.round(wt * 35 + workoutAddonMl)

  // 14g fibre per 1,000 kcal, minimum 25g
  const fibreG = Math.max(25, Math.round((calories / 1000) * 14))

  return {
    waterMl,
    fibreG,
    sodiumMgLimit: 2300,
    sugarGramsLimit: Math.round((calories * 0.1) / 4) // <10% kcal
  }
}

/**
 * Match a starter workout plan from openGym's starter library.
 */
export function matchStarterWorkout({ daysPerWeek = 3, experience = 'intermediate', equipment = 'gym' }) {
  const days = Number(daysPerWeek) || 3

  if (days <= 2) {
    return {
      routineId: 'starter-fullbody-ab',
      name: 'Full Body A/B',
      description: '2 sessions per week alternating upper and lower compound exercises for maximum recovery.',
      daysPerWeek: 2,
      split: 'Full Body'
    }
  }

  if (days === 3) {
    return {
      routineId: 'starter-fullbody-abc',
      name: experience === 'beginner' ? 'Full Body 3-Day Foundation' : 'Full Body A/B/C Rotation',
      description: '3 sessions per week hitting major muscle groups with 48 hours rest between sessions.',
      daysPerWeek: 3,
      split: 'Full Body'
    }
  }

  if (days === 4) {
    return {
      routineId: 'starter-upper-lower',
      name: 'Upper / Lower 4-Day Split',
      description: '2 Upper days and 2 Lower days. Optimal balance of weekly training volume and localized muscle recovery.',
      daysPerWeek: 4,
      split: 'Upper/Lower'
    }
  }

  // 5 or 6 days
  return {
    routineId: 'starter-ppl',
    name: 'Push / Pull / Legs (PPL)',
    description: 'Targeted daily focus on pressing muscles, pulling muscles, and lower body.',
    daysPerWeek: Math.min(6, days),
    split: 'PPL'
  }
}

/**
 * Master Plan Generator: takes user onboarding inputs and returns a complete personalized plan.
 */
export function generatePersonalPlan(inputs) {
  const {
    age = 30,
    sex = null,
    heightCm = 175,
    weightKg = 75,
    targetWeightKg = 75,
    goal = 'fat_loss',
    pace = 'moderate',
    activityLevel = 'moderate',
    trainingDaysPerWeek = 4,
    experience = 'intermediate',
    bodyFatPercent = null,
    dietPreference = 'balanced',
    equipment = 'gym'
  } = inputs

  const bmr = calculateBmr({ weightKg, heightCm, age, sex, bodyFatPercent })
  const tdee = calculateTdee({ bmr, activityLevel })

  const goalResult = calculateGoalCalories({
    tdee,
    bmr,
    weightKg,
    targetWeightKg,
    goal,
    pace,
    sex,
    experience
  })

  const macros = calculateMacros({
    calories: goalResult.targetCalories,
    weightKg,
    heightCm,
    goal,
    dietPreference
  })

  const health = calculateHealthTargets({
    weightKg,
    calories: goalResult.targetCalories,
    trainingHoursPerWeek: trainingDaysPerWeek * 1.0
  })

  const workout = matchStarterWorkout({
    daysPerWeek: trainingDaysPerWeek,
    experience,
    equipment
  })

  return {
    bmr,
    tdee,
    calories: goalResult.targetCalories,
    dailyDeficitSurplus: goalResult.dailyAdjust,
    weeklyRateKg: goalResult.weeklyRateKg,
    estimatedWeeks: goalResult.estimatedWeeks,
    isSafetyCapped: goalResult.isCapped,
    calorieFloor: goalResult.floor,
    macros,
    health,
    workout,
    generatedAt: new Date().toISOString(),
    inputs: { ...inputs }
  }
}

/**
 * Build a targetHistory record from a generated or edited plan.
 */
export function createTargetHistoryEntry(plan, { effectiveFrom = null, manualOverride = false } = {}) {
  const dateStr = effectiveFrom || new Date().toISOString().slice(0, 10)
  return {
    id: `tgt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    effectiveFrom: dateStr,
    calories: plan.calories,
    proteinG: plan.macros.proteinG,
    carbsG: plan.macros.carbsG,
    fatG: plan.macros.fatG,
    waterMl: plan.health.waterMl,
    fibreG: plan.health.fibreG,
    mode: 'macros',
    method: 'mifflin_st_jeor_v1',
    manualOverride: !!manualOverride,
    inputs: plan.inputs || null,
    createdAt: new Date().toISOString()
  }
}

/**
 * Resolves active daily nutrition targets from store state, seamlessly handling
 * legacy dailyTargets, targetHistory entries, or user-overridden targets.
 */
export function getActiveTargets(S) {
  const latestHistory = Array.isArray(S?.targetHistory) && S.targetHistory.length > 0
    ? S.targetHistory[S.targetHistory.length - 1]
    : null

  const dailyCalories = Number(
    S?.targets?.dailyCalories ||
    S?.dailyTargets?.calories ||
    latestHistory?.calories ||
    2000
  )

  const proteinGrams = Number(
    S?.targets?.proteinGrams ||
    S?.targets?.macros?.proteinG ||
    S?.dailyTargets?.proteinG ||
    latestHistory?.proteinG ||
    150
  )

  const carbsGrams = Number(
    S?.targets?.carbsGrams ||
    S?.targets?.macros?.carbsG ||
    S?.dailyTargets?.carbsG ||
    latestHistory?.carbsG ||
    200
  )

  const fatGrams = Number(
    S?.targets?.fatGrams ||
    S?.targets?.macros?.fatG ||
    S?.dailyTargets?.fatG ||
    latestHistory?.fatG ||
    65
  )

  const waterMl = Number(
    S?.targets?.waterMl ||
    S?.dailyTargets?.waterMl ||
    latestHistory?.waterMl ||
    3000
  )

  const fiberGrams = Number(
    S?.targets?.fiberGrams ||
    S?.dailyTargets?.fibreG ||
    latestHistory?.fibreG ||
    30
  )

  return {
    dailyCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    waterMl,
    fiberGrams,
    macros: {
      proteinG: proteinGrams,
      carbsG: carbsGrams,
      fatG: fatGrams
    }
  }
}

