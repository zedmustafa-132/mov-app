// badges.js — Badge evaluation and achievements catalog for NXT FORM
// Implements docs/GAMIFICATION.md §9

export const BADGES_CATALOG = [
  {
    id: 'first_meal',
    title: 'First Fuel',
    desc: 'Logged your very first meal into your nutrition diary',
    icon: 'utensils',
    category: 'nutrition'
  },
  {
    id: 'first_workout',
    title: 'First Rep',
    desc: 'Completed your first recorded training session',
    icon: 'dumbbell',
    category: 'training'
  },
  {
    id: 'first_pr',
    title: 'Breaking Limits',
    desc: 'Set your first personal record in the gym',
    icon: 'trophy',
    category: 'training'
  },
  {
    id: 'first_weighin',
    title: 'Accountability',
    desc: 'Logged your starting body weight',
    icon: 'scale',
    category: 'discipline'
  },
  {
    id: 'first_recipe',
    title: 'Chef Form',
    desc: 'Crafted and saved your first custom recipe',
    icon: 'clipboard',
    category: 'nutrition'
  },
  {
    id: 'barcode_scanner',
    title: 'Smart Shopper',
    desc: 'Scanned a packaged food barcode with camera',
    icon: 'barcode',
    category: 'nutrition'
  },
  {
    id: 'streak_3',
    title: 'Momentum',
    desc: 'Maintained a 3-day active logging streak',
    icon: 'flame',
    category: 'discipline'
  },
  {
    id: 'streak_7',
    title: 'Iron Week',
    desc: 'Maintained a 7-day active logging streak',
    icon: 'flame',
    category: 'discipline'
  },
  {
    id: 'streak_30',
    title: 'Unshakable',
    desc: 'Reached an elite 30-day active streak',
    icon: 'crown',
    category: 'discipline'
  },
  {
    id: 'workouts_10',
    title: 'Consistent Lifter',
    desc: 'Completed 10 workouts',
    icon: 'dumbbell',
    category: 'training'
  },
  {
    id: 'workouts_50',
    title: 'Iron Veteran',
    desc: 'Completed 50 workouts',
    icon: 'trophy',
    category: 'training'
  },
  {
    id: 'protein_7',
    title: 'Protein Master',
    desc: 'Hit your daily protein target on 7 separate days',
    icon: 'bolt',
    category: 'nutrition'
  },
  {
    id: 'hydration_7',
    title: 'Hydration Hero',
    desc: 'Reached your daily water target on 7 separate days',
    icon: 'drop',
    category: 'nutrition'
  },
  {
    id: 'level_5',
    title: 'Trainee Rank',
    desc: 'Reached Account Level 5',
    icon: 'star',
    category: 'progression'
  },
  {
    id: 'level_10',
    title: 'Awakened Form',
    desc: 'Reached Level 10 and evolved into Form II',
    icon: 'sparkles',
    category: 'progression'
  },
  {
    id: 'level_25',
    title: 'Elite Titan',
    desc: 'Reached Account Level 25',
    icon: 'crown',
    category: 'progression'
  }
]

/**
 * Evaluate which badges have been unlocked based on store data.
 * @param {Object} data
 * @param {Array} data.workouts - Workouts from store
 * @param {Object} data.nutritionDays - Days logged in nutrition store
 * @param {Array} data.recipes - User recipes
 * @param {Array} data.bodyweight - Weigh-ins
 * @param {number} data.streak - Active streak days
 * @param {number} data.level - Current user level
 * @param {Object} data.targets - Nutrition targets
 * @returns {Array<{ ...badge, unlocked: boolean, progress: number, maxProgress: number }>}
 */
export function evaluateBadges({
  workouts = [],
  nutritionDays = {},
  recipes = [],
  bodyweight = [],
  streak = 0,
  level = 1,
  targets = {}
} = {}) {
  const allWorkouts = Array.isArray(workouts) ? workouts : []
  const days = Object.values(nutritionDays || {})
  const totalMeals = days.reduce((sum, d) => sum + (d?.entries?.length || 0), 0)
  const totalPRs = allWorkouts.reduce((sum, w) => sum + (w.prs?.length || 0), 0)

  const protTarget = targets.proteinGrams || 150
  const waterTarget = targets.waterMl || 3000

  let proteinHits = 0
  let waterHits = 0
  let scannedCount = 0

  for (const d of days) {
    let dayProt = 0
    for (const e of d.entries || []) {
      dayProt += e.nutrients?.protein ?? e.nutrients?.proteinG ?? 0
      if (e.foodKey?.startsWith('off:') || e.barcode) scannedCount++
    }
    if (dayProt >= protTarget) proteinHits++
    if ((d.waterMl || 0) >= waterTarget) waterHits++
  }

  const results = BADGES_CATALOG.map(badge => {
    let unlocked = false
    let progress = 0
    let maxProgress = 1

    switch (badge.id) {
      case 'first_meal':
        progress = Math.min(1, totalMeals)
        maxProgress = 1
        unlocked = totalMeals > 0
        break
      case 'first_workout':
        progress = Math.min(1, allWorkouts.length)
        maxProgress = 1
        unlocked = allWorkouts.length > 0
        break
      case 'first_pr':
        progress = Math.min(1, totalPRs)
        maxProgress = 1
        unlocked = totalPRs > 0
        break
      case 'first_weighin':
        progress = Math.min(1, bodyweight.length)
        maxProgress = 1
        unlocked = bodyweight.length > 0
        break
      case 'first_recipe':
        progress = Math.min(1, recipes.length)
        maxProgress = 1
        unlocked = recipes.length > 0
        break
      case 'barcode_scanner':
        progress = Math.min(1, scannedCount)
        maxProgress = 1
        unlocked = scannedCount > 0
        break
      case 'streak_3':
        progress = Math.min(3, streak)
        maxProgress = 3
        unlocked = streak >= 3
        break
      case 'streak_7':
        progress = Math.min(7, streak)
        maxProgress = 7
        unlocked = streak >= 7
        break
      case 'streak_30':
        progress = Math.min(30, streak)
        maxProgress = 30
        unlocked = streak >= 30
        break
      case 'workouts_10':
        progress = Math.min(10, allWorkouts.length)
        maxProgress = 10
        unlocked = allWorkouts.length >= 10
        break
      case 'workouts_50':
        progress = Math.min(50, allWorkouts.length)
        maxProgress = 50
        unlocked = allWorkouts.length >= 50
        break
      case 'protein_7':
        progress = Math.min(7, proteinHits)
        maxProgress = 7
        unlocked = proteinHits >= 7
        break
      case 'hydration_7':
        progress = Math.min(7, waterHits)
        maxProgress = 7
        unlocked = waterHits >= 7
        break
      case 'level_5':
        progress = Math.min(5, level)
        maxProgress = 5
        unlocked = level >= 5
        break
      case 'level_10':
        progress = Math.min(10, level)
        maxProgress = 10
        unlocked = level >= 10
        break
      case 'level_25':
        progress = Math.min(25, level)
        maxProgress = 25
        unlocked = level >= 25
        break
      default:
        unlocked = false
    }

    return {
      ...badge,
      unlocked,
      progress,
      maxProgress
    }
  })

  return results
}
