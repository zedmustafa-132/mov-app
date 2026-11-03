// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Onboarding from './Onboarding.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { convertBodyWeight } from '../lib/units.js'
import { ExerciseWeightUnitSheet } from '../components/UnitChoice.jsx'

let host, root
const current = () => useStore.getState().S
const render = async component => act(async () => root.render(<MemoryRouter>{component}</MemoryRouter>))
const click = async label => act(async () => {
  const target = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === label || button.querySelector('b')?.textContent === label)
  expect(target, label).toBeTruthy(); target.click()
})
const input = label => host.querySelector(`[aria-label="${label}"]`)
const type = async (label, value) => act(async () => {
  const field = input(label)
  expect(field, label).toBeTruthy()
  Object.getOwnPropertyDescriptor(field.constructor.prototype, 'value').set.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
})

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  window.scrollTo = vi.fn()
  useStore.setState({ S: structuredClone(DEF), user: null, ready: false })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

it('accepts a blank or partial metric height without snapping to either range limit', async () => {
  await render(<Onboarding />)
  await type('Height in centimetres', '')
  await act(async () => input('Height in centimetres').dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  expect(input('Height in centimetres').value).toBe('')
  for (const value of ['1', '17', '178']) {
    await type('Height in centimetres', value)
    expect(input('Height in centimetres').value).toBe(value)
  }
  await type('Height in centimetres', '17')
  await click('Continue')
  expect(input('Height in centimetres').value).toBe('17')
  expect(host.querySelector('[role="alert"]').textContent).toContain('120 and 230')
})

it('converts displayed weight drafts and preserves the exact metric height when switching systems', async () => {
  await render(<Onboarding />)
  await type('Height in centimetres', '178')
  await type('Current weight in kg', '82.5')
  await click('Imperial')
  expect(current().unit).toBe('lb')
  expect(input('Current weight in lb').value).toBe(String(convertBodyWeight(82.5, 'kg', 'lb')))
  expect(input('Height in feet').value).toBe('5')
  expect(input('Height in inches').value).toBe('10.1')
  await click('Metric')
  expect(input('Height in centimetres').value).toBe('178')
  expect(input('Current weight in kg').value).toBe('82.5')
})

it('keeps emptied height and weight drafts empty across a system switch', async () => {
  await render(<Onboarding />)
  await type('Height in centimetres', '')
  await type('Current weight in kg', '')
  await click('Imperial')
  expect(input('Height in feet').value).toBe('')
  expect(input('Height in inches').value).toBe('')
  expect(input('Current weight in lb').value).toBe('')
  await click('Metric')
  expect(input('Height in centimetres').value).toBe('')
  expect(input('Current weight in kg').value).toBe('')
})

it('saves feet and inches as canonical centimetres and pounds as canonical kilograms', async () => {
  await render(<Onboarding />)
  await click('Imperial')
  await type('Height in feet', '')
  await type('Height in inches', '')
  await click('Continue')
  expect(input('Height in feet').value).toBe('')
  expect(input('Height in inches').value).toBe('')
  await type('Height in feet', '5')
  await type('Height in inches', '10.5')
  await type('Current weight in lb', '190')
  await click('Continue')
  await type('Target weight in lb', '180')
  await click('Continue')
  await click('Review my plan')
  await click('Let’s get moving')
  expect(current().unit).toBe('lb')
  expect(current().profile.heightCm).toBeCloseTo(179.07, 4)
  expect(current().targetHistory.at(-1).inputs.weightKg).toBeCloseTo(190 / 2.20462, 6)
  expect(current().goal.targetWeightKg).toBeCloseTo(180 / 2.20462, 6)
})

it('converts the form when a registration preference arrives after mounting', async () => {
  await render(<Onboarding />)
  await act(async () => { useStore.getState().setUnit('lb') })
  expect(input('Current weight in lb').value).toBe('176.4')
  expect(input('Height in feet').value).toBe('5')
})

it('switches exercise weight units by conversion, including active and saved workouts', async () => {
  useStore.setState({ S: { ...current(), profile: { heightCm: 175 }, goal: { targetWeightKg: 80 },
    active: { id: 'a', entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true }] }] },
    workouts: [{ id: 'past', entries: [{ id: '0025', sets: [{ w: 100, r: 5, done: true }] }] }]
  } })
  const close = vi.fn()
  await render(<ExerciseWeightUnitSheet close={close} />)
  await click('Pounds (lb)')
  expect(close).toHaveBeenCalledOnce()
  expect(current().unit).toBe('lb')
  expect(current().active.entries[0].sets[0]).toMatchObject({ w: 132.5, r: 8, done: true })
  expect(current().workouts[0].entries[0].sets[0].w).toBe(220.5)
  expect(current().profile.heightCm).toBe(175)
  expect(current().goal.targetWeightKg).toBe(80)
})
