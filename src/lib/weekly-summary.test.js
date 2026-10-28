import { describe, expect, it } from 'vitest'
import { calculateWeeklySummary, getWeekRange } from './weekly-summary.js'

describe('weekly-summary.js', () => {
  describe('getWeekRange', () => {
    it('calculates Monday-start week correctly', () => {
      // 2026-10-28 is a Wednesday
      const range = getWeekRange('2026-10-28', 1)
      expect(range.startIso).toBe('2026-10-26') // Monday
      expect(range.endIso).toBe('2026-11-01')   // Sunday
      expect(range.days).toHaveLength(7)
      expect(range.days[0]).toBe('2026-10-26')
      expect(range.days[6]).toBe('2026-11-01')
    })

    it('calculates Sunday-start week correctly', () => {
      // 2026-10-28 is a Wednesday
      const range = getWeekRange('2026-10-28', 0)
      expect(range.startIso).toBe('2026-10-25') // Sunday
      expect(range.endIso).toBe('2026-10-31')   // Saturday
      expect(range.days).toHaveLength(7)
    })
  })

  describe('calculateWeeklySummary', () => {
    const mockTargets = {
      dailyCalories: 2200,
      macros: { proteinG: 160, carbsG: 220, fatG: 70 },
      waterMl: 3000
    }

    it('handles empty week data safely with appropriate warnings', () => {
      const summary = calculateWeeklySummary({
        workouts: [],
        nutritionDays: {},
        bodyweight: [],
        targets: mockTargets,
        weekStart: 1,
        referenceDate: '2026-10-28'
      })

      expect(summary.daysLoggedCount).toBe(0)
      expect(summary.avgCalories).toBe(0)
      expect(summary.workoutsCompleted).toBe(0)
      expect(summary.weighInCount).toBe(0)
      expect(summary.weightDelta).toBeNull()
      expect(summary.weightDisclaimer).toContain('water')

      const warning = summary.insights.find(i => i.title === 'No Nutrition Logged')
      expect(warning).toBeDefined()
    })

    it('calculates averages only across LOGGED days (never diluting with 0s)', () => {
      const nutritionDays = {
        '2026-10-26': {
          entries: [
            { nutrients: { calories: 2000, protein: 150, carbs: 200, fat: 60 } }
          ],
          waterMl: 3000
        },
        '2026-10-27': {
          entries: [
            { nutrients: { calories: 2400, protein: 170, carbs: 240, fat: 80 } }
          ],
          waterMl: 2500
        }
      }

      const summary = calculateWeeklySummary({
        workouts: [],
        nutritionDays,
        bodyweight: [],
        targets: mockTargets,
        weekStart: 1,
        referenceDate: '2026-10-28'
      })

      expect(summary.daysLoggedCount).toBe(2)
      // Total calories = 4400 / 2 days = 2200, NOT 4400 / 7
      expect(summary.avgCalories).toBe(2200)
      expect(summary.avgProtein).toBe(160)
      expect(summary.calorieDelta).toBe(0)
      expect(summary.calorieDeltaPct).toBe(0)

      // Only 2 days logged should trigger partial logging warning
      const partialWarn = summary.insights.find(i => i.title === 'Partial Nutrition Logging')
      expect(partialWarn).toBeDefined()
    })

    it('evaluates consistent week with workouts, weight trend and volume', () => {
      const nutritionDays = {
        '2026-10-26': { entries: [{ nutrients: { calories: 2150, protein: 165, carbs: 210, fat: 68 } }], waterMl: 3200 },
        '2026-10-27': { entries: [{ nutrients: { calories: 2220, protein: 160, carbs: 220, fat: 70 } }], waterMl: 3000 },
        '2026-10-28': { entries: [{ nutrients: { calories: 2180, protein: 155, carbs: 215, fat: 72 } }], waterMl: 2900 },
        '2026-10-29': { entries: [{ nutrients: { calories: 2250, protein: 170, carbs: 230, fat: 65 } }], waterMl: 3100 },
        '2026-10-30': { entries: [{ nutrients: { calories: 2190, protein: 162, carbs: 218, fat: 69 } }], waterMl: 3000 }
      }

      const workouts = [
        {
          d: '2026-10-26',
          entries: [
            { sets: [{ done: true, w: 100, r: 5 }, { done: true, w: 100, r: 5 }] }
          ]
        },
        {
          d: '2026-10-28',
          entries: [
            { sets: [{ done: true, w: 80, r: 8 }, { done: true, w: 80, r: 8 }] }
          ]
        },
        {
          d: '2026-10-30',
          entries: [
            { sets: [{ done: true, w: 120, r: 3 }, { done: true, w: 120, r: 3 }] }
          ]
        }
      ]

      const bodyweight = [
        { d: '2026-10-26', w: 80.5 },
        { d: '2026-10-28', w: 80.3 },
        { d: '2026-10-30', w: 80.1 }
      ]

      const summary = calculateWeeklySummary({
        workouts,
        nutritionDays,
        bodyweight,
        targets: mockTargets,
        weekStart: 1,
        referenceDate: '2026-10-28'
      })

      expect(summary.daysLoggedCount).toBe(5)
      expect(summary.workoutsCompleted).toBe(3)
      // Volume = (100*5 + 100*5) + (80*8 + 80*8) + (120*3 + 120*3) = 1000 + 1280 + 720 = 3000 kg
      expect(summary.totalVolumeKg).toBe(3000)
      expect(summary.totalSets).toBe(6)

      expect(summary.weighInCount).toBe(3)
      expect(summary.startWeight).toBe(80.5)
      expect(summary.endWeight).toBe(80.1)
      expect(summary.weightDelta).toBe(-0.4)

      // Calorie target dialed in insight
      const targetHit = summary.insights.find(i => i.title === 'Calorie Target Dialed In')
      expect(targetHit).toBeDefined()

      // Protein target achieved
      const proteinHit = summary.insights.find(i => i.title === 'Protein Target Achieved')
      expect(proteinHit).toBeDefined()

      // Strong gym consistency
      const gymCommit = summary.insights.find(i => i.title === 'Strong Gym Consistency')
      expect(gymCommit).toBeDefined()
    })
  })
})
