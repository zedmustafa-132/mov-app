import { buildStarterPlan } from './starter.js'

const DAYS_BY_COUNT = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6]
}

// Onboarding may run on a device that already has a plan. Never replace it silently.
export function hasExistingTrainingPlan(state) {
  return !!(
    state?.routines?.length ||
    Object.values(state?.week || {}).some(ids => [].concat(ids || []).some(Boolean)) ||
    Object.keys(state?.dayPlan || {}).length ||
    state?.queue || state?.rotation || state?.scheduleMode === 'rotation'
  )
}

// Materialize the plan the review screen recommends using the existing starter catalogue.
// Repeated training days reuse the same routine, so later edits stay consistent.
export function buildOnboardingWorkout(plan) {
  if (!plan?.workout) return null
  const days = Math.max(2, Math.min(6, Math.round(Number(plan?.workout?.daysPerWeek) || 3)))
  const id = days <= 3 ? 'full-body' : days === 4 ? 'upper-lower' : 'ppl'
  const equipmentChoice = plan?.inputs?.equipment || 'gym'
  const equipment = equipmentChoice === 'bodyweight' ? [] : equipmentChoice === 'dumbbells' ? ['dumbbell'] : undefined
  const source = buildStarterPlan(id, equipment)
  if (!source?.routines?.length) return null
  const routines = days === 2 ? source.routines.slice(0, 2) : source.routines
  return {
    routines,
    schedule: DAYS_BY_COUNT[days].map((day, i) => ({ day, routineId: routines[i % routines.length].id }))
  }
}

export function applyOnboardingWorkout(state, plan, enabled = true) {
  if (!enabled || hasExistingTrainingPlan(state)) return false
  const workout = buildOnboardingWorkout(plan)
  if (!workout) return false
  state.routines = workout.routines
  state.week = { ...(state.week || {}) }
  workout.schedule.forEach(({ day, routineId }) => { state.week[day] = [routineId] })
  state.scheduleMode = 'week'
  return true
}
