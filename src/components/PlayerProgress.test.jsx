// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ S: {}, days: {}, openSheet: vi.fn() }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: state.S }) }))
vi.mock('../store/useNutrition.js', () => ({ useNutrition: selector => selector({ days: state.days }) }))
vi.mock('../store/useUI.js', () => ({ useUI: selector => selector({ openSheet: state.openSheet }) }))
vi.mock('./CharacterSheetModal.jsx', () => ({ CharacterSheetModal: () => null }))

import { GameRewards, PlayerBadge } from './PlayerProgress.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('MOV player progress', () => {
  let host, root
  const render = (children = <GameRewards />) => act(() => root.render(children))
  const setWater = waterMl => { state.days = { '2026-10-31': { entries: [], waterMl } } }

  beforeEach(() => {
    vi.useFakeTimers()
    state.S = { workouts: [], bodyweight: [], targets: { waterMl: 3000 } }
    state.days = {}
    state.openSheet.mockReset()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    if (root) act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('does not celebrate existing XP when a profile first appears', () => {
    state.S = { ...state.S, bodyweight: Array.from({ length: 24 }, () => ({ w: 80 })) }
    setWater(3000)
    render(<><PlayerBadge /><GameRewards /></>)
    expect(host.querySelector('[role="status"]')).toBeNull()
    expect(host.querySelector('.player-badge').getAttribute('aria-label')).toBe('Open character. Level 2, 30 of 283 XP')
  })

  it('celebrates a real hydration XP gain and removes the notice after its display time', () => {
    setWater(2750)
    render()
    expect(host.querySelector('[role="status"]')).toBeNull()
    setWater(3000)
    render()
    expect(host.querySelector('[role="status"]').textContent).toContain('+10 XP earned')
    act(() => vi.advanceTimersByTime(2799))
    expect(host.querySelector('[role="status"]')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(host.querySelector('[role="status"]')).toBeNull()
  })

  it('does not award another notice for water added above an already-reached goal', () => {
    setWater(2750)
    render(<><PlayerBadge /><GameRewards /></>)
    setWater(3000)
    render(<><PlayerBadge /><GameRewards /></>)
    expect(host.querySelector('[role="status"]').textContent).toContain('+10 XP earned')
    act(() => vi.advanceTimersByTime(2800))
    setWater(3250)
    render(<><PlayerBadge /><GameRewards /></>)
    expect(host.querySelector('[role="status"]')).toBeNull()
    expect(host.querySelector('.player-badge').getAttribute('aria-label')).toContain('10 of 100 XP')
  })

  it('waits for the hydration target shown to a legacy profile before celebrating', () => {
    state.S = { workouts: [], bodyweight: [], dailyTargets: { waterMl: 3500 } }
    setWater(3000)
    render()
    setWater(3250)
    render()
    expect(host.querySelector('[role="status"]')).toBeNull()
    setWater(3500)
    render()
    expect(host.querySelector('[role="status"]').textContent).toContain('+10 XP earned')
  })

  it('announces an actual level crossing and updates the accessible progress badge', () => {
    state.S = { ...state.S, bodyweight: Array.from({ length: 18 }, () => ({ w: 80 })) }
    render(<><PlayerBadge /><GameRewards /></>)
    expect(host.querySelector('.player-badge').getAttribute('aria-label')).toBe('Open character. Level 1, 90 of 100 XP')
    state.S = { ...state.S, bodyweight: [...state.S.bodyweight, { w: 80 }, { w: 80 }] }
    render(<><PlayerBadge /><GameRewards /></>)
    expect(host.querySelector('[role="status"]').textContent).toContain('Level 2 unlocked!')
    expect(host.querySelector('[role="status"]').textContent).toContain('+10 XP earned')
    expect(host.querySelector('.player-badge').getAttribute('aria-label')).toBe('Open character. Level 2, 0 of 283 XP')
    expect(host.querySelector('.player-xp-track i').style.width).toBe('0%')
  })

  it('does not announce rewards when saved data is removed or corrected downward', () => {
    setWater(3000)
    render()
    setWater(1000)
    render()
    expect(host.querySelector('[role="status"]')).toBeNull()
  })

  it('opens the existing character sheet from the keyboard-accessible badge button', () => {
    render(<PlayerBadge />)
    const button = host.querySelector('button.player-badge')
    expect(button).not.toBeNull()
    expect(button.getAttribute('aria-label')).toBe('Open character. Level 1, 0 of 100 XP')
    act(() => button.click())
    expect(state.openSheet).toHaveBeenCalledOnce()
    const close = vi.fn()
    expect(state.openSheet.mock.calls[0][0](close).props.close).toBe(close)
  })

  it('cleans up a pending celebration timer when its screen unmounts', () => {
    render()
    setWater(3000)
    render()
    expect(vi.getTimerCount()).toBe(1)
    act(() => root.unmount())
    root = null
    expect(vi.getTimerCount()).toBe(0)
  })
})
