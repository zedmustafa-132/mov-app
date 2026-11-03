import { useUI } from '../store/useUI.js'
import { HomeMenu } from '../views/Home.jsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Brand } from './Brand.jsx'
import Elapsed from './Elapsed.jsx'
import { useConnectionTrouble } from './SyncBanner.jsx'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick, dot }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} aria-current={active ? 'page' : undefined} aria-label={dot ? label + ', ' + t('Connection problem') : undefined}>
      <span className="tab-ic"><Icon name={icon} />{dot && <span className="tab-dot" aria-hidden="true" />}</span><span>{label}</span>
    </button>
  )
}

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // With the connection banner switched off, a sync problem shows as a dot on Home, the tab
  // Settings lives under (#369, #330).
  const trouble = useConnectionTrouble()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  // A screen without a tab of its own lights the tab it is opened from (Muscles from both).
  const PARENT = { history: 'stats', 'structural-balance': 'stats', 'progress-photos': 'stats', measurements: 'stats', settings: 'home', checkin: 'home', muscles: 'plan', library: 'plan', recipes: 'food' }
  const parent = cur === 'muscles' && loc.state?.from === '/stats' ? 'stats' : PARENT[cur]
  const on = k => cur === k || parent === k

  // Root tabs are peers, not another level to unwind with Android Back.
  const switchTab = path => {
    if (loc.pathname !== path || loc.search) nav(path, { replace: true })
  }

  const running = !!S.active && cur !== 'workout' && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/workout')
  }

  return (
    <nav id="tabbar" className="simple-nav" aria-label={t('Main navigation')}>
      <div className="desktop-brand"><Brand /></div>
      <Tab active={cur === 'home' || cur === 'food' || cur === 'overview'} icon="gameHome" label={t('Today')} dot={trouble} onClick={() => switchTab('/home')} />
      <Tab active={cur === 'workout' || cur === 'plan' || cur === 'library' || cur === 'muscles'} icon="questTraining" label={running ? t('Resume') : t('Train')} onClick={() => nav('/workout')} />
      <Tab active={on('stats')} icon="gameProgress" label={t('Progress')} onClick={() => switchTab('/stats')} />
      <Tab active={cur === 'settings'} icon="gameMenu" label={t('More')} onClick={() => useUI.getState().openSheet(close => <HomeMenu close={close} />)} />
    </nav>
  )
}
