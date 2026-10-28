// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  S: {
    unit: 'kg',
    targets: { dailyCalories: 2200, macros: { proteinG: 160, carbsG: 220, fatG: 70 } },
    workouts: [],
    bodyweight: [],
    routines: [],
    customEx: []
  },
  days: {
    '2026-10-26': {
      entries: [{ nutrients: { calories: 2100, protein: 155, carbs: 210, fat: 68 } }]
    },
    '2026-10-27': {
      entries: [{ nutrients: { calories: 2300, protein: 165, carbs: 230, fat: 72 } }]
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

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}))

const { NutritionHistoryCard } = await import('./Stats.jsx')

let root, host

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('NutritionHistoryCard', () => {
  it('renders card title, average calories and macro pillars', () => {
    act(() => root.render(<NutritionHistoryCard S={mocks.S} />))

    const card = host.querySelector('[data-nutrition-history]')
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('Nutrition history')
    // Average of 2100 and 2300 is 2200 kcal
    expect(card.textContent).toContain('2200 kcal')
    expect(card.textContent).toContain('(2 days)')
    // Average protein: 160g, carbs: 220g, fat: 70g
    expect(card.textContent).toContain('160g')
    expect(card.textContent).toContain('220g')
    expect(card.textContent).toContain('70g')
  })

  it('renders empty state when no nutrition is logged in range', () => {
    mocks.days = {}
    act(() => root.render(<NutritionHistoryCard S={mocks.S} />))

    const card = host.querySelector('[data-nutrition-history]')
    expect(card.textContent).toContain('No food entries in this period')
  })
})
