// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ api: vi.fn(), logFood: vi.fn(), toast: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: mocks.api }))
vi.mock('../store/useNutrition.js', () => ({ useNutrition: select => select({ logFood: mocks.logFood }) }))
vi.mock('../store/useUI.js', () => ({ useUI: select => select({ toast: mocks.toast }) }))
import { MealQuickEntry } from './MealQuickEntry.jsx'

const food = { key: 'ai:toast', source: 'gemini', name: 'Plain toast', per100g: { kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2 }, portions: [{ label: 'slice', grams: 30 }], defaultServingGrams: 30 }
const mealResult = () => ({ items: [{ name: 'Plain toast', foodKey: food.key, foodRef: food, qty: 1, unit: 'slice', estimated: true, assumption: 'One 30 g slice, no butter.' }], unresolved: [], notices: [] })
let host, root, close, findFood, mediaDevicesDescriptor
const button = name => [...host.querySelectorAll('button')].find(item => item.textContent === name)
function input(selector, value) {
  const field = host.querySelector(selector)
  const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  act(() => { Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
}
async function render(key = 'default') {
  await act(async () => root.render(<MealQuickEntry key={key} date="2026-10-31" meal="lunch" onMealChange={vi.fn()} close={close} onFindFood={findFood} />))
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetAllMocks(); localStorage.clear(); delete window.SpeechRecognition; delete window.webkitSpeechRecognition
  delete window.MediaRecorder
  mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  mocks.api.mockImplementation(async path => path.endsWith('/config') ? { configured: true } : mealResult())
  close = vi.fn(); findFood = vi.fn()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await render()
})
afterEach(() => {
  act(() => root.unmount()); host.remove(); delete window.SpeechRecognition; delete window.webkitSpeechRecognition; delete window.MediaRecorder
  if (mediaDevicesDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor)
  else delete navigator.mediaDevices
})

it('requires an explicit review and saves the edited portion using the same calculator', async () => {
  input('textarea', 'a slice of toast')
  await act(async () => button('Review meal').click())
  expect(mocks.logFood).not.toHaveBeenCalled()
  expect(host.querySelector('[aria-label="Meal totals"]').textContent).toContain('80kcal')
  input('input[aria-label="Amount for Plain toast"]', '2')
  expect(host.querySelector('[aria-label="Meal totals"]').textContent).toContain('159kcal')
  expect(host.textContent).toContain('5.4g')
  await act(async () => [...host.querySelectorAll('button')].find(item => item.textContent.startsWith('Log meal')).click())
  expect(mocks.logFood).toHaveBeenCalledWith('2026-10-31', 'lunch', food, 2, 'slice')
  expect(close).toHaveBeenCalledOnce()
})

it('does not send unmatched meal text to Gemini until consent is enabled', async () => {
  input('textarea', 'toast')
  await act(async () => button('Review meal').click())
  expect(JSON.parse(mocks.api.mock.calls.find(([path]) => path.endsWith('/parse-text'))[1].body).useAi).toBe(false)
  act(() => button('Edit text').click())
  act(() => host.querySelector('[role="switch"]').click())
  await act(async () => button('Review meal').click())
  const calls = mocks.api.mock.calls.filter(([path]) => path.endsWith('/parse-text'))
  expect(JSON.parse(calls[1][1].body).useAi).toBe(true)
})

it('offers explicit AI recovery for an unmatched meal instead of showing a zero-calorie breakdown', async () => {
  mocks.api.mockImplementation(async (path, options) => {
    if (path.endsWith('/config')) return { configured: true }
    return JSON.parse(options.body).useAi ? mealResult() : { items: [], unresolved: ['a piece of toast'], notices: [], ai: { used: false } }
  })
  input('textarea', 'a piece of toast')
  await act(async () => button('Review meal').click())
  expect(host.querySelector('[aria-label="Meal totals"]')).toBeNull()
  expect(host.querySelector('textarea').value).toBe('a piece of toast')
  expect(host.textContent).toContain('These foods aren’t in the quick list')
  expect(host.textContent).toContain('This sends unmatched text to Google')
  expect(localStorage.getItem('mov_food_ai_consent_v1')).not.toBe('yes')
  await act(async () => button('Use AI & review').click())
  const calls = mocks.api.mock.calls.filter(([path]) => path.endsWith('/parse-text'))
  expect(calls.map(([,options]) => JSON.parse(options.body).useAi)).toEqual([false, true])
  expect(localStorage.getItem('mov_food_ai_consent_v1')).toBe('yes')
  expect(host.querySelector('[aria-label="Meal totals"]').textContent).toContain('80kcal')
  expect(mocks.logFood).not.toHaveBeenCalled()
})

it('marks partial totals and lets AI fill the remaining foods without making the user retype', async () => {
  mocks.api.mockImplementation(async (path, options) => path.endsWith('/config') ? { configured: true }
    : JSON.parse(options.body).useAi ? mealResult() : { ...mealResult(), unresolved: ['unknown sauce'] })
  input('textarea', 'toast and unknown sauce')
  await act(async () => button('Review meal').click())
  expect(host.textContent).toContain('These totals only include matched foods')
  expect([...host.querySelectorAll('button')].find(item => item.textContent.startsWith('Log meal')).disabled).toBe(true)
  await act(async () => button('Use AI & review').click())
  const call = mocks.api.mock.calls.filter(([path]) => path.endsWith('/parse-text')).at(-1)
  expect(JSON.parse(call[1].body)).toEqual({ text: 'toast and unknown sauce', useAi: true })
  expect(host.textContent).not.toContain('These totals only include matched foods')
  expect(mocks.logFood).not.toHaveBeenCalled()
})

it('shows a provider failure without inventing a zero-calorie meal', async () => {
  act(() => host.querySelector('[role="switch"]').click())
  mocks.api.mockResolvedValue({ items: [], unresolved: ['toast'], notices: [{ code: 'quota', message: 'Gemini has reached its current quota.' }] })
  input('textarea', 'toast')
  await act(async () => button('Review meal').click())
  expect(host.querySelector('[role="alert"]').textContent).toContain('Gemini has reached its current quota')
  expect(host.querySelector('[aria-label="Meal totals"]')).toBeNull()
  expect(host.querySelector('textarea').value).toBe('toast')
  expect(button('Use AI & review')).toBeUndefined()
})

it('explains when the phone must sign in again and keeps the description', async () => {
  mocks.api.mockRejectedValue(Object.assign(new Error('not signed in'), { status: 401 }))
  input('textarea', 'toast')
  await act(async () => button('Review meal').click())
  expect(host.querySelector('[role="alert"]').textContent).toContain('Sign in again')
  expect(host.querySelector('textarea').value).toBe('toast')
  expect(host.querySelector('[aria-label="Meal totals"]')).toBeNull()
})

it('waits for AI configuration instead of silently ignoring stored consent on a slow phone connection', async () => {
  let resolveConfig
  localStorage.setItem('mov_food_ai_consent_v1', 'yes')
  mocks.api.mockImplementation(path => path.endsWith('/config') ? new Promise(resolve => { resolveConfig = resolve }) : Promise.resolve(mealResult()))
  await render('slow-config')
  input('textarea', 'toast')
  expect(button('Review meal').disabled).toBe(true)
  await act(async () => resolveConfig({ configured: true }))
  expect(button('Review meal').disabled).toBe(false)
  await act(async () => button('Review meal').click())
  const call = mocks.api.mock.calls.find(([path]) => path.endsWith('/parse-text'))
  expect(JSON.parse(call[1].body).useAi).toBe(true)
})

it('blocks saving unresolved food until it is deliberately excluded', async () => {
  mocks.api.mockResolvedValue({ ...mealResult(), unresolved: ['unknown sauce'] })
  input('textarea', 'toast and unknown sauce')
  await act(async () => button('Review meal').click())
  const save = [...host.querySelectorAll('button')].find(item => item.textContent.startsWith('Log meal'))
  expect(save.disabled).toBe(true)
  act(() => button('Leave these items out').click())
  expect(save.disabled).toBe(false)
})

it('prevents saving a zero portion or a removed meal', async () => {
  input('textarea', 'toast')
  await act(async () => button('Review meal').click())
  input('input[aria-label="Amount for Plain toast"]', '0')
  expect([...host.querySelectorAll('button')].find(item => item.textContent.startsWith('Log meal')).disabled).toBe(true)
  act(() => host.querySelector('[aria-label="Remove Plain toast"]').click())
  expect([...host.querySelectorAll('button')].find(item => item.textContent.startsWith('Log meal')).disabled).toBe(true)
})

it('ignores an old analysis after the description is changed', async () => {
  let resolve
  mocks.api.mockImplementation(path => path.endsWith('/config') ? Promise.resolve({ configured: true }) : new Promise(done => { resolve = done }))
  input('textarea', 'toast')
  await act(async () => button('Review meal').click())
  input('textarea', '2 eggs')
  await act(async () => resolve(mealResult()))
  expect(host.textContent).not.toContain('Your meal, broken down.')
  expect(host.querySelector('textarea').value).toBe('2 eggs')
})

it('shows a typing fallback when browser voice recognition is unavailable', () => {
  act(() => host.querySelector('[aria-label="Dictate meal"]').click())
  expect(host.textContent).toContain('Voice entry is unavailable in this browser')
  expect(host.querySelector('textarea')).toBeTruthy()
})

it('turns speech results into editable text and releases recognition on close', async () => {
  let instance
  window.SpeechRecognition = class { constructor() { instance = this } start = vi.fn(); stop = vi.fn(); abort = vi.fn() }
  await render()
  act(() => host.querySelector('[aria-label="Dictate meal"]').click())
  expect(instance.start).toHaveBeenCalledOnce()
  act(() => instance.onresult({ results: [[{ transcript: 'I had two eggs and toast' }]] }))
  expect(host.querySelector('textarea').value).toBe('I had two eggs and toast')
  const lateResult = instance.onresult
  act(() => root.unmount())
  expect(instance.abort).toHaveBeenCalledOnce()
  expect(instance.onresult).toBeNull()
  act(() => lateResult({ results: [[{ transcript: 'late speech' }]] }))
})

function setupRecording(getUserMedia = vi.fn()) {
  let instance
  window.MediaRecorder = class {
    static isTypeSupported(type) { return type === 'audio/webm;codecs=opus' }
    constructor() { instance = this; this.state = 'inactive' }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic audio'], { type: 'audio/webm' }) }); this.onstop?.() }
  }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  mocks.api.mockImplementation(async path => path.endsWith('/config') ? { configured: true, audio: true } : { ...mealResult(), raw: 'I had a slice of toast.' })
  return { instance: () => instance, getUserMedia }
}

it('requires consent before opening a microphone for Gemini voice', async () => {
  const recording = setupRecording()
  await render('audio')
  await act(async () => host.querySelector('[aria-label="Dictate meal"]').click())
  expect(recording.getUserMedia).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Your short recording will be sent to Google')
})

it('reviews a Gemini recording without logging it and stops the microphone before upload', async () => {
  const stopTrack = vi.fn()
  const recording = setupRecording(vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }))
  await render('audio')
  act(() => host.querySelector('[role="switch"]').click())
  await act(async () => host.querySelector('[aria-label="Dictate meal"]').click())
  expect(recording.instance().state).toBe('recording')
  await act(async () => {
    host.querySelector('[aria-label="Stop dictation"]').click()
    await vi.waitFor(() => expect(mocks.api.mock.calls.some(([path]) => path.endsWith('/parse-audio'))).toBe(true))
  })
  expect(stopTrack).toHaveBeenCalled()
  expect(host.textContent).toContain('Your meal, broken down.')
  expect(host.textContent).toContain('I had a slice of toast.')
  expect(mocks.logFood).not.toHaveBeenCalled()
})

it('keeps an unrecognized voice description editable instead of presenting a zero-calorie review', async () => {
  setupRecording(vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }))
  mocks.api.mockImplementation(async path => path.endsWith('/config') ? { configured: true, audio: true }
    : { raw: 'some food I cannot name', items: [], unresolved: ['some food I cannot name'], notices: [] })
  await render('empty-audio')
  act(() => host.querySelector('[role="switch"]').click())
  await act(async () => host.querySelector('[aria-label="Dictate meal"]').click())
  await act(async () => {
    host.querySelector('[aria-label="Stop dictation"]').click()
    await vi.waitFor(() => expect(mocks.api.mock.calls.some(([path]) => path.endsWith('/parse-audio'))).toBe(true))
  })
  expect(host.querySelector('[aria-label="Meal totals"]')).toBeNull()
  expect(host.querySelector('textarea').value).toBe('some food I cannot name')
  expect(host.querySelector('[role="alert"]').textContent).toContain('We couldn’t identify these foods')
  expect(mocks.logFood).not.toHaveBeenCalled()
})

it('handles a denied recording permission and keeps typing available', async () => {
  setupRecording(vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' })))
  await render('audio')
  act(() => host.querySelector('[role="switch"]').click())
  await act(async () => host.querySelector('[aria-label="Dictate meal"]').click())
  expect(host.textContent).toContain('Microphone access was denied')
  expect(host.querySelector('textarea').readOnly).toBe(false)
})

it('cancels a pending microphone permission request when the sheet closes', async () => {
  let resolve
  const stopTrack = vi.fn()
  const recording = setupRecording(vi.fn().mockImplementation(() => new Promise(done => { resolve = done })))
  await render('audio')
  act(() => host.querySelector('[role="switch"]').click())
  await act(async () => host.querySelector('[aria-label="Dictate meal"]').click())
  act(() => root.unmount())
  await act(async () => resolve({ getTracks: () => [{ stop: stopTrack }] }))
  expect(stopTrack).toHaveBeenCalledOnce()
  expect(recording.instance()).toBeUndefined()
})
