// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../components/PlayerProgress.jsx', () => ({ PlayerBadge: () => null }))
vi.mock('../components/Media.jsx', () => ({ default: () => null, Thumb: () => <span /> }))
vi.mock('../lib/sound.js', async load => ({ ...await load(), beep: vi.fn(), vibrate: vi.fn(), unlock: vi.fn() }))

import Home from './Home.jsx'
import Workout from './Workout.jsx'
import { FirstWorkoutSheet } from '../components/FirstWorkoutSheet.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { setNav } from '../lib/nav.js'
import { buildEasyStartRoutine, EASY_START_KEY } from '../lib/first-workout.js'

let host, root
const current = () => useStore.getState().S
const render = component => act(() => root.render(component))
const click = label => act(() => {
  const button = [...host.querySelectorAll('button')].find(el => el.textContent.trim() === label)
  expect(button, `Expected button: ${label}`).toBeTruthy()
  button.click()
})

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  navigate.mockClear()
  setNav(navigate)
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn()
  useUI.setState({ sheets: [], timer: null, work: null })
  useStore.setState({ S: { ...structuredClone(DEF), weighIn: true, sound: false }, user: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})

afterEach(() => {
  act(() => { root.unmount(); useUI.getState().stopRest(); useUI.getState().stopWork() })
  host.remove()
  setNav(() => {})
})

it('logs the first bodyweight set in three taps from Home, without a weigh-in or exercise search', () => {
  render(<Home />)
  click('Start workout') // 1
  const sheet = useUI.getState().sheets.at(-1)
  expect(current().active).toBeNull()
  render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
  click('Start this workout') // 2
  expect(navigate).toHaveBeenCalledWith('/workout')
  expect(current().active).toMatchObject({ guided: true, workoutView: 'focus', bw: null })
  expect(current().active.entries).toHaveLength(3)
  expect(current().active.entries[0].sets[0]).toMatchObject({ w: 0, r: 8, done: false })
  expect(current().weighIn).toBe(true)
  render(<Workout />)
  expect(host.textContent).toContain('One repetition = one complete movement.')
  expect(host.textContent).toContain('How to do it')
  click('Log set') // 3: the person confirms the displayed repetitions they performed.
  expect(current().active.entries[0].sets[0].done).toBe(true)
  expect(current().active.entries[0].sets[1].done).toBe(false)
  expect(current().workouts).toHaveLength(0) // A session is not saved as completed yet.
})

it('does not create a routine or change a schedule when the preview is dismissed', () => {
  const close = vi.fn()
  render(<FirstWorkoutSheet close={close} />)
  act(() => host.querySelector('[aria-label="Close"]').click())
  expect(close).toHaveBeenCalledOnce()
  expect(current().routines).toHaveLength(0)
  expect(current().active).toBeNull()
})

it('logs a selected exercise in three taps without an empty session or a Done step', () => {
  const plan = { id: 'my-plan', name: 'My existing plan', ex: [{ id: '0025', sets: 3, reps: 8 }] }
  useStore.setState({ S: { ...current(), routines: [plan], week: { 1: ['my-plan'] } } })
  render(<Home />)
  click('Log an exercise') // 1
  const sheet = useUI.getState().sheets.at(-1)
  expect(current().active).toBeNull()
  render(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
  expect([...host.querySelectorAll('button')].some(el => el.textContent.trim() === 'Done')).toBe(false)
  const pick = host.querySelector('.picker-add-button')
  expect(pick.getAttribute('aria-label')).toContain('Air Squat')
  act(() => pick.click()) // 2
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(current().active.entries).toHaveLength(1)
  render(<Workout />)
  click('Log set') // 3
  expect(current().active.entries[0].sets[0].done).toBe(true)
  expect(current().routines).toEqual([plan])
  expect(current().week).toEqual({ 1: ['my-plan'] })
})

it('does not let an empty repetition count become a logged beginner set', () => {
  render(<FirstWorkoutSheet close={() => {}} />)
  click('Start this workout')
  act(() => useStore.getState().update(state => { state.active.entries[0].sets[0].r = 0 }))
  render(<Workout />)
  expect(host.textContent).toContain('Enter the repetitions you completed.')
  const log = [...host.querySelectorAll('button')].find(el => el.textContent.trim() === 'Log set')
  expect(log.disabled).toBe(true)
  act(() => log.click())
  expect(current().active.entries[0].sets[0].done).toBe(false)
})

it('reuses the easy-start routine without duplicating or replacing another plan', () => {
  const easy = buildEasyStartRoutine('My edited easy workout')
  easy.ex[0].reps = 6
  const existing = { id: 'existing', name: 'My plan', ex: [{ id: '0025', sets: 3, reps: 10, weight: 20 }] }
  useStore.setState({ S: { ...current(), routines: [existing, easy], week: { 1: ['existing'] } } })
  render(<FirstWorkoutSheet close={() => {}} />)
  click('Start this workout')
  expect(current().routines).toHaveLength(2)
  expect(current().routines[0]).toEqual(existing)
  expect(current().week).toEqual({ 1: ['existing'] })
  expect(current().active.entries[0].sets[0].r).toBe(6)
  expect(current().routines[1].quickStart).toBe(EASY_START_KEY)
})

it('resumes an existing workout instead of replacing it from a stale preview', () => {
  const active = { id: 'running', name: 'Existing session', entries: [] }
  useStore.setState({ S: { ...current(), active } })
  render(<FirstWorkoutSheet close={() => {}} />)
  click('Start this workout')
  expect(current().active).toEqual(active)
  expect(current().routines).toHaveLength(0)
  expect(navigate).toHaveBeenCalledWith('/workout')
})

it('keeps an emptied saved routine and starts a usable introduction instead', () => {
  const empty = { ...buildEasyStartRoutine('My cleared routine'), ex: [] }
  useStore.setState({ S: { ...current(), routines: [empty] } })
  render(<FirstWorkoutSheet close={() => {}} />)
  click('Start this workout')
  expect(current().routines[0]).toEqual(empty)
  expect(current().active.entries).toHaveLength(3)
})
