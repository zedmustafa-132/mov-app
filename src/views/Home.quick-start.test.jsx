// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(), workoutDetailSheet: vi.fn(),
}))
vi.mock('../components/PlayerProgress.jsx', () => ({ PlayerBadge: () => null }))
vi.mock('../components/FirstWorkoutSheet.jsx', () => ({ firstWorkoutSheet: vi.fn() }))
import Home from './Home.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { startFlow, workoutDetailSheet } from '../sheets.jsx'
import { todayISO } from '../lib/format.js'
import { firstWorkoutSheet } from '../components/FirstWorkoutSheet.jsx'
let host, root
const click = label => act(() => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === label).click())
const mount = changes => {
  const S = { ...structuredClone(DEF), routines: [], week: {}, dayPlan: {}, active: null, ...changes }
  useStore.setState({ S, user: null })
  act(() => root.render(<Home />))
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

it('offers a ready-to-follow first workout instead of opening an empty session', () => {
  mount({})
  click('Start workout')
  expect(firstWorkoutSheet).toHaveBeenCalledOnce()
  expect(startFlow).not.toHaveBeenCalled()
  expect(navigate).not.toHaveBeenCalled()
})
it('starts today’s populated routine directly', () => {
  const routine = { id: 'today', name: 'Full body', ex: [{ id: '0025' }] }
  mount({ routines: [routine], week: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, ['today']])) })
  click('Start workout')
  expect(startFlow).toHaveBeenCalledWith(['today'])
})
it('shows and starts the routine assigned to this specific day, ahead of the regular weekly plan', () => {
  mount({
    routines: [{ id: 'push', name: 'Push Day', ex: [{ id: '0025' }] }, { id: 'pull', name: 'Pull Day', ex: [{ id: '0027' }] }],
    week: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, ['push']])),
    dayPlan: { [todayISO()]: 'pull' },
  })
  expect(host.querySelector('h1').textContent).toBe('Pull Day.')
  click('Start workout')
  expect(startFlow).toHaveBeenCalledWith(['pull'])
})
it('lets a returning user choose a saved routine when none is scheduled today', () => {
  mount({ routines: [{ id: 'saved', name: 'Full body', ex: [{ id: '0025' }] }] })
  click('Choose workout')
  expect(navigate).toHaveBeenCalledWith('/workout')
  expect(startFlow).not.toHaveBeenCalled()
})
it('resumes an unfinished session without starting another', () => {
  mount({ active: { id: 'current', name: 'My workout', entries: [] } })
  click('Resume workout')
  expect(startFlow).not.toHaveBeenCalled()
  expect(navigate).toHaveBeenCalledWith('/workout')
})
it('offers a first workout when all saved routines are empty', () => {
  mount({ routines: [{ id: 'empty', name: 'To build', ex: [] }], week: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, ['empty']])) })
  click('Start workout')
  expect(firstWorkoutSheet).toHaveBeenCalledOnce()
})

it('keeps the direct freestyle start for someone who already logs workouts', () => {
  mount({ workouts: [{ id: 'past', d: '2020-01-01', entries: [] }] })
  click('Start workout')
  expect(startFlow).toHaveBeenCalledWith([])
  expect(firstWorkoutSheet).not.toHaveBeenCalled()
})

it('shows an actual completed session and opens it without starting another workout', () => {
  const saved = { id: 'done', d: todayISO(), name: 'Push Day', entries: [{ id: '0025', sets: [{ done: true }] }] }
  mount({ workouts: [saved] })
  expect(host.textContent).toContain('You showed up.')
  expect(host.textContent).toContain('Logged today')
  click('View workout')
  expect(workoutDetailSheet).toHaveBeenCalledWith(saved)
  expect(startFlow).not.toHaveBeenCalled()
})

it('keeps an unfinished part of a multi-routine day available to start', () => {
  const routines = [{ id: 'push', name: 'Push Day', ex: [{ id: '0025' }] }, { id: 'pull', name: 'Pull Day', ex: [{ id: '0027' }] }]
  mount({ routines, week: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, ['push', 'pull']])), workouts: [{ id: 'done', d: todayISO(), name: 'Push Day', routineId: 'push', entries: [] }] })
  expect(host.textContent).not.toContain('You showed up.')
  click('Start workout')
  expect(startFlow).toHaveBeenCalledWith(['push', 'pull'])
})

it('gives a rest day recovery artwork and a useful next-session shortcut', () => {
  const nextDate = new Date(todayISO() + 'T12:00:00')
  nextDate.setDate(nextDate.getDate() + 1)
  const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
  mount({ routines: [{ id: 'pull', name: 'Pull Day', ex: [{ id: '0027' }] }], dayPlan: { [todayISO()]: 'rest', [next]: 'pull' } })
  expect(host.querySelector('h1').textContent).toBe('Rest day.')
  expect(host.querySelector('.daily-workout').style.getPropertyValue('--workout-cover')).toContain('mobility.webp')
  expect(host.querySelector('.home-next-session').textContent).toContain('Pull Day')
  act(() => host.querySelector('.home-next-session').click())
  expect(navigate).toHaveBeenCalledWith('/plan')
})
