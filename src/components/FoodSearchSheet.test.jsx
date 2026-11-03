// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ api: vi.fn(), logFood: vi.fn(), toast: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: mocks.api }))
vi.mock('../store/useNutrition.js', () => ({ useNutrition: select => select({ logFood: mocks.logFood, favouriteFoods: [], recentFoods: [], customFoods: [], toggleFavorite: vi.fn() }) }))
vi.mock('../store/useUI.js', () => ({ useUI: select => select({ openSheet: vi.fn(), toast: mocks.toast }) }))
vi.mock('./CustomFoodSheet.jsx', () => ({ CustomFoodSheet: () => null }))
vi.mock('./BarcodeScannerModal.jsx', () => ({ BarcodeScannerModal: () => null }))
vi.mock('./PhotoEstimateSheet.jsx', () => ({ PhotoEstimateSheet: () => null }))
vi.mock('./MealQuickEntry.jsx', () => ({ MealQuickEntry: () => null }))

import { FoodSearchSheet } from './FoodSearchSheet.jsx'
const egg = { key: 'pantry:egg', name: 'Whole egg', per100g: { kcal: 143, proteinG: 12.6, carbsG: .7, fatG: 9.5 }, portions: [{ label: 'large', grams: 50 }] }
let root, host, close
const search = async text => {
  const input = host.querySelector('input[placeholder]')
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.clearAllMocks()
  close = vi.fn()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<FoodSearchSheet meal="breakfast" date="2026-10-31" close={close} />))
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Find food').click())
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

it('reads the server foods response and displays the actual per-100g nutrients', async () => {
  mocks.api.mockResolvedValue({ foods: [egg] })
  await search('quinoa')
  expect(mocks.api).toHaveBeenCalledWith('/api/food/search?q=quinoa')
  expect(host.querySelector('.food-result-row').textContent).toContain('143 kcal / 100 g')
  expect(host.querySelector('.food-result-row').textContent).toContain('12.6g')
})

it('keeps a typed food count through selection and logging', async () => {
  mocks.api.mockResolvedValue({ foods: [egg] })
  await search('2 eggs')
  expect(mocks.api).not.toHaveBeenCalled()
  act(() => host.querySelector('.food-result-row').click())
  expect(host.textContent).toContain('143')
  const log = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Log to breakfast'))
  act(() => log.click())
  expect(mocks.logFood).toHaveBeenCalledWith('2026-10-31', 'breakfast', expect.objectContaining({ key: 'pantry:egg' }), 2, 'large')
  expect(close).toHaveBeenCalledOnce()
})

it('reports an unavailable search instead of presenting a network failure as no matching food', async () => {
  mocks.api.mockRejectedValue(new Error('unavailable'))
  await search('quinoa')
  expect(host.textContent).toContain('Food search is unavailable')
  expect(host.textContent).not.toContain('No matching foods found')
})

it('ignores an older response when the user has entered a newer query', async () => {
  let resolveOld
  mocks.api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ foods: [{ ...egg, key: 'oats', name: 'Oats' }] })
  await search('quinoa')
  await search('buckwheat')
  await act(async () => { resolveOld({ foods: [egg] }) })
  expect(host.querySelector('.food-result-row').textContent).toContain('Oats')
  expect(host.querySelector('.food-result-row').textContent).not.toContain('Whole egg')
})
