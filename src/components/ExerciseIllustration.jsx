import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { figureOf } from '../lib/exercises.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { useAnimSources } from './Animations.jsx'
import Icon from './Icon.jsx'
import '../exercise-illustrations.css'

const TIMES = '0;0.42;0.55;0.92;1'
const SPLINES = Array(4).fill('.42 0 .58 1').join(';')
const line = (a, b) => p => ({ x1: p[a][0], y1: p[a][1], x2: p[b][0], y2: p[b][1] })
const point = key => p => ({ cx: p[key][0], cy: p[key][1] })
const torso = p => {
  const [sx, sy] = p.s, [px, py] = p.p
  const length = Math.hypot(px - sx, py - sy)
  const nx = (py - sy) / length, ny = -(px - sx) / length
  return { d: `M${sx + nx * 15},${sy + ny * 15} L${sx - nx * 15},${sy - ny * 15} L${px - nx * 11},${py - ny * 11} L${px + nx * 11},${py + ny * 11} Z` }
}

function Motion({ as: Tag, frames, attrs, duration, ...props }) {
  const values = frames.map(attrs)
  return <Tag {...props} {...values[0]}>{frames.length > 1 && Object.keys(values[0]).map(name =>
    <animate key={name} attributeName={name} values={values.map(v => v[name]).join(';')} dur={`${duration}s`}
      keyTimes={TIMES} keySplines={SPLINES} calcMode="spline" repeatCount="indefinite" />
  )}</Tag>
}

function Segment({ a, b, className, ...motion }) {
  return <Motion as="line" {...motion} attrs={line(a, b)} className={className} />
}

export function ExerciseIllustration({ demo, playing = false, thumbnail = false, still = false, label }) {
  const ref = useRef(null)
  const poses = demo.poses
  const resting = poses[demo.still || 0]
  const selected = thumbnail || still || poses.length === 1 ? [resting] : [poses[0], poses[1], poses[1], poses[0], poses[0]]
  const frames = selected.map(p => ({ ...p, sl: [p.s[0] - (demo.front ? 14 : 0), p.s[1] + 3], sr: [p.s[0] + (demo.front ? 14 : 6), p.s[1] + 3] }))
  const duration = demo.duration || 3.4
  const motion = { frames, duration }

  useEffect(() => {
    const svg = ref.current
    if (!svg || thumbnail || still) return
    let visible = true
    const sync = () => {
      if (playing && visible) svg.unpauseAnimations?.()
      else svg.pauseAnimations?.()
    }
    sync()
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; sync() }, { rootMargin: '30px' })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [playing, thumbnail, still, demo.kind])

  const handBar = p => ({ x1: Math.min(p.wl[0], p.wr[0]) - 29, y1: (p.wl[1] + p.wr[1]) / 2, x2: Math.max(p.wl[0], p.wr[0]) + 29, y2: (p.wl[1] + p.wr[1]) / 2 })
  const plate = (key, dx) => p => ({ x: p[key][0] + dx, y: p[key][1] - 13 })
  return <svg ref={ref} className={`exercise-illustration${thumbnail ? ' thumb' : ''}`} viewBox={thumbnail ? '28 7 184 207' : '0 0 240 230'}
    role={thumbnail ? undefined : 'img'} aria-label={thumbnail ? undefined : label} aria-hidden={thumbnail || undefined} focusable="false" data-illustration={demo.kind}>
    <ellipse cx="120" cy="215" rx="84" ry="5" className="demo-shadow" />
    <path d="M28 211H212" className="demo-floor" />
    {demo.bench === 'flat' && <g className="demo-bench"><path d="M58 152H174M77 156V207M159 156V207" /><path d="M52 148H176" className="demo-bench-pad" /></g>}
    {demo.bench === 'incline' && <g className="demo-bench"><path d="M80 113L147 158H173M130 159V207M166 161V207" /><path d="M76 104L146 153H176" className="demo-bench-pad" /></g>}
    {demo.bench === 'seat' && <g className="demo-bench"><path d="M120 160V208M96 208H144" /><path d="M98 158H142" className="demo-bench-pad" /></g>}
    {demo.equipment === 'pulldown' && <path d="M28 209V5H212V209" className="demo-machine" />}
    {(demo.equipment === 'pulldown' || demo.equipment === 'cable') && <Motion as="line" {...motion} attrs={p => ({ x1: 120, y1: 5, x2: 120, y2: (p.wl[1] + p.wr[1]) / 2 })} className="demo-cable" />}
    <g className={'demo-far' + (demo.front ? ' is-front' : '')}><Segment {...motion} a="p" b="kr" className="demo-thigh" /><Segment {...motion} a="kr" b="ar" className="demo-shin" /><Segment {...motion} a="ar" b="tr" className="demo-shoe" /><Segment {...motion} a="sr" b="er" className="demo-upper-arm" /><Segment {...motion} a="er" b="wr" className="demo-forearm" /></g>
    <Segment {...motion} a="h" b="s" className="demo-neck" />
    <Motion as="path" {...motion} attrs={torso} className="demo-shirt" />
    <Motion as="circle" {...motion} attrs={point('p')} r="13" className="demo-shorts" />
    <Segment {...motion} a="p" b="kl" className="demo-thigh" /><Segment {...motion} a="kl" b="al" className="demo-shin" /><Segment {...motion} a="al" b="tl" className="demo-shoe" />
    <Segment {...motion} a="sl" b="el" className="demo-upper-arm" /><Segment {...motion} a="el" b="wl" className="demo-forearm" />
    <Motion as="circle" {...motion} attrs={point('h')} r="13" className="demo-head" />
    <Motion as="path" {...motion} attrs={p => ({ d: `M${p.h[0] - 12},${p.h[1] - 2} Q${p.h[0] - 9},${p.h[1] - 22} ${p.h[0] + 11},${p.h[1] - 8} L${p.h[0] + 5},${p.h[1] - 3} Z` })} className="demo-hair" />
    {['dumbbells', 'hammers'].includes(demo.equipment) && ['wl', 'wr'].map(key => <g key={key}>
      <Motion as="line" {...motion} attrs={p => demo.equipment === 'hammers' ? { x1: p[key][0], y1: p[key][1] - 11, x2: p[key][0], y2: p[key][1] + 11 } : { x1: p[key][0] - 11, y1: p[key][1], x2: p[key][0] + 11, y2: p[key][1] }} className="demo-weight-bar" />
      {[-1, 1].map(sign => <Motion key={sign} as="rect" {...motion} attrs={p => demo.equipment === 'hammers' ? { x: p[key][0] - 8, y: p[key][1] + sign * 9 - 3 } : { x: p[key][0] + sign * 9 - 3, y: p[key][1] - 8 }} width={demo.equipment === 'hammers' ? 16 : 6} height={demo.equipment === 'hammers' ? 6 : 16} rx="2" className="demo-weight" />)}
    </g>)}
    {['bar', 'pulldown'].includes(demo.equipment) && <Motion as="line" {...motion} attrs={handBar} className="demo-weight-bar" />}
    {demo.equipment === 'cable' && <Motion as="path" {...motion} attrs={p => ({ d: `M${p.wl[0] - 7},${p.wl[1]} L120,${(p.wl[1] + p.wr[1]) / 2 - 12} L${p.wr[0] + 7},${p.wr[1]}` })} className="demo-vbar" />}
    {demo.equipment === 'bar' && <><Motion as="rect" {...motion} attrs={plate('wl', -26)} width="8" height="26" rx="3" className="demo-weight" /><Motion as="rect" {...motion} attrs={plate('wr', 18)} width="8" height="26" rx="3" className="demo-weight" /></>}
    {demo.equipment === 'shoulder-bar' && <><Motion as="line" {...motion} attrs={p => ({ x1: p.s[0] - 38, y1: p.s[1] - 2, x2: p.s[0] + 35, y2: p.s[1] - 2 })} className="demo-weight-bar" /><Motion as="rect" {...motion} attrs={p => ({ x: p.s[0] - 30, y: p.s[1] - 16 })} width="9" height="28" rx="3" className="demo-weight" /><Motion as="rect" {...motion} attrs={p => ({ x: p.s[0] + 23, y: p.s[1] - 16 })} width="9" height="28" rx="3" className="demo-weight" /></>}
    {demo.equipment === 'goblet' && <Motion as="rect" {...motion} attrs={p => ({ x: p.wl[0] - 6, y: p.wl[1] - 12 })} width="12" height="23" rx="4" className="demo-weight" />}
  </svg>
}

export function IllustrationMedia({ ex, demo, id, compact, minimizable }) {
  const gifSize = useStore(s => s.S.gifSize)
  const body = useStore(s => figureOf(s.S))
  const update = useStore(s => s.update)
  const { still } = useAnimSources(ex, body)
  const [playing, setPlaying] = useState(() => !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  const mini = minimizable && gifSize === 'mini'
  useEffect(() => {
    const preference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
    const change = event => setPlaying(!event.matches)
    preference?.addEventListener?.('change', change)
    return () => preference?.removeEventListener?.('change', change)
  }, [])
  if (minimizable && gifSize === 'off') return null
  return <div className={`exmedia illustration-media${compact ? ' compact' : ''}${mini ? ' mini' : ''}`} id={id}>
    <div className="illustration-media-heading"><span>{t('Movement demo')}</span>{!still && !demo.hold && <button type="button" className="illustration-play" aria-label={playing ? t('Pause demonstration') : t('Play demonstration')} onClick={() => setPlaying(!playing)}><Icon name={playing ? 'pause' : 'play'} /></button>}</div>
    <ExerciseIllustration demo={demo} playing={playing} still={still} label={t('{0} movement demonstration', exerciseNameFor(ex))} />
    {!mini && <p className="illustration-cue">{t(demo.cue)}</p>}
    {minimizable && <button type="button" className="giftoggle" onClick={() => update(s => { s.gifSize = mini ? 'full' : 'mini' })}><Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}</button>}
  </div>
}
