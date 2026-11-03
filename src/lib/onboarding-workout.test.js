import { describe, expect, it } from 'vitest'
import { applyOnboardingWorkout, buildOnboardingWorkout } from './onboarding-workout.js'
import { generatePersonalPlan } from './targets.js'
import { EXIDX } from './exercises.js'
import { eqAvailable } from './equipment.js'

const personalPlan = (days = 4, equipment = 'gym') => generatePersonalPlan({ trainingDaysPerWeek: days, equipment })
const emptyTraining = () => ({ routines: [], week: {}, dayPlan: {}, queue: null, rotation: null })

describe('onboarding creates usable training, not just a recommendation label', () => {
  it('creates the reviewed four-day split with exercises and matching weekday references', () => {
    const state = emptyTraining()
    expect(applyOnboardingWorkout(state, personalPlan())).toBe(true)
    expect(state.routines.map(r => r.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(Object.keys(state.week)).toHaveLength(4)
    state.routines.forEach(r => expect(r.ex.length).toBeGreaterThan(0))
    Object.values(state.week).flat().forEach(id => expect(state.routines.some(r => r.id === id)).toBe(true))
    expect(state.scheduleMode).toBe('week')
  })

  it.each([2, 3, 4, 5, 6])('uses the chosen %i days per week', days => {
    const built = buildOnboardingWorkout(personalPlan(days))
    expect(built.schedule).toHaveLength(days)
    expect(new Set(built.schedule.map(s => s.day)).size).toBe(days)
    expect(built.routines).toHaveLength(days <= 4 ? days : 3)
  })

  it.each([['bodyweight', []], ['dumbbells', ['dumbbell']]])('fits %s plans to equipment the user actually selected', (equipment, available) => {
    const built = buildOnboardingWorkout(personalPlan(4, equipment))
    expect(built.routines.length).toBeGreaterThan(0)
    built.routines.forEach(routine => {
      expect(routine.ex.length).toBeGreaterThan(0)
      routine.ex.forEach(slot => expect(eqAvailable(available, EXIDX[slot.id])).toBe(true))
    })
  })

  it.each([
    { routines: [{ id: 'mine', name: 'My workout', ex: [] }] },
    { week: { 2: ['existing'] } },
    { dayPlan: { '2026-10-31': ['existing'] } },
    { queue: { ids: ['existing'] } },
    { rotation: { sequence: ['existing'] } },
    { scheduleMode: 'rotation' }
  ])('preserves an existing training setup: %j', existing => {
    const state = { ...emptyTraining(), ...existing }
    const before = structuredClone(state)
    expect(applyOnboardingWorkout(state, personalPlan())).toBe(false)
    expect(state).toEqual(before)
  })

  it('keeps the plan empty when the user chooses their own workouts', () => {
    const state = emptyTraining()
    const before = structuredClone(state)
    expect(applyOnboardingWorkout(state, personalPlan(), false)).toBe(false)
    expect(state).toEqual(before)
  })

  it('never creates an unreviewed workout when no recommendation is available', () => {
    const state = emptyTraining()
    expect(applyOnboardingWorkout(state, null)).toBe(false)
    expect(state).toEqual(emptyTraining())
  })

  it('never duplicates workouts if completion is retried', () => {
    const state = emptyTraining()
    expect(applyOnboardingWorkout(state, personalPlan())).toBe(true)
    const before = structuredClone(state)
    expect(applyOnboardingWorkout(state, personalPlan())).toBe(false)
    expect(state).toEqual(before)
  })
})
