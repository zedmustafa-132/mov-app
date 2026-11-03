// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import { EXIDX } from './lib/exercises.js'
import { exerciseNameText } from './lib/format.js'

let root, host
function open(onPick = vi.fn(), options) {
  exercisePicker(onPick, options)
  const sheet = useUI.getState().sheets.at(-1)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return onPick
}
const byText = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useStore.setState({ S: structuredClone(DEF), user: null })
  useUI.setState({ sheets: [], toastMsg: '' })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('exercise picker for a new lifter', () => {
  it('opens with a small starting set and keeps the complete catalogue one explicit action away', () => {
    open()
    expect(host.querySelectorAll('.picker-suggestions .picker-choice')).toHaveLength(6)
    expect(host.querySelector('.picker-choice-title').textContent).toBe(EXIDX['3948'].n)
    expect(host.querySelector('.picker-catalogue').open).toBe(false)
    act(() => byText('All exercises').click())
    expect(host.querySelector('.picker-suggestions')).toBeNull()
    expect(host.querySelector('.picker-catalogue').open).toBe(true)
    expect(host.querySelectorAll('.list .picker-result').length).toBeGreaterThan(6)
  })

  it('quick-adds several exercises, confirms the count, and keeps their order steady', () => {
    const onPick = open(vi.fn((ex, quick) => {
      if (quick) useStore.setState(s => ({ S: { ...s.S, active: { entries: [...(s.S.active?.entries || []), { id: ex.id }] } } }))
    }))
    const firstTitle = host.querySelector('.picker-choice-title').textContent
    act(() => host.querySelector('.picker-choice .picker-add-button').click())
    expect(onPick).toHaveBeenLastCalledWith(EXIDX['3948'], true)
    expect(host.querySelector('.picker-added-summary').textContent).toContain('1 exercise added')
    expect(host.querySelector('.picker-choice-title').textContent).toBe(firstTitle)
    expect(host.querySelector('.picker-choice .picker-add-button').textContent).toBe('Add again')
    act(() => host.querySelectorAll('.picker-choice .picker-add-button')[1].click())
    expect(onPick).toHaveBeenLastCalledWith(EXIDX['0662'], true)
    expect(host.querySelector('.picker-added-summary').textContent).toContain('2 exercises added')
    act(() => byText('Done').click())
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('keeps exercise details separate from committing an add', () => {
    const onPick = open()
    act(() => host.querySelector('.picker-choice .picker-detail-button').click())
    expect(onPick).toHaveBeenCalledWith(EXIDX['3948'])
    expect(host.querySelector('.picker-added-summary').textContent).not.toContain('1 exercise added')
  })

  it('lets returning users jump directly to recent exercises', () => {
    useStore.setState(s => ({ S: { ...s.S, workouts: [
      { d: '2026-10-01', entries: [{ id: '0025' }] },
      { d: '2026-10-31', entries: [{ id: '0662' }, { id: '3948' }] }
    ] } }))
    open()
    act(() => byText('Recent').click())
    const rows = [...host.querySelectorAll('.list .picker-result')]
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelector('.picker-detail-button').getAttribute('aria-label')).toBe(`Exercise details: ${exerciseNameText(EXIDX['3948'])}`)
  })

  it('preserves a direct, correctly worded replacement action in swap flows', () => {
    const onPick = open(vi.fn(), { title: 'Swap exercise', like: '3948' })
    expect(host.querySelector('.picker-suggestions')).toBeNull()
    const button = host.querySelector('.list .picker-result .picker-add-button')
    expect(button.textContent).toBe('Use')
    expect(button.querySelector('svg').getAttribute('data-icon')).toBe('swap')
    act(() => button.click())
    expect(onPick.mock.calls[0][1]).toBe(true)
  })

  it('exposes details and add as separate native keyboard controls without an interactive parent', () => {
    const onPick = open()
    const row = host.querySelector('.picker-choice')
    const details = row.querySelector('.picker-detail-button')
    const add = row.querySelector('.picker-add-button')
    expect(row.getAttribute('role')).toBeNull()
    expect(row.hasAttribute('tabindex')).toBe(false)
    expect(details.tagName).toBe('BUTTON')
    expect(add.tagName).toBe('BUTTON')
    expect(details.contains(add)).toBe(false)
    expect(details.getAttribute('aria-label')).toBe(`Exercise details: ${exerciseNameText(EXIDX['3948'])}`)
    details.focus()
    expect(document.activeElement).toBe(details)
    act(() => details.click())
    expect(onPick).toHaveBeenCalledWith(EXIDX['3948'])
    add.focus()
    expect(document.activeElement).toBe(add)
    act(() => add.click())
    expect(onPick).toHaveBeenLastCalledWith(EXIDX['3948'], true)
  })
})
