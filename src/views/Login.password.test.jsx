// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

/* The sign-in screen with password sign-in (#118). Only an instance that advertises
   `password_login` shows any of it; there, a browser without passkey support finally has a way
   in instead of being told to stay local, and creating a profile can use a password. */
const mocks = vi.hoisted(() => {
  const state = { webauthn: true, config: null, sheets: [] }
  state.snapshot = () => ({
    config: state.config, S: {},
    setUser: vi.fn(), adoptProfile: vi.fn(), setGuest: vi.fn(), loadConfig: vi.fn(async () => state.config),
    pushState: vi.fn(), pullState: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: render => { mocks.sheets.push(render); return {} } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('../lib/api.js', () => ({
  webauthnOK: () => mocks.webauthn, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), BIO: 'your fingerprint', bio: () => 'your fingerprint',
  api: vi.fn(), passkeyAssertion: vi.fn(), passwordLogin: vi.fn(), passwordRegister: vi.fn(), passwordResetRedeem: vi.fn(),
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false, REPO: 'https://example.invalid' }))
vi.mock('../sheets.jsx', () => ({ askAddDeviceData: vi.fn(), confirmSheet: vi.fn() }))

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return host
}
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent)
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent === text)

beforeEach(() => { mocks.webauthn = true; mocks.config = null; mocks.sheets.length = 0 })
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('Login with password sign-in', () => {
  it('only offers supported ways in when password login is unavailable', () => {
    const page = mount(<Login />)
    expect(buttons(page)).toContain('Sign in')
    mocks.webauthn = false
    const noPasskeys = mount(<Login />)
    expect(buttons(noPasskeys)).toContain('Try without a profile')
    expect(buttons(noPasskeys)).not.toContain('Sign in')
  })

  it('next to passkeys it is a second button, and the footer no longer says "no passwords"', () => {
    mocks.config = { password_login: true, allow_guest: true }
    const page = mount(<Login />)
    expect(buttons(page)).toEqual(['Create profile', 'Sign in', 'Try without a profile', 'Use password', 'Link device', 'Lost access?'])
    act(() => button(page, 'Use password').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('h3').textContent).toBe('Welcome back.')
    expect(sheet.querySelector('input[autocomplete="current-password"]')).toBeTruthy()
  })

  it('a browser without passkeys gets a way in instead of "stay local"', () => {
    mocks.webauthn = false
    mocks.config = { password_login: true, allow_guest: false }
    const page = mount(<Login />)
    expect(page.textContent).not.toContain('Try a browser or device with passkey support.')
    expect(buttons(page)).toEqual(['Create profile', 'Sign in', 'Lost access?'])
    // Creating a profile here can only mean a password: no passkey/password choice to make.
    act(() => button(page, 'Create profile').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('.auth-method-choice .seg')).toBeNull()
    expect(sheet.querySelector('[aria-label="Measurement system"]')).toBeTruthy()
    expect(sheet.querySelector('input[placeholder="Repeat the password"]')).toBeTruthy()
    expect(buttons(sheet)).toContain('Create profile')
  })

  it('where both work, creating a profile starts on the passkey and switches to a password', () => {
    mocks.config = { password_login: true, invite_only: true }
    const page = mount(<Login />)
    act(() => button(page, 'Create profile').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(buttons(sheet)).toContain('Create passkey')
    act(() => button(sheet, 'Password').click())
    expect(buttons(sheet)).toContain('Create profile')
    expect(sheet.querySelector('input[placeholder="Invite code"]')).toBeTruthy()
    expect(sheet.querySelector('input[autocomplete="new-password"]')).toBeTruthy()
  })

  it('makes profile creation the first action and offers password sign-in for a temporary test URL', () => {
    mocks.config = { password_login: true, temporary_url: true, invite_only: true, allow_guest: false }
    const page = mount(<Login />)
    expect(buttons(page).slice(0, 2)).toEqual(['Create profile', 'Sign in'])
    expect(buttons(page)).toContain('Use passkey')
    act(() => button(page, 'Create profile').click())
    const sheet = mount(mocks.sheets[0](() => {}))
    expect(sheet.querySelector('input[placeholder="Invite code"]')).toBeTruthy()
    expect(sheet.querySelector('input[autocomplete="new-password"]')).toBeTruthy()
  })
})
