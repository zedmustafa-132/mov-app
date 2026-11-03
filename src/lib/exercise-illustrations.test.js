import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { ILLUSTRATION_IDS, illustrationFor } from './exercise-illustrations.js'

describe('original exercise illustrations', () => {
  it('covers all six default suggestions with their actual movement', () => {
    for (const id of ['3948', '0662', '0025', '0293', '0150', '0294']) expect(illustrationFor(EXIDX[id])).toBeTruthy()
    expect(illustrationFor(EXIDX['2258']).kind).toBe('walking')
  })
  it('has valid bounded poses for real catalogue entries', () => {
    for (const id of Object.keys(ILLUSTRATION_IDS)) {
      expect(EXIDX[id], id).toBeTruthy()
      const demo = illustrationFor(EXIDX[id])
      expect(demo.cue.length).toBeGreaterThan(5)
      for (const pose of demo.poses) {
        expect(Object.keys(pose)).toHaveLength(13)
        for (const point of Object.values(pose)) {
          expect(point).toHaveLength(2)
          expect(point.every(n => Number.isFinite(n) && n >= 0 && n <= 230)).toBe(true)
        }
      }
    }
  })
  it('recognises an explicitly linked figure without matching an arbitrary name', () => {
    expect(illustrationFor({ id: 'figure-variant', mv: '0025' })?.kind).toBe('bench')
    expect(illustrationFor({ id: 'unrelated', n: 'barbell bench press' })).toBeNull()
  })
  it('never substitutes a generic movement for an unsupported or custom exercise', () => {
    expect(illustrationFor(EXIDX['0739'])).toBeNull()
    expect(illustrationFor({ id: 'c1', n: 'Air squat', mv: '3948' })).toBeNull()
    expect(illustrationFor({ ...EXIDX['3948'], custom: true })).toBeNull()
    expect(illustrationFor(null)).toBeNull()
  })
  it('treats a plank as a hold instead of repeating push-ups', () => {
    const demo = illustrationFor(EXIDX['0463'])
    expect(demo.hold).toBe(true)
    expect(demo.poses).toHaveLength(1)
  })
})
