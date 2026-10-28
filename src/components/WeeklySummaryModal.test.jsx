// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  S: {
    unit: 'kg',
    weekStart: 1,
    targets: { dailyCalories: 2000, macros: { proteinG: 150, carbsG: 200, fatG: 65 } },
    workouts: [],
    bodyweight: [{ d: '2026-10-26', w: 80.5 }, { d: '2026-10-28', w: 80.1 }]
  },
  days: {
    '2026-10-26': {
      entries: [{ nutrients: { calories: 2050, protein: 155, carbs: 190, fat: 65 } }],
      waterMl: 2800
    }
  }
}))

vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S })
  const useStore = selector => (selector ? selector(snap()) : snap())
  useStore.getState = snap
  return { useStore }
})

vi.mock('../store/useNutrition.js', () => {
  const snap = () => ({ days: mocks.days })
  const useNutrition = selector => (selector ? selector(snap()) : snap())
  useNutrition.getState = snap
  return { useNutrition }
})

vi.mock('../lib/gamification/useGamification.js', () => ({
  useGamification: () => ({
    levelInfo: { level: 5, form: { name: 'Adept' }, title: 'Challenger' },
    streakDays: 4
  })
}))

const { WeeklySummaryModal } = await import('./WeeklySummaryModal.jsx')

let root, host, close

beforeEach(() => {
  close = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<WeeklySummaryModal close={close} />))
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('WeeklySummaryModal', () => {
  it('renders title, overview KPIs, and close action', () => {
    expect(host.querySelector('h2').textContent).toBe('Weekly Summary')
    expect(host.textContent).toContain('Nutrition')
    expect(host.textContent).toContain('Workouts')
    expect(host.textContent).toContain('Weight Delta')
    expect(host.textContent).toContain('Hydration')

    const closeBtn = host.querySelector('button[aria-label="Close"]')
    expect(closeBtn).toBeTruthy()
    act(() => closeBtn.click())
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('displays coach observations and weight disclaimer', () => {
    expect(host.textContent).toContain('Coach Observations')
    expect(host.textContent).toContain('Understanding Weight Trends')
    expect(host.textContent).toContain('Short-term scale fluctuations reflect water')
  })
})
