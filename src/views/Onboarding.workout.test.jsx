// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ store: null, toast: vi.fn() }))
vi.mock('../store/useStore.js', () => ({ useStore: () => state.store }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: state.toast }) } }))

import Onboarding from './Onboarding.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('Onboarding workout choice', () => {
  let host, root
  const click = async name => {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === name)
    expect(button, name).toBeTruthy()
    await act(async () => button.click())
  }
  const renderSetup = async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/setup']}><Routes><Route path="/setup" element={<Onboarding />} /><Route path="/home" element={<div>Home reached</div>} /><Route path="/workout" element={<div>Logging reached</div>} /><Route path="/settings" element={<div>Settings reached</div>} /></Routes></MemoryRouter>))
  }
  const type = async (input, value) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  const renderReview = async () => {
    await renderSetup()
    await click('Continue')
    await click('Continue')
    await click('Review my plan')
  }

  beforeEach(() => {
    window.scrollTo = vi.fn()
    state.toast.mockReset()
    state.store = {
      S: { routines: [], week: {}, dayPlan: {}, unit: 'kg' },
      update: change => change(state.store.S),
      pushState: vi.fn().mockResolvedValue(undefined)
    }
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => { act(() => root.unmount()); host.remove() })

  it('turns the reviewed suggestion into usable workouts by default for a new user', async () => {
    await renderReview()
    expect(host.querySelector('[aria-label="Add suggested workouts"]').getAttribute('aria-checked')).toBe('true')
    await click('Let’s get moving')
    expect(state.store.S.routines).toHaveLength(4)
    expect(state.store.S.routines.every(r => r.ex.length > 0)).toBe(true)
    expect(state.store.S.targets.dailyCalories).toBeGreaterThan(0)
    expect(state.store.pushState).toHaveBeenCalledOnce()
    expect(state.toast).toHaveBeenCalledWith('Your workouts and daily targets are ready.')
    expect(host.textContent).toBe('Home reached')
  })

  it('lets a new user keep the training plan blank while saving their targets', async () => {
    await renderReview()
    await act(async () => host.querySelector('[aria-label="Add suggested workouts"]').click())
    await click('Let’s get moving')
    expect(state.store.S.routines).toEqual([])
    expect(state.store.S.week).toEqual({})
    expect(state.store.S.targets.waterMl).toBeGreaterThan(0)
    expect(state.toast).toHaveBeenCalledWith('Your daily targets are ready.')
  })

  it('keeps a returning user’s routines and schedule intact', async () => {
    state.store.S.routines = [{ id: 'mine', name: 'My session', ex: [{ id: '0043', sets: 2, reps: 5 }] }]
    state.store.S.week = { 6: ['mine'] }
    const before = structuredClone({ routines: state.store.S.routines, week: state.store.S.week })
    await renderReview()
    expect(host.querySelector('[aria-label="Add suggested workouts"]')).toBeNull()
    expect(host.textContent).toContain('Your existing routines and schedule will stay as they are.')
    await click('Let’s get moving')
    expect(state.store.S.routines).toEqual(before.routines)
    expect(state.store.S.week).toEqual(before.week)
  })

  it('lets a new user start logging without saving the sample body metrics or calculated targets', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/setup']}><Routes><Route path="/setup" element={<Onboarding />} /><Route path="/home" element={<div>Home reached</div>} /></Routes></MemoryRouter>))
    await click('Skip setup and start logging')
    expect(host.textContent).toBe('Home reached')
    expect(state.store.S.onboardedAt).toEqual(expect.any(String))
    expect(state.store.S.setupDeferred).toBe(true)
    expect(state.store.S.profile).toBeUndefined()
    expect(state.store.S.targets).toBeUndefined()
    expect(state.store.S.routines).toEqual([])
    expect(state.store.pushState).toHaveBeenCalledOnce()
  })

  it('prefills an existing profile and can leave personalization without changing saved data', async () => {
    state.store.S.profile = { onboardedAt: 'saved', sex: 'female', age: 42, heightCm: 182 }
    state.store.S.goal = { type: 'maintenance', targetWeightKg: 84, pace: 'relaxed', activityLevel: 'light' }
    state.store.S.targetHistory = [{ inputs: { weightKg: 86, equipment: 'dumbbells', trainingDays: 3 } }]
    const before = structuredClone(state.store.S)
    await act(async () => root.render(<MemoryRouter initialEntries={['/setup']}><Routes><Route path="/setup" element={<Onboarding />} /><Route path="/settings" element={<div>Settings reached</div>} /></Routes></MemoryRouter>))
    expect(host.querySelector('[aria-label="Age"]').value).toBe('42')
    expect(host.querySelector('[aria-label="Height in centimetres"]').value).toBe('182')
    expect(host.querySelector('[aria-label="Current weight in kg"]').value).toBe('86')
    expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Female').getAttribute('aria-pressed')).toBe('true')
    await click('Back to Settings')
    expect(host.textContent).toBe('Settings reached')
    expect(state.store.S).toEqual(before)
    expect(state.store.pushState).not.toHaveBeenCalled()
  })

  it('can finish personalization after skipping it earlier', async () => {
    state.store.S.onboardedAt = 'skipped'
    state.store.S.setupDeferred = true
    await renderReview()
    await click('Let’s get moving')
    expect(state.store.S.setupDeferred).toBeUndefined()
    expect(state.store.S.routines.length).toBeGreaterThan(0)
    expect(state.store.S.targets.dailyCalories).toBeGreaterThan(0)
  })

  it.each([
    ['Age', '30', '32'],
    ['Height in centimetres', '175', '178'],
    ['Current weight in kg', '80', '82.5']
  ])('lets %s be backspaced completely, left blank and retyped', async (label, original, replacement) => {
    await renderSetup()
    const input = host.querySelector(`[aria-label="${label}"]`)
    expect(input.value).toBe(original)
    for (let length = original.length - 1; length >= 0; length--) {
      await type(input, original.slice(0, length))
      expect(input.value).toBe(original.slice(0, length))
    }
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(input.value).toBe('')
    await click('Continue')
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('1')
    expect(input.value).toBe('')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(state.store.pushState).not.toHaveBeenCalled()
    for (let length = 1; length <= replacement.length; length++) {
      await type(input, replacement.slice(0, length))
      expect(input.value).toBe(replacement.slice(0, length))
    }
    await click('Continue')
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('2')
  })

  it('checks ranges on Continue without rewriting a partly typed height', async () => {
    await renderSetup()
    const height = host.querySelector('[aria-label="Height in centimetres"]')
    await type(height, '17')
    expect(host.querySelector('[role="alert"]')).toBeNull()
    await click('Continue')
    expect(height.value).toBe('17')
    expect(host.querySelector('[role="alert"]').textContent).toContain('120 and 230 cm')
    await type(height, '178')
    expect(host.querySelector('[role="alert"]')).toBeNull()
    await click('Continue')
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('2')
  })

  it.each([
    ['kg', '82,5', '77.3', 1],
    ['lb', '182.5', '172.3', 2.20462]
  ])('keeps decimal %s weights editable and saves the displayed amounts in kilograms', async (unit, current, target, factor) => {
    state.store.S.unit = unit
    await renderSetup()
    const weight = host.querySelector(`[aria-label="Current weight in ${unit}"]`)
    await type(weight, '')
    expect(weight.value).toBe('')
    for (let length = 1; length <= current.length; length++) {
      await type(weight, current.slice(0, length))
      expect(weight.value).toBe(current.slice(0, length).replace(',', '.'))
    }
    await click('Continue')
    const targetInput = host.querySelector(`[aria-label="Target weight in ${unit}"]`)
    await type(targetInput, '')
    await click('Continue')
    expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('2')
    expect(targetInput.value).toBe('')
    expect(host.querySelector('[role="alert"]').textContent).toContain('target weight')
    for (let length = 1; length <= target.length; length++) {
      await type(targetInput, target.slice(0, length))
      expect(targetInput.value).toBe(target.slice(0, length))
    }
    await click('Back')
    expect(host.querySelector(`[aria-label="Current weight in ${unit}"]`).value).toBe(current.replace(',', '.'))
    await click('Continue')
    expect(host.querySelector(`[aria-label="Target weight in ${unit}"]`).value).toBe(target)
    await click('Continue')
    await click('Review my plan')
    await click('Let’s get moving')
    expect(state.store.S.targetHistory.at(-1).inputs.weightKg).toBeCloseTo(Number(current.replace(',', '.')) / factor, 6)
    expect(state.store.S.goal.targetWeightKg).toBeCloseTo(Number(target) / factor, 6)
  })

  it('does not require an unused target weight when maintaining weight', async () => {
    await renderSetup()
    await click('Continue')
    await type(host.querySelector('[aria-label="Target weight in kg"]'), '')
    await click('Maintain')
    await click('Continue')
    await click('Review my plan')
    await click('Let’s get moving')
    expect(state.store.S.goal.targetWeightKg).toBe(80)
    expect(state.store.S.targetHistory.at(-1).inputs.targetWeightKg).toBe(80)
  })
})
