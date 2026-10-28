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

  it('renders title, podium, and close button', async () => {
    await act(async () => {
      root.render(<LeaderboardModal close={close} />)
    })

    expect(host.querySelector('h2').textContent).toBe('Leaderboard')
    expect(host.textContent).toContain('All-Time')
    expect(host.textContent).toContain('Weekly')
    expect(host.textContent).toContain('Streaks')
    expect(host.textContent).toContain('TitanLifter')
    expect(host.textContent).toContain('IronAdept')
    expect(host.textContent).toContain('RookieGamer')
    expect(host.textContent).toContain('🥇')
    expect(host.textContent).toContain('🥈')
    expect(host.textContent).toContain('🥉')

    const closeBtn = host.querySelector('button[aria-label="Close"]')
    expect(closeBtn).toBeTruthy()
    act(() => closeBtn.click())
    expect(close).toHaveBeenCalledTimes(1)
  })
})
