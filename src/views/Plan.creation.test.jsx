// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  dayAssignSheet: vi.fn(), starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), menuSheet: vi.fn(),
  planHasRoutines: () => false, exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))

import Plan from './Plan.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { starterPlanSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const mount = () => act(() => root.render(<Plan />))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem('gym_plan_view')
  const S = JSON.parse(JSON.stringify(DEF))
  S.routines = []; S.week = {}; S.queue = null; S.rotation = null
  useStore.setState({ S, user: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.removeItem('gym_plan_view') })

describe('Plan creation entry points', () => {
  it('opens an empty plan on routines and offers both creation paths without opening a menu', () => {
    mount()
    expect(host.querySelector('.plan-views button.on').textContent).toBe('Routines')
    expect(button('New routine')).toBeTruthy()
    expect(button('Starter plans')).toBeTruthy()
    expect(button('New routine').closest('.plan-builder-actions')).toBeTruthy()
  })

  it('creates an editable routine and opens its editor immediately', () => {
    mount()
    act(() => button('New routine').click())
    const [routine] = useStore.getState().S.routines
    expect(routine).toMatchObject({ name: 'New routine', ex: [] })
    expect(routine.id).toBeTruthy()
    expect(nav).toHaveBeenCalledWith('/plan/r/' + routine.id)
    expect(localStorage.getItem('gym_plan_view')).toBe('routines')
  })

  it('opens the existing starter-plan chooser directly', () => {
    mount()
    act(() => button('Starter plans').click())
    expect(starterPlanSheet).toHaveBeenCalledOnce()
    expect(useStore.getState().S.routines).toEqual([])
  })
})
