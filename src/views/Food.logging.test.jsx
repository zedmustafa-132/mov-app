// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ openSheet: vi.fn(), toast: vi.fn(), api: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: mocks.api }))
vi.mock('../store/useStore.js', () => ({ useStore: select => select({ S: {} }) }))
vi.mock('../store/useUI.js', () => ({ useUI: select => select({ openSheet: mocks.openSheet, toast: mocks.toast }) }))
vi.mock('../lib/targets.js', () => ({ getActiveTargets: () => ({ dailyCalories: 2000, proteinGrams: 150, carbsGrams: 250, fatGrams: 70, waterMl: 3000 }) }))
vi.mock('../components/BarcodeScannerModal.jsx', () => ({ BarcodeScannerModal: () => null }))
vi.mock('../components/PhotoEstimateSheet.jsx', () => ({ PhotoEstimateSheet: () => null }))
import Food from './Food.jsx'
import { useNutrition } from '../store/useNutrition.js'
import { foodForEntry, scaleNutrients } from '../lib/nutrition/portions.js'
import { getLocalDateString } from '../lib/nutrition/totals.js'

const food = { key: 'ai:toast', source: 'gemini', name: 'Plain toast', dataQuality: 'ai-estimated',
  per100g: { kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2 }, defaultServingGrams: 30, portions: [{ label: 'piece', grams: 30 }] }
let host, root
const today = getLocalDateString()
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear()
  useNutrition.setState({ days: {}, selectedDate: today, recentFoods: [], customFoods: [], favouriteFoods: [] })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers() })

it('shows canonical calories and macros in saved diary rows and preserves the food basis in storage', () => {
  useNutrition.getState().logFood(today, 'lunch', food, 2, 'piece')
  act(() => root.render(<Food />))
  const row = host.querySelector('[aria-label="Edit Plain toast"]')
  expect(row.textContent).toContain('159 kcal')
  expect(row.textContent).toContain('P:5.4')
  expect(host.textContent).toContain('159 eaten')
  const entry = JSON.parse(localStorage.getItem('nxtform_nutrition_v1')).days[today].entries[0]
  expect(entry.foodRef.per100g).toEqual(expect.objectContaining(food.per100g))
  expect(scaleNutrients(foodForEntry(entry), 1, 'piece').nutrients.kcal).toBe(80)
})

it('edits and moves an older saved entry without losing nutrition or double scaling it', () => {
  const legacy = { id: 'old-toast', foodKey: food.key, name: food.name, meal: 'lunch', qty: 2, unit: 'piece', weightGrams: 60,
    nutrients: { kcal: 159, proteinG: 5.4, carbsG: 29.4, fatG: 1.9 } }
  useNutrition.setState({ days: { [today]: { entries: [legacy], waterMl: 0 } } })
  act(() => root.render(<Food />))
  act(() => host.querySelector('[aria-label="Edit Plain toast"]').click())
  const sheet = mocks.openSheet.mock.calls[0][0](vi.fn())
  act(() => root.render(sheet))
  expect(host.textContent).toContain('159')
  const amount = host.querySelector('[aria-label="Amount"]')
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(amount, '1'); amount.dispatchEvent(new Event('input', { bubbles: true })) })
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Dinner').click())
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Save Changes').click())
  const entry = useNutrition.getState().days[today].entries[0]
  expect(entry.nutrients.kcal).toBe(80)
  expect(entry.weightGrams).toBe(30)
  expect(entry.meal).toBe('dinner')
})

it('restores a deleted entry with its original food basis', () => {
  useNutrition.getState().logFood(today, 'lunch', food, 2, 'piece')
  act(() => root.render(<Food />))
  act(() => host.querySelector('[aria-label="Edit Plain toast"]').click())
  act(() => root.render(mocks.openSheet.mock.calls[0][0](vi.fn())))
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Delete').click())
  expect(useNutrition.getState().days[today].entries).toHaveLength(0)
  const undo = mocks.toast.mock.calls.find(([message]) => message === 'Food deleted')[1].onAction
  act(() => undo())
  expect(useNutrition.getState().days[today].entries[0].nutrients.kcal).toBe(159)
})

it('supports the legacy custom-food nutrient format when calculating portions', () => {
  const custom = { key: 'custom:protein', name: 'Custom protein', nutrients: { calories: 400, protein: 80, carbs: 7, fat: 3 }, portions: [{ label: 'scoop', grams: 30 }] }
  const entry = useNutrition.getState().logFood(today, 'snacks', custom, 1, 'scoop')
  expect(entry.nutrients.kcal).toBe(120)
  expect(entry.nutrients.proteinG).toBe(24)
})
