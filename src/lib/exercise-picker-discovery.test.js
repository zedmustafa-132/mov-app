import { describe, expect, it } from 'vitest'
import { pickerSuggestions, recentPickerIds } from './exercise-picker-discovery.js'

describe('exercise picker discovery', () => {
  it('uses active and recent sessions without mutating workout order or repeating exercises', () => {
    const S = { active: { entries: [{ id: 'a' }, { id: 'b' }] }, workouts: [
      { d: '2026-01-01', entries: [{ id: 'old' }] },
      { d: '2026-02-01', entries: [{ id: 'a' }, { id: 'recent' }] }
    ] }
    expect(recentPickerIds(S)).toEqual(['b', 'a', 'recent', 'old'])
    expect(S.workouts[0].entries[0].id).toBe('old')
  })

  it('prioritises available favourites and recent exercises while respecting the equipment-filtered catalogue', () => {
    const available = [{ id: '3948' }, { id: 'favourite' }, { id: 'recent' }, { id: 'fallback' }]
    const S = { favEx: ['unavailable', 'favourite'], workouts: [{ d: '2026-01-01', entries: [{ id: 'recent' }] }] }
    expect(pickerSuggestions(S, available).map(e => e.id)).toEqual(['favourite', 'recent', '3948', 'fallback'])
  })

  it('offers a short useful starting set and handles a narrow catalogue', () => {
    const available = ['other', '2258', '0025', '0662', '3948', '0293', '0150', '0294'].map(id => ({ id }))
    expect(pickerSuggestions({}, available).map(e => e.id)).toEqual(['3948', '0662', '0025', '0293', '0150', '0294'])
    expect(pickerSuggestions({}, [])).toEqual([])
  })
})
