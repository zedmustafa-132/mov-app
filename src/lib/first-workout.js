import { uid } from './format.js'

export const EASY_START_KEY = 'easy-start-v1'
export const EASY_START_EXERCISES = ['3948', '0659', '2471']

// A small introduction, not an automatically assigned training schedule. It uses
// bodyweight so a first-time user is never given an invented working weight.
export function buildEasyStartRoutine(name) {
  return {
    id: uid(), name, emoji: 'figureStrength', quickStart: EASY_START_KEY,
    ex: EASY_START_EXERCISES.map(id => ({ id, sets: 2, reps: 8, weight: 0, restSec: 60 }))
  }
}

export const isEasyStartRoutine = routine => routine?.quickStart === EASY_START_KEY

export function needsFirstWorkout(state) {
  return !state?.active && !state?.workouts?.length && !state?.routines?.some(routine => routine.ex?.length > 0)
}
