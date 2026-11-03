// @vitest-environment happy-dom
// v1.3.11: "Add exercise" heads the routine's exercise list. Under the last exercise it had to be
// scrolled to on every long routine before anything could be added. Both ways of adding still
// work: "+" on a picker row adds at the routine's defaults, a tap opens the settings first.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ exConfigSheet: vi.fn(), exercisePicker: vi.fn(), glyphPicker: vi.fn(), confirmSheet: vi.fn(), startFlow: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { exercisePicker, exConfigSheet, startFlow } from '../sheets.jsx'
import { EXIDX } from '../lib/exercises.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host

function mount(ex, active = null) {
  const S = JSON.parse(JSON.stringify(DEF))
  S.routines = [{ id: 'r1', name: 'Push day', emoji: 'dumbbell', ex }]
  S.active = active
  useStore.setState({ S, user: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter initialEntries={['/plan/r/r1']}><Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /><Route path="/workout" element={<div>Current workout resumed</div>} /></Routes></MemoryRouter>))
}
const addButton = () => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Add exercise')
const stored = () => useStore.getState().S.routines[0].ex

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('RoutineEdit — Add exercise at the top', () => {
  it('sits above the first exercise, with the list heading', () => {
    mount([{ id: '0025', sets: 3, mode: 'reps', reps: 5, weight: 80 }, { id: '0025', sets: 3, mode: 'reps', reps: 8, weight: 60 }])
    const add = addButton()
    const firstRow = host.querySelector('[data-routine-row]')
    expect(add.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(add.closest('.routine-ex-h').querySelector('h4').textContent).toBe('Exercises')
    // and there is only the one
    expect([...host.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Add exercise').length).toBe(1)
  })

  it('is there on an empty routine too', () => {
    mount([])
    expect(addButton()).toBeTruthy()
    expect(host.textContent).toContain('No exercises yet.')
  })

  it('keeps naming and adding exercises ahead of optional routine settings', () => {
    mount([])
    expect(host.querySelector('input[aria-label="Routine name"]')).toBeTruthy()
    expect(host.textContent).toContain('Changes save automatically.')
    const options = host.querySelector('.routine-options')
    expect(options.open).toBe(false)
    expect(addButton().compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...host.querySelectorAll('button')].some(b => b.textContent.trim() === 'Done')).toBe(true)
  })

  it('starts the routine directly once exercises have been chosen', () => {
    mount([{ id: '0025', sets: 3, mode: 'reps', reps: 8, weight: 60 }])
    const start = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start workout')
    act(() => start.click())
    expect(startFlow).toHaveBeenCalledWith(['r1'])
  })

  it('reveals ordering and superset tools when requested, and preserves edits when collapsed', () => {
    mount([{ id: '0025', sets: 3, reps: 8 }, { id: '0043', sets: 3, reps: 10 }])
    expect(host.querySelector('.routine-arrange-controls').hidden).toBe(true)
    const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
    act(() => button('Arrange').click())
    expect(host.querySelector('.routine-arrange-controls').hidden).toBe(false)
    expect(host.querySelector('[title="Superset with exercise above"]')).toBeTruthy()
    act(() => host.querySelector('[aria-label="Move down"]').click())
    expect(stored().map(e => e.id)).toEqual(['0043', '0025'])
    act(() => button('Done arranging').click())
    expect(host.querySelector('.routine-arrange-controls').hidden).toBe(true)
    expect(stored().map(e => e.id)).toEqual(['0043', '0025'])
  })

  it('resumes an existing session instead of replacing unsaved work with the edited routine', () => {
    const active = { id: 'in-progress', name: 'Today', start: 1000, entries: [{ id: '0025', sets: [{ w: 40, r: 8, done: true }] }] }
    mount([{ id: '0025', sets: 3, mode: 'reps', reps: 8, weight: 60 }], active)
    const resume = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Resume current workout')
    expect(resume).toBeTruthy()
    act(() => resume.click())
    expect(startFlow).not.toHaveBeenCalled()
    expect(useStore.getState().S.active).toEqual(active)
    expect(host.textContent).toContain('Current workout resumed')
  })

  it('adds at the defaults from "+", and through the settings from a tap', () => {
    mount([])
    act(() => addButton().click())
    const onPick = exercisePicker.mock.calls[0][0]
    const ex = EXIDX['0025']
    act(() => onPick(ex, true))
    expect(stored().map(e => e.id)).toEqual(['0025'])
    act(() => onPick(ex, false))
    expect(exConfigSheet).toHaveBeenCalledOnce()
    const save = exConfigSheet.mock.calls[0][2]
    act(() => save({ sets: 4, reps: 6, mode: 'reps', weight: 50 }))
    expect(stored()).toHaveLength(2)
    expect(stored()[1]).toMatchObject({ id: '0025', sets: 4, reps: 6 })
  })
})
