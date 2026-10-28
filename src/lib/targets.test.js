import { describe, it, expect } from 'vitest'
import {
  calculateBmr,
  calculateTdee,
  calculateGoalCalories,
  calculateMacros,
  calculateHealthTargets,
  matchStarterWorkout,
  generatePersonalPlan,
  createTargetHistoryEntry,
  getActiveTargets
} from './targets.js'

describe('Plan Engine — targets.js', () => {
  describe('BMR calculation', () => {
    it('calculates Mifflin–St Jeor correctly for male', () => {
      // 10*90 + 6.25*180 - 5*30 + 5 = 900 + 1125 - 150 + 5 = 1880
      const bmr = calculateBmr({ weightKg: 90, heightCm: 180, age: 30, sex: 'male' })
      expect(bmr).toBe(1880)
    })

    it('calculates Mifflin–St Jeor correctly for female', () => {
      // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
      const bmr = calculateBmr({ weightKg: 60, heightCm: 165, age: 28, sex: 'female' })
      expect(bmr).toBe(1330)
    })

    it('uses neutral average (-78) when sex is omitted', () => {
      // 10*75 + 6.25*175 - 5*30 - 78 = 750 + 1093.75 - 150 - 78 = 1615.75 -> 1616
      const bmr = calculateBmr({ weightKg: 75, heightCm: 175, age: 30, sex: null })
      expect(bmr).toBe(1616)
    })

    it('calculates Katch–McArdle when valid bodyFatPercent is provided', () => {
      // lean mass = 80 * (1 - 0.20) = 64 kg. 370 + 21.6 * 64 = 1752.4 -> 1752
      const bmr = calculateBmr({ weightKg: 80, heightCm: 175, age: 30, bodyFatPercent: 20 })
      expect(bmr).toBe(1752)
    })
  })

  describe('TDEE calculation', () => {
    it('applies correct activity multiplier', () => {
      expect(calculateTdee({ bmr: 1880, activityLevel: 'sedentary' })).toBe(Math.round(1880 * 1.2))
      expect(calculateTdee({ bmr: 1880, activityLevel: 'moderate' })).toBe(Math.round(1880 * 1.55))
      expect(calculateTdee({ bmr: 1880, activityLevel: 'active' })).toBe(Math.round(1880 * 1.725))
    })
  })

  describe('Goal calories & safety floors', () => {
    it('calculates moderate deficit (0.5% body weight/week)', () => {
      // wt: 90kg -> 0.45 kg/week * 7700 / 7 = 495 kcal/day
      const res = calculateGoalCalories({
        tdee: 2914,
        bmr: 1880,
        weightKg: 90,
        targetWeightKg: 80,
        goal: 'fat_loss',
        pace: 'moderate',
        sex: 'male'
      })
      expect(res.targetCalories).toBe(2420) // 2914 - 495 = 2419 rounded to nearest 10 = 2420
      expect(res.estimatedWeeks).toBeGreaterThan(15)
      expect(res.estimatedWeeks).toBeLessThan(35)
      expect(res.isCapped).toBe(false)
    })

    it('enforces safety cap: maximum deficit cannot exceed 25% of TDEE', () => {
      const res = calculateGoalCalories({
        tdee: 2000,
        bmr: 1400,
        weightKg: 100,
        targetWeightKg: 70,
        goal: 'fat_loss',
        pace: 'aggressive',
        sex: 'female'
      })
      // 25% of 2000 is 500 kcal max deficit
      expect(Math.abs(res.dailyDeficitSurplus)).toBeLessThanOrEqual(500)
      expect(res.targetCalories).toBeGreaterThanOrEqual(1500)
    })

    it('enforces hard safety floor: never drops below BMR or sex minimum', () => {
      const res = calculateGoalCalories({
        tdee: 1600,
        bmr: 1450,
        weightKg: 65,
        targetWeightKg: 55,
        goal: 'fat_loss',
        pace: 'aggressive',
        sex: 'female'
      })
      // Should not drop below BMR (1450)
      expect(res.targetCalories).toBeGreaterThanOrEqual(1450)
      expect(res.isCapped).toBe(true)
    })
  })

  describe('Macro calculations', () => {
    it('calculates macros for fat loss and reconciles total kcal', () => {
      const macros = calculateMacros({
        calories: 2420,
        weightKg: 90,
        heightCm: 180,
        goal: 'fat_loss'
      })
      // 90 kg * 2.0g = 180g protein
      expect(macros.proteinG).toBe(180)
      // Fat >= 0.6g/kg (54g), 25% of 2420 = 605 kcal / 9 = ~67g
      expect(macros.fatG).toBe(67)
      // Remainder carbs: (2420 - 720 - 603) / 4 = ~274g
      expect(macros.carbsG).toBeGreaterThan(250)

      // Total macros energy must match calories within 2%
      const totalKcal = macros.proteinG * 4 + macros.fatG * 9 + macros.carbsG * 4
      expect(Math.abs(totalKcal - 2420)).toBeLessThanOrEqual(50)
    })

    it('adjusts reference weight for obese BMI (BMI >= 30)', () => {
      // 170cm, 120kg -> BMI = 41.5
      // Reference weight at BMI 25 = 25 * 1.7^2 = 72.25 kg
      const macros = calculateMacros({
        calories: 2000,
        weightKg: 120,
        heightCm: 170,
        goal: 'fat_loss'
      })
      // Protein should be based on ~72kg * 2.0 = ~145g, NOT 120kg * 2.0 (240g)
      expect(macros.proteinG).toBeLessThan(160)
      expect(macros.proteinG).toBeGreaterThan(130)
    })
  })

  describe('Starter Workout Matcher', () => {
    it('matches 2-day routine to Full Body A/B', () => {
      const w = matchStarterWorkout({ daysPerWeek: 2 })
      expect(w.split).toBe('Full Body')
      expect(w.daysPerWeek).toBe(2)
    })

    it('matches 4-day routine to Upper / Lower split', () => {
      const w = matchStarterWorkout({ daysPerWeek: 4 })
      expect(w.split).toBe('Upper/Lower')
      expect(w.daysPerWeek).toBe(4)
    })

    it('matches 5 or 6 days to PPL', () => {
      const w = matchStarterWorkout({ daysPerWeek: 5 })
      expect(w.split).toBe('PPL')
    })
  })

  describe('End-to-End generatePersonalPlan', () => {
    it('matches the worked example from docs/PLAN_ENGINE.md §11', () => {
      const plan = generatePersonalPlan({
        age: 30,
        sex: 'male',
        heightCm: 180,
        weightKg: 90,
        targetWeightKg: 80,
        goal: 'fat_loss',
        pace: 'moderate',
        activityLevel: 'moderate',
        trainingDaysPerWeek: 4,
        experience: 'intermediate'
      })

      expect(plan.bmr).toBe(1880)
      expect(plan.tdee).toBe(2914)
      expect(plan.calories).toBe(2420)
      expect(plan.macros.proteinG).toBe(180)
      expect(plan.macros.fatG).toBe(67)
      expect(plan.health.waterMl).toBeGreaterThan(3100)
      expect(plan.health.fibreG).toBeGreaterThanOrEqual(30)
      expect(plan.workout.split).toBe('Upper/Lower')

      // Create targetHistory record
      const history = createTargetHistoryEntry(plan)
      expect(history.calories).toBe(2420)
      expect(history.proteinG).toBe(180)
      expect(history.effectiveFrom).toBeDefined()
    })
  })

  describe('getActiveTargets resolution', () => {
    it('resolves dailyCalories and macros from targets property when present', () => {
      const state = {
        targets: {
          dailyCalories: 2500,
          proteinGrams: 180,
          carbsGrams: 260,
          fatGrams: 75,
          waterMl: 3200
        }
      }
      const active = getActiveTargets(state)
      expect(active.dailyCalories).toBe(2500)
      expect(active.proteinGrams).toBe(180)
      expect(active.carbsGrams).toBe(260)
      expect(active.fatGrams).toBe(75)
      expect(active.waterMl).toBe(3200)
    })

    it('falls back to dailyTargets when targets is missing', () => {
      const state = {
        dailyTargets: {
          calories: 2500,
          proteinG: 175,
          carbsG: 250,
          fatG: 70,
          waterMl: 3100,
          fibreG: 35
        }
      }
      const active = getActiveTargets(state)
      expect(active.dailyCalories).toBe(2500)
      expect(active.proteinGrams).toBe(175)
      expect(active.carbsGrams).toBe(250)
      expect(active.fatGrams).toBe(70)
      expect(active.waterMl).toBe(3100)
      expect(active.fiberGrams).toBe(35)
    })

    it('falls back to latest targetHistory entry when targets and dailyTargets are missing', () => {
      const state = {
        targetHistory: [
          { calories: 2200, proteinG: 150, carbsG: 200, fatG: 60 },
          { calories: 2500, proteinG: 180, carbsG: 260, fatG: 75, waterMl: 3300 }
        ]
      }
      const active = getActiveTargets(state)
      expect(active.dailyCalories).toBe(2500)
      expect(active.proteinGrams).toBe(180)
      expect(active.waterMl).toBe(3300)
    })

    it('returns 2000 kcal default when no targets exist in state', () => {
      const active = getActiveTargets({})
      expect(active.dailyCalories).toBe(2000)
      expect(active.proteinGrams).toBe(150)
      expect(active.carbsGrams).toBe(200)
      expect(active.fatGrams).toBe(65)
      expect(active.waterMl).toBe(3000)
    })
  })
})
