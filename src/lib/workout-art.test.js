import { describe, expect, it } from 'vitest'
import { workoutArtwork, workoutArtStyle, WORKOUT_ART } from './workout-art.js'

describe('workout artwork selection', () => {
  it.each([['Push Day', 'push'], ['PULL B', 'pull'], ['Leg day', 'legs'], ['Upper body', 'upper'], ['Full-body strength', 'fullbody'], ['Arms', 'arms'], ['Abs & core', 'core'], ['Cardio intervals', 'cardio'], ['Recovery & mobility', 'mobility'], ['Lower body', 'legs']])('matches %s to its own artwork', (name, key) => {
    expect(workoutArtwork({ name }).key).toBe(key)
  })
  it('keeps the same pictures when routines are reordered or copied', () => {
    const routines = [{ name: 'Leg Day' }, { name: 'Push Day' }, { name: 'Pull Day' }]
    const first = Object.fromEntries(routines.map(routine => [routine.name, workoutArtwork(routine).image]))
    expect(Object.fromEntries([...routines].reverse().map(routine => [routine.name, workoutArtwork(routine).image]))).toEqual(first)
    expect(workoutArtwork({ name: 'Push Day (copy)' }).image).toBe(first['Push Day'])
  })
  it('uses catalogue muscle groups for unnamed/custom-titled sessions', () => {
    expect(workoutArtwork({ name: 'Day A', ex: [{ id: '0025' }] }).key).toBe('push')
    expect(workoutArtwork({ name: 'Day B', ex: [{ id: '0027' }] }).key).toBe('pull')
    expect(workoutArtwork({ name: 'Session', ex: [{ bp: 'upper legs' }] }).key).toBe('legs')
    expect(workoutArtwork({ name: 'Session', ex: [{ bp: 'chest' }, { bp: 'back' }] }).key).toBe('upper')
    expect(workoutArtwork({ name: 'Session', ex: [{ bp: 'upper legs' }, { bp: 'chest' }] }).key).toBe('fullbody')
  })
  it('uses a combined cover for multi-routine days, and a safe cover for blank plans', () => {
    expect(workoutArtwork([{ name: 'Push Day' }, { name: 'Leg Day' }]).key).toBe('fullbody')
    expect(workoutArtwork([{ name: 'Push Day' }, { name: 'Pull Day' }]).key).toBe('upper')
    expect(workoutArtwork([{ name: 'Core' }, { name: 'Cardio' }]).key).toBe('fullbody')
    expect(workoutArtwork(null).key).toBe('fullbody')
  })
  it('uses small thumbnail files in lists and gives every workout type a distinct image', () => {
    expect(new Set(Object.values(WORKOUT_ART).map(art => art.image)).size).toBe(9)
    expect(workoutArtStyle({ name: 'Pull day' }, true)['--workout-cover']).toContain('pull-thumb.webp')
    expect(workoutArtStyle({ name: 'Pull day' })['--workout-cover']).toContain('pull.webp')
  })
})
