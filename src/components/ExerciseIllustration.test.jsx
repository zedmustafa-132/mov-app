// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { EXIDX } from '../lib/exercises.js'
import { illustrationFor } from '../lib/exercise-illustrations.js'
import Media, { Thumb } from './Media.jsx'
import { hasWorkoutMedia } from './WorkoutThumb.jsx'
import { ExerciseIllustration } from './ExerciseIllustration.jsx'

const animation = vi.hoisted(() => ({ still: false }))
vi.mock('./Animations.jsx', () => ({ useAnimSources: () => ({ still: animation.still, sources: [] }) }))
let root, host
const render = element => act(() => root.render(element))
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  animation.still = false
  useStore.setState(s => ({ S: { ...s.S, gifSize: 'full' } }))
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

describe('lightweight exercise demonstrations', () => {
  it('renders static list pictures without animation, images, video, or remote requests', () => {
    render(<Thumb ex={EXIDX['3948']} />)
    expect(host.querySelector('svg.thumb[data-illustration="squat"]')).toBeTruthy()
    expect(host.querySelector('img,video,animate,image')).toBeNull()
  })
  it('shows an exercise-specific looping preview and accessible pause/play controls', () => {
    render(<Media ex={EXIDX['0662']} />)
    expect(host.querySelector('svg[data-illustration="push-up"][role="img"]').getAttribute('aria-label')).toContain('movement demonstration')
    expect(host.querySelector('animate[repeatCount="indefinite"]')).toBeTruthy()
    expect(host.querySelector('img,video,image')).toBeNull()
    act(() => host.querySelector('[aria-label="Pause demonstration"]').click())
    expect(host.querySelector('[aria-label="Play demonstration"]')).toBeTruthy()
  })
  it('honours the workout visibility settings and the still-only animation setting', () => {
    useStore.setState(s => ({ S: { ...s.S, gifSize: 'off' } }))
    render(<Media ex={EXIDX['3948']} minimizable />)
    expect(host.innerHTML).toBe('')
    render(<Media ex={EXIDX['3948']} />)
    expect(host.querySelector('svg')).toBeTruthy()
    animation.still = true
    render(<Media ex={EXIDX['3948']} />)
    expect(host.querySelector('animate')).toBeNull()
    expect(host.querySelector('.illustration-play')).toBeNull()
  })
  it('starts paused when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    render(<Media ex={EXIDX['3948']} />)
    expect(host.querySelector('[aria-label="Play demonstration"]')).toBeTruthy()
  })
  it('pauses SVG playback while outside the viewport and disconnects its observer', () => {
    let callback
    const disconnect = vi.fn(), pause = vi.fn(), play = vi.fn()
    vi.stubGlobal('IntersectionObserver', class { constructor(cb) { callback = cb } observe() {} disconnect = disconnect })
    const demo = illustrationFor(EXIDX['3948'])
    render(<ExerciseIllustration demo={demo} playing />)
    const svg = host.querySelector('svg')
    svg.pauseAnimations = pause; svg.unpauseAnimations = play
    act(() => callback([{ isIntersecting: false }]))
    expect(pause).toHaveBeenCalledOnce()
    act(() => callback([{ isIntersecting: true }]))
    expect(play).toHaveBeenCalledOnce()
    render(null)
    expect(disconnect).toHaveBeenCalledOnce()
  })
  it('keeps an isometric hold still, and recognises local demos even without a clip filename', () => {
    render(<Media ex={EXIDX['0463']} />)
    expect(host.querySelector('animate')).toBeNull()
    expect(host.textContent).toContain('Hold steady')
    expect(hasWorkoutMedia({ id: '3948' })).toBe(true)
    expect(hasWorkoutMedia({ id: 'unsupported' })).toBe(false)
  })
})
