import { describe, it, expect } from 'vitest'
import {
  xpToNextLevel,
  cumulativeXpForLevel,
  getLevelInfo,
  calculateDailyXp,
  calculateTotalUserXp,
  calculateCharacterStats,
  getDailyQuests,
  evaluateBadges,
  getTitleForLevel,
  getFormForLevel
} from './index.js'

describe('Gamification: Leveling Curve and Titles', () => {
  it('calculates correct XP curve for level advancement', () => {
    expect(xpToNextLevel(1)).toBe(100) // 100 * 1^1.5 = 100
    expect(xpToNextLevel(2)).toBe(283) // 100 * 2^1.5 = 282.8 -> 283
    expect(xpToNextLevel(5)).toBe(1118) // 100 * 5^1.5 = 1118.03 -> 1118
  })

  it('calculates cumulative XP thresholds', () => {
    expect(cumulativeXpForLevel(1)).toBe(0)
    expect(cumulativeXpForLevel(2)).toBe(100)
    expect(cumulativeXpForLevel(3)).toBe(383) // 100 + 283
  })

  it('derives level info, title, and form from total XP', () => {
    const l1 = getLevelInfo(0)
    expect(l1.level).toBe(1)
    expect(l1.title).toBe('Rookie')
    expect(l1.form.name).toBe('Form I: Novice')
    expect(l1.progressPct).toBe(0)

    const l2 = getLevelInfo(150)
    expect(l2.level).toBe(2)
    expect(l2.title).toBe('Rookie')
    expect(l2.xpIntoCurrentLevel).toBe(50) // 150 - 100

    const l10 = getLevelInfo(12000)
    expect(l10.level).toBeGreaterThanOrEqual(10)
    expect(l10.title).toBe('Athlete')
    expect(l10.form.name).toContain('Form II')
  })

  it('matches titles and forms across progression tiers', () => {
    expect(getTitleForLevel(1).title).toBe('Rookie')
    expect(getTitleForLevel(5).title).toBe('Trainee')
    expect(getTitleForLevel(20).title).toBe('Contender')
    expect(getTitleForLevel(80).title).toBe('Mythic')

    expect(getFormForLevel(1).tier).toBe(1)
    expect(getFormForLevel(10).tier).toBe(2)
    expect(getFormForLevel(30).tier).toBe(4)
    expect(getFormForLevel(80).tier).toBe(8)
  })
})

describe('Gamification: Daily XP Calculation', () => {
  it('awards base XP for logging any food', () => {
    const res = calculateDailyXp({
      nutritionEntries: [{ meal: 'breakfast', nutrients: { calories: 300, protein: 10 } }]
    })
    expect(res.totalXp).toBe(10)
    expect(res.breakdown.some(b => b.label.includes('Logged a meal'))).toBe(true)
  })

  it('awards bonus for logging all 3 main meals', () => {
    const res = calculateDailyXp({
      nutritionEntries: [
        { meal: 'breakfast', nutrients: { calories: 400, protein: 20 } },
        { meal: 'lunch', nutrients: { calories: 600, protein: 35 } },
        { meal: 'dinner', nutrients: { calories: 700, protein: 45 } }
      ]
    })
    expect(res.totalXp).toBe(25) // 10 base + 15 all meals
  })

  it('awards bonus when calories land in ±10% target band', () => {
    const res = calculateDailyXp({
      nutritionEntries: [
        { meal: 'lunch', nutrients: { calories: 1950, protein: 50 } }
      ],
      targets: { dailyCalories: 2000, proteinGrams: 160 }
    })
    expect(res.totalXp).toBe(30) // 10 base + 20 in-target band
  })

  it('awards bonus for hitting protein and water targets', () => {
    const res = calculateDailyXp({
      nutritionEntries: [
        { meal: 'lunch', nutrients: { calories: 800, protein: 165 } }
      ],
      waterMl: 3200,
      targets: { dailyCalories: 2000, proteinGrams: 150, waterMl: 3000 }
    })
    // 10 base + 15 protein + 10 water = 35 XP
    expect(res.totalXp).toBe(35)
  })

  it('awards workout completion and PR XP', () => {
    const res = calculateDailyXp({
      workouts: [{ id: 'w1' }],
      prCount: 2,
      weighedIn: true
    })
    // 40 workout + (2 * 15 PR) + 5 weigh-in = 75 XP
    expect(res.totalXp).toBe(75)
  })
})

describe('Gamification: Lifetime XP uses the displayed nutrition targets', () => {
  it.each([
    ['legacy dailyTargets', { dailyTargets: { calories: 2500, proteinG: 100, waterMl: 3500 } }],
    ['latest target history', { targetHistory: [{ calories: 1800, proteinG: 130, waterMl: 2500 }, { calories: 2500, proteinG: 100, waterMl: 3500 }] }]
  ])('respects %s for calorie, protein, and water milestones', (_, S) => {
    const days = { '2026-10-31': { entries: [{ meal: 'lunch', nutrients: { calories: 2500, protein: 99 } }], waterMl: 3000 } }
    // Meal + calories only; neither the higher water goal nor the protein goal is met yet.
    expect(calculateTotalUserXp(S, days)).toBe(30)
    days['2026-10-31'].waterMl = 3500
    days['2026-10-31'].entries[0].nutrients.protein = 100
    expect(calculateTotalUserXp(S, days)).toBe(55)
  })

  it('keeps explicit current targets ahead of history and legacy values', () => {
    const S = {
      targets: { dailyCalories: 2000, macros: { proteinG: 150 }, waterMl: 3000 },
      dailyTargets: { calories: 2500, proteinG: 100, waterMl: 3500 },
      targetHistory: [{ calories: 2800, proteinG: 170, waterMl: 4000 }]
    }
    const days = { '2026-10-31': { entries: [{ meal: 'lunch', nutrients: { calories: 2000, protein: 150 } }], waterMl: 3000 } }
    expect(calculateTotalUserXp(S, days)).toBe(55)
  })

  it('retains the default nutrition milestones when a profile has no targets', () => {
    const days = { '2026-10-31': { entries: [{ meal: 'lunch', nutrients: { calories: 2000, protein: 150 } }], waterMl: 3000 } }
    expect(calculateTotalUserXp({}, days)).toBe(55)
  })
})

describe('Gamification: RPG Character Stats', () => {
  it('calculates 5 RPG stats clamped between 1 and 99', () => {
    const stats = calculateCharacterStats({
      workouts: [
        { vol: 8500, prs: ['bench_pr'], entries: [{ mode: 'bw', sets: [{ w: 0, r: 10 }] }] },
        { vol: 9200, entries: [{ sets: [{ w: 100, r: 5 }] }] }
      ],
      nutritionDays: {
        '2026-10-27': { entries: [{ nutrients: { calories: 2050, protein: 160 } }], waterMl: 3200 }
      },
      streak: 5,
      bodyweight: [{ d: '2026-10-27', w: 80 }],
      targets: { dailyCalories: 2000, proteinGrams: 150, waterMl: 3000 }
    })

    expect(stats.strength).toBeGreaterThan(10)
    expect(stats.strength).toBeLessThanOrEqual(99)
    expect(stats.endurance).toBeGreaterThanOrEqual(1)
    expect(stats.vitality).toBeGreaterThan(10)
    expect(stats.discipline).toBeGreaterThan(10)
    expect(stats.totalAverage).toBeGreaterThan(10)
  })
})

describe('Gamification: Quests & Badges', () => {
  it('generates 3 daily quests and evaluates progress', () => {
    const quests = getDailyQuests({
      dateStr: '2026-10-27',
      isRestDay: false,
      dayNutrition: {
        entries: [
          { meal: 'breakfast', nutrients: { calories: 400, protein: 30 } },
          { meal: 'lunch', nutrients: { calories: 600, protein: 45 } }
        ],
        waterMl: 2600
      },
      dayWorkouts: [{ id: 'w1' }],
      targets: { proteinGrams: 150, waterMl: 2500 }
    })

    expect(quests.length).toBe(3)
    // 2 meals logged -> quest 1 complete
    expect(quests[0].completed).toBe(true)
    // 2600ml >= 2500ml -> quest 2 complete
    expect(quests[1].completed).toBe(true)
    // 1 workout done -> quest 3 complete
    expect(quests[2].completed).toBe(true)
  })

  it('evaluates unlocked badges from user data', () => {
    const badges = evaluateBadges({
      workouts: [{ id: 'w1', prs: ['pr1'] }],
      nutritionDays: {
        '2026-10-27': { entries: [{ foodKey: 'off:3017620422003', nutrients: { calories: 400, protein: 20 } }], waterMl: 3000 }
      },
      recipes: [{ id: 'r1' }],
      bodyweight: [{ d: '2026-10-27', w: 75 }],
      streak: 7,
      level: 10
    })

    const firstMeal = badges.find(b => b.id === 'first_meal')
    expect(firstMeal?.unlocked).toBe(true)

    const firstWorkout = badges.find(b => b.id === 'first_workout')
    expect(firstWorkout?.unlocked).toBe(true)

    const firstPr = badges.find(b => b.id === 'first_pr')
    expect(firstPr?.unlocked).toBe(true)

    const streak7 = badges.find(b => b.id === 'streak_7')
    expect(streak7?.unlocked).toBe(true)

    const lvl10 = badges.find(b => b.id === 'level_10')
    expect(lvl10?.unlocked).toBe(true)
  })
})
