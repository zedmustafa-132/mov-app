// useGamification.js — Reactive hook for NXT FORM gamification state
import { useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { useNutrition } from '../../store/useNutrition.js'
import { todayISO } from '../format.js'
import { streakWeeks } from '../history.js'
import {
  calculateTotalUserXp,
  getLevelInfo,
  calculateCharacterStats,
  getDailyQuests,
  getWeeklyQuests,
  evaluateBadges
} from './index.js'

const EMPTY_OBJ = Object.freeze({})
const EMPTY_ARR = Object.freeze([])

export function useGamification() {
  const S = useStore(s => s.S)
  const rawDays = useNutrition(s => s.days)
  const nutritionDays = rawDays || EMPTY_OBJ
  const rawRecipes = useNutrition(s => s.recipes)
  const recipes = rawRecipes || EMPTY_ARR

  const todayStr = todayISO()
  const todayNutrition = nutritionDays[todayStr] || { entries: [], waterMl: 0 }
  const todayWorkouts = (S.workouts || []).filter(w => w.d === todayStr)
  const weighedInToday = (S.bodyweight || []).some(b => b.d === todayStr)

  // Consecutive daily streak (calculated from workouts and nutrition days)
  const streakDays = useMemo(() => {
    let current = 0
    const now = new Date()
    while (true) {
      const d = new Date(now)
      d.setDate(d.getDate() - current)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const hasWorkout = (S.workouts || []).some(w => w.d === iso)
      const hasFood = (nutritionDays[iso]?.entries?.length || 0) > 0
      const hasBw = (S.bodyweight || []).some(b => b.d === iso)

      if (hasWorkout || hasFood || hasBw) {
        current++
      } else {
        // Today might not be logged yet, don't break on today if checking
        if (current === 0) {
          current = 0
          // Check yesterday to see if streak is still active
          const yest = new Date(now)
          yest.setDate(yest.getDate() - 1)
          const yestIso = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`
          const yestActive = (S.workouts || []).some(w => w.d === yestIso) || (nutritionDays[yestIso]?.entries?.length || 0) > 0
          if (yestActive) {
            current = 1
            continue
          }
        }
        break
      }
    }
    return current
  }, [S.workouts, S.bodyweight, nutritionDays])

  // Banked streak freezes (earn 1 per 7-day streak, max 2 banked)
  const streakFreezes = Math.min(2, Math.floor(streakDays / 7))

  // Total Lifetime XP & Level
  const totalXp = useMemo(() => {
    return calculateTotalUserXp(S, nutritionDays)
  }, [S, nutritionDays])

  const levelInfo = useMemo(() => {
    return getLevelInfo(totalXp)
  }, [totalXp])

  // 5 RPG Stats (1–99)
  const characterStats = useMemo(() => {
    return calculateCharacterStats({
      workouts: S.workouts || [],
      nutritionDays,
      streak: streakDays,
      bodyweight: S.bodyweight || [],
      targets: S.targets || {}
    })
  }, [S.workouts, S.bodyweight, S.targets, nutritionDays, streakDays])

  // Daily Quests
  const isRestDay = (S.routines?.length || 0) > 0 && !(S.active) && todayWorkouts.length === 0
  const dailyQuests = useMemo(() => {
    return getDailyQuests({
      dateStr: todayStr,
      isRestDay,
      dayNutrition: todayNutrition,
      dayWorkouts: todayWorkouts,
      weighedInToday,
      targets: S.targets || {}
    })
  }, [todayStr, isRestDay, todayNutrition, todayWorkouts, weighedInToday, S.targets])

  // Weekly Quests
  const weeklyQuests = useMemo(() => {
    const workoutsCount = (S.workouts || []).filter(w => {
      const diff = (new Date() - new Date(w.d)) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    }).length

    let protDays = 0
    const targetProt = S.targets?.proteinGrams || 150
    for (const [d, data] of Object.entries(nutritionDays)) {
      const diff = (new Date() - new Date(d)) / (1000 * 60 * 60 * 24)
      if (diff >= 0 && diff <= 7) {
        const sumProt = (data.entries || []).reduce((s, e) => s + (e.nutrients?.protein || e.nutrients?.proteinG || 0), 0)
        if (sumProt >= targetProt) protDays++
      }
    }

    return getWeeklyQuests({
      weekWorkoutsCount: workoutsCount,
      weekProteinDays: protDays,
      plannedWorkouts: S.routines?.length || 3
    })
  }, [S.workouts, S.routines, S.targets, nutritionDays])

  // Badges
  const badges = useMemo(() => {
    return evaluateBadges({
      workouts: S.workouts || [],
      nutritionDays,
      recipes,
      bodyweight: S.bodyweight || [],
      streak: streakDays,
      level: levelInfo.level,
      targets: S.targets || {}
    })
  }, [S.workouts, S.bodyweight, S.targets, nutritionDays, recipes, streakDays, levelInfo.level])

  return {
    totalXp,
    levelInfo,
    characterStats,
    dailyQuests,
    weeklyQuests,
    badges,
    streakDays,
    streakFreezes
  }
}
