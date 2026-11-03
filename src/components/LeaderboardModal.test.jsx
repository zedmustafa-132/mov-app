// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaderboardModal } from './LeaderboardModal.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('LeaderboardModal Component', () => {
  let host, root, close

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          entries: [
            { id: 'u1', rank: 1, username: 'TitanLifter', level: 25, totalXp: 18000, weeklyXp: 600, formName: 'Titan Vanguard', formIcon: 'shield', title: 'Contender', streakDays: 28 },
            { id: 'u2', rank: 2, username: 'IronAdept', level: 12, totalXp: 5200, weeklyXp: 450, formName: 'Iron Adept', formIcon: 'fire', title: 'Athlete', streakDays: 14 },
            { id: 'u3', rank: 3, username: 'RookieGamer', level: 4, totalXp: 950, weeklyXp: 200, formName: 'Novice', formIcon: 'sparkles', title: 'Rookie', streakDays: 5 }
          ],
          userRank: { id: 'u2', rank: 2, username: 'IronAdept', level: 12, totalXp: 5200, title: 'Athlete' },
          type: 'all_time'
        })
      })
    }))

    close = vi.fn()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  it('shows the returned people, their ranks, and a working close action', async () => {
    await act(async () => {
      root.render(<LeaderboardModal close={close} />)
    })

    expect(host.querySelector('h3').textContent).toBe('Rankings')
    expect(host.textContent).toContain('All time')
    expect(host.textContent).toContain('This week')
    expect(host.textContent).toContain('Streaks')
    expect(host.textContent).toContain('TitanLifter')
    expect(host.textContent).toContain('IronAdept')
    expect(host.textContent).toContain('RookieGamer')
    expect(host.querySelectorAll('.rankings-list li')).toHaveLength(3)
    expect(host.querySelector('.your-rank').textContent).toContain('#2')

    const closeBtn = host.querySelector('button[aria-label="Close"]')
    expect(closeBtn).toBeTruthy()
    act(() => closeBtn.click())
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('shows one real participant without inventing other podium places', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [{ id: 'u1', rank: 1, username: 'OnlyAthlete', totalXp: 100 }] }) })
    await act(async () => { root.render(<LeaderboardModal close={close} />) })
    expect(host.querySelectorAll('.rankings-list li')).toHaveLength(1)
    expect(host.textContent).toContain('OnlyAthlete')
    expect(host.textContent).not.toContain('Player 2')
    expect(host.textContent).not.toContain('Player 3')
  })

  it('explains a loading failure and lets the user retry successfully', async () => {
    fetch.mockResolvedValueOnce({ ok: false })
    await act(async () => { root.render(<LeaderboardModal close={close} />) })
    expect(host.textContent).toContain('Rankings couldn’t load')
    expect(host.textContent).not.toContain('A fresh start for everyone')
    const retry = [...host.querySelectorAll('button')].find(button => button.textContent === 'Try again')
    await act(async () => { retry.click() })
    expect(host.textContent).toContain('TitanLifter')
    expect(host.textContent).not.toContain('Rankings couldn’t load')
  })
})
