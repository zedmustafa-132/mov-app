// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkoutNow } from './sheets.jsx'
import { EXIDX } from './lib/exercises.js'
import { setNav } from './lib/nav.js'

const clone = value => JSON.parse(JSON.stringify(value))
const current = () => useStore.getState().S
const navigate = vi.fn()
let host, root

const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const tile = name => [...host.querySelectorAll('.tiles.fin .tile')].find(t => t.querySelector('.l')?.textContent === name)
const bench = () => ({ id: '0025', target: { mode: 'reps', sets: 1, reps: 8, weight: 40 }, sets: [{ w: 40, r: 8, done: true }] })
const raise = () => ({ id: '0334', target: { mode: 'reps', sets: 2, reps: 12, weight: 8, note: 'controlled' }, sets: [{ w: 8, r: 12, done: true }, { w: 8, r: 12, done: true }] })

function install(entries, routineIds = []) {
  const state = clone(DEF)
  state.routines = routineIds.map(id => ({ id, name: 'Existing plan', ex: [{ id: '0025', sets: 1, reps: 8, weight: 40 }] }))
  state.active = {
    id: 'simple-finish', d: '2026-10-31', start: Date.now() - 20 * 60000,
    routineIds, name: 'My first workout', bw: null, cur: 0, entries
  }
  useStore.setState({ S: state, user: null })
}

async function finishAndRender({ photo = false } = {}) {
  act(() => finishWorkoutNow())
  if (photo) act(() => useStore.getState().update(s => {
    s.workouts.at(-1).media = [{ kind: 'image', hash: 'a'.repeat(64), mime: 'image/jpeg', size: 1000, width: 200, height: 200, at: Date.now() }]
  }))
  const sheet = useUI.getState().sheets.at(-1)
  root = createRoot(host)
  await act(async () => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  useUI.setState({ sheets: [], timer: null, work: null })
  navigate.mockReset()
  setNav(navigate)
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  host.remove()
  useUI.getState().stopRest()
  useUI.getState().stopWork()
  setNav(() => {})
})

describe('simple workout finish summary', () => {
  it('puts the exit action before collapsed details while keeping training and photos available', async () => {
    install([bench()])
    await finishAndRender({ photo: true })
    const details = host.querySelector('details.finish-workout-details')
    const back = button('Back to Today')
    expect(back).toBeTruthy()
    expect(details.open).toBe(false)
    expect(details.contains(back)).toBe(false)
    expect(back.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(details.querySelector('summary').textContent).toBe('Workout details & photos')
    expect(details.textContent).toContain('What you just trained')
    expect(details.querySelector('svg')).toBeTruthy()
    expect(details.textContent).toContain('Last time and next time')
    expect(details.textContent).toContain('Photos & videos')
    act(() => back.click())
    expect(navigate.mock.calls.at(-1)[0]).toBe('/home')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('shows exercise count for a bodyweight session instead of a misleading zero-volume tile', async () => {
    const squat = Object.values(EXIDX).find(ex => ex.n === 'air squat')
    expect(squat).toBeTruthy()
    install([{ id: squat.id, target: { mode: 'reps', sets: 2, reps: 10, weight: 0 }, sets: [{ w: 0, r: 10, done: true }, { w: 0, r: 10, done: true }] }])
    await finishAndRender()
    expect(tile('Exercises').querySelector('.v').textContent).toBe('1')
    expect(tile('Volume')).toBeUndefined()
    expect(tile('Sets').querySelector('.v').textContent).toBe('2 sets · 2 work')
  })

  it('retains real lifted volume for a loaded session', async () => {
    install([bench()])
    await finishAndRender()
    expect(tile('Volume').querySelector('.v').textContent).toContain('320')
    expect(tile('Exercises')).toBeUndefined()
  })

  it('saves a reusable routine without changing history, then edits that same routine instead of making another', async () => {
    install([bench(), raise()])
    await finishAndRender()
    const historyBefore = clone(current().workouts)
    act(() => button('Save this workout as a routine').click())
    expect(current().routines).toHaveLength(1)
    const routine = current().routines[0]
    expect(routine.name).toBe('My first workout')
    expect(routine.ex.map(e => e.id)).toEqual(['0025', '0334'])
    expect(routine.ex[0]).toMatchObject({ sets: 1, reps: 8, weight: 40 })
    expect(routine.ex[1]).toMatchObject({ sets: 2, reps: 12, weight: 8, note: 'controlled' })
    expect(current().workouts).toEqual(historyBefore)
    expect(current().active).toBeNull()
    expect(button('Save this workout as a routine')).toBeUndefined()
    expect(button('Edit saved routine')).toBeTruthy()
    act(() => button('Edit saved routine').click())
    expect(current().routines).toHaveLength(1)
    expect(current().workouts).toEqual(historyBefore)
    expect(navigate.mock.calls.at(-1)[0]).toBe('/plan/r/' + routine.id)
  })

  it('does not offer to duplicate a workout that already came from a routine', async () => {
    install([{ ...bench(), rid: 'existing' }], ['existing'])
    await finishAndRender()
    expect(button('Save this workout as a routine')).toBeUndefined()
    expect(current().routines).toHaveLength(1)
  })
})
