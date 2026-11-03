import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekStartOf, weekDayOffset, DAYS, DAYN } from '../lib/format.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, starterPlanSheet, bwDeltaColor, weighInsSheet, workoutDetailSheet, quickExerciseSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import QueueRow from '../components/QueueRow.jsx'
import MiniBodyMap from '../components/MiniBodyMap.jsx'
import { queueOf, queueView, weekTally, pinState } from '../lib/queue.js'
import { scheduleModeOf } from '../lib/rotation.js'
import { useConnectionTrouble } from '../components/SyncBanner.jsx'
import { Button, Row } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf } from '../lib/glyphs.js'
import { dayNoteOf } from '../lib/day-notes.js'
import { weighInAt } from '../lib/bodyweight.js'
import WeightRate from '../components/WeightRate.jsx'
import { SeasonDeco } from '../components/Seasonal.jsx'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../store/useNutrition.js'
import { computeDayTotals, getLocalDateString } from '../lib/nutrition/totals.js'
import { FoodSearchSheet } from '../components/FoodSearchSheet.jsx'
import { useGamification } from '../lib/gamification/useGamification.js'
import { CharacterSheetModal } from '../components/CharacterSheetModal.jsx'
import { LeaderboardModal } from '../components/LeaderboardModal.jsx'
import { weeklySummarySheet } from '../components/WeeklySummaryModal.jsx'
import { getActiveTargets } from '../lib/targets.js'
import { ProgressRing, WaterGlass } from '../components/DailyVisuals.jsx'
import { PlayerBadge } from '../components/PlayerProgress.jsx'
import { Brand } from '../components/Brand.jsx'
import { workoutArtStyle } from '../lib/workout-art.js'
import { firstWorkoutSheet } from '../components/FirstWorkoutSheet.jsx'
import { needsFirstWorkout } from '../lib/first-workout.js'

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export function HomeOverview() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  // The banner switched off and the sync stuck: a dot on the gear (Settings → Show connection status).
  const trouble = useConnectionTrouble()
  const openSheet = useUI(s => s.openSheet)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const todayStr = todayISO()
  const nutritionDays = useNutrition(s => s.days)
  const todayNutrition = nutritionDays[todayStr] || { entries: [], waterMl: 0 }
  const nutritionTotals = computeDayTotals(todayNutrition.entries || [])
  const activeTargets = getActiveTargets(S)
  const calTarget = activeTargets.dailyCalories
  const protTarget = activeTargets.proteinGrams
  const carbTarget = activeTargets.carbsGrams
  const fatTarget = activeTargets.fatGrams
  const waterTarget = activeTargets.waterMl
  const remainingKcal = calTarget - nutritionTotals.calories
  const { levelInfo, characterStats, dailyQuests, streakDays, streakFreezes } = useGamification()
  const openCharacterSheet = () => openSheet(close => <CharacterSheetModal close={close} />)
  const openLeaderboard = (e) => {
    e?.stopPropagation?.()
    openSheet(close => <LeaderboardModal close={close} />)
  }
  // A weekday can hold several routines. `todayRoutines` is the whole day; `routine` is the
  // first, kept for the one-routine glyph. The derived session name joins them (§9).
  const todayRoutines = effectiveRoutines(S, todayISO())
  const routine = todayRoutines[0] || null
  const todayName = todayRoutines.map(r => r.name).join(' + ')
  // A fulfilled pin (a coach session pinned to today and since done) reads as no override.
  const todayOvr = S.dayPlan[todayISO()] !== undefined && pinState(S, S.dayPlan[todayISO()]) !== 'done'
  // An open editor on a saved workout (lib/session-edit.js) holds S.active too, but it is not a
  // session in progress: the row takes you back to it as an edit, the way the tab bar does.
  const editingSaved = !!S.active?.editingWorkoutId
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const ws = weekStartOf(S)
  // The first day of the shown week. Named for the role, not for Monday — which day that is
  // is the setting.
  const wkStart = new Date(today)
  wkStart.setDate(today.getDate() - weekDayOffset(today.getDay(), ws) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  // The last session logged for today, if any — what the row below reports instead of asking
  // you to start the one you already did. Last wins, so a second session names itself. Only once
  // today's plan is covered, though: a freestyle session on a planned day, or the rotation's
  // first session done when its next one is today's too, leaves the row offering what is still
  // to do, as Start and the progress row already do. A queue session is never "covered" by an
  // earlier workout: the queue only names one it does not count as done yet.
  const loggedToday = S.workouts.filter(w => w.d === todayISO())
  const queueIds = queueOf(S)?.ids || []
  const coveredToday = id => !queueIds.includes(id) && loggedToday.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(id))
  const doneToday = (todayRoutines.every(r => coveredToday(r.id)) && loggedToday.at(-1)) || null
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineIds(S, iso).length > 0, ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    // A day off with a note (#261) reads as excused, not as a plan that went by.
    const dot = done ? ' done' : dayNoteOf(S, iso) ? ' noted' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} {...tappable(() => dayOverrideSheet(iso))}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${wkStart.getDate()} ${wkStart.toLocaleDateString(dateLocale(), { month: 'short' })} – ${wkEnd.getDate()} ${wkEnd.toLocaleDateString(dateLocale(), { month: 'short' })}`

  // A coach week (S.queue) read through the same tolerant reader QueueRow uses, so a malformed
  // queue from another client shows the weekday dots, never an empty card.
  const queue = queueView(S, todayISO())
  // This card shows one thing or the other — QueueRow for a live queue, or Rotation chosen with
  // nothing built yet (S.scheduleMode), in which case there is no queue for QueueRow to render and
  // an empty-state card takes its place. Plan does the same in rotation mode: no weekday grid, only
  // the days that add a routine the loop does not have (Plan.jsx, "Also on fixed days").
  const rotating = scheduleModeOf(S) === 'rotation'
  // A planner-written queue (no rotationId) still names its weekday when it hasn't started yet —
  // that copy predates rotation and stays as it is. Our own rotation has no weekday of its own
  // (lib/rotation.js): naming one here — including on the pass's own one-day empty gap (THE
  // ONE-DAY BOUNDARY, rotation.js) or before a first routine is even added — would be the
  // fixed-week model leaking into a schedule that was never weekday-based.
  const liveQ = queueOf(S)
  const plannerQueue = !!queue && !liveQ?.rotationId
  // Ownership, not mere presence of a rotationId: a stale id left over from a rebuilt rotation
  // would otherwise still read as "this app manages it" (lib/rotation.js).
  const managedQueue = !!liveQ && !!S.rotation && liveQ.rotationId === S.rotation.id
  // On a rest day, saying when you train next beats leaving the row as a full stop.
  const next = !S.active && !todayRoutines.length && !(rotating && !plannerQueue) ? nextTrainingDay(S, todayISO()) : null
  // The streak card's fraction: this calendar week's workouts over the weekdays with a plan, or,
  // in a coach week, the queue's sessions and your own days together (lib/queue.js weekTally).
  const { done: doneThisWeek, planned: plannedPerWeek } = weekTally(S, todayISO())
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: weighInAt(b), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (todayRoutines.length) startFlow(effectiveRoutineIds(S, todayISO())); else dayOverrideSheet(todayISO()) }
  // A chip on the coach week's progress row starts that one routine, in any order. A session
  // already in progress wins, as on the today row — starting another would overwrite it.
  const onQueueStart = id => { if (S.active) nav('/workout'); else startFlow([id]) }

  return <div className="narrow s-home" style={{ paddingBottom: 16 }}>
    <header className="home-heading">
      <div>
        <div className="k">{t('YOUR NEXT FORM STARTS HERE')}</div>
        <h1>{t('Today')}</h1>
        <p>{today.toLocaleDateString(dateLocale(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>
      <button className="ib" onClick={() => nav('/settings')} aria-label={t('Settings')}>
        <Icon name="gear" />
        {trouble && <span className="tab-dot" aria-hidden="true" />}
      </button>
    </header>

    <div className="g2" style={{ marginBottom: 24 }}>
      <div className="cd level-card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <span className="k">{t('Your level')}</span>
          <span className="st" aria-label={t('{0} day streak', streakDays)}><Icon name="flame" />{streakDays}</span>
        </div>
        <button className="level-summary" onClick={openCharacterSheet} aria-label={t('View character sheet')}>
          <strong>{t('Level {0}', levelInfo.level)}</strong>
          <span>{levelInfo.title}</span>
          <div className="progress-track"><span style={{ width: `${levelInfo.progressPct}%` }} /></div>
          <small>{levelInfo.xpIntoCurrentLevel} / {levelInfo.xpNeededForCurrentLevel} XP</small>
        </button>
        <button className="level-rank" onClick={openLeaderboard}><Icon name="trophy" />{t('Rankings')}<Icon name="chevronRight" /></button>
      </div>
      <div className="cd water-card">
        <div className="row between" style={{ marginBottom: 12 }}><span className="k">{t('Hydration')}</span><Icon name="drop" /></div>
        <strong className="water-value">{((todayNutrition.waterMl || 0) / 1000).toFixed(1)}<small> / {(waterTarget / 1000).toFixed(1)} L</small></strong>
        <div className="progress-track" style={{ marginTop: 14 }}><span style={{ width: `${Math.min(100, ((todayNutrition.waterMl || 0) / waterTarget) * 100)}%` }} /></div>
        <button className="water-add" onClick={() => { useNutrition.getState().addWater(todayStr, 250); useUI.getState().toast(t('+250 ml water logged')); }}><Icon name="plus" />{t('250 ml water')}</button>
      </div>
    </div>

    {/* MOV v3 Next Workout Hero Card */}
    <div
      className="cd row tappable hero-workout"
      style={{
        background: 'linear-gradient(160deg, #FF8A1F, #E8590C)',
        border: 0,
        color: '#0A0A0A',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        marginBottom: 14,
        padding: '16px 18px',
        boxShadow: 'none'
      }}
      {...tappable(() => S.active || doneToday || routine ? onToday() : nav('/workout'))}
    >
      <div>
        <div className="k" style={{ color: '#0A0A0A', fontWeight: 800, marginBottom: 2 }}>
          {S.active ? t('Workout in progress') : doneToday ? t('Workout complete') : routine ? t('Today’s training') : t('MAKE YOUR NEXT MOVE')}
        </div>
        <div style={{ fontFamily: 'var(--font-app)', fontWeight: 800, fontSize: 22, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#0A0A0A' }}>
          {S.active ? (editingSaved ? S.active.name : S.active.name) : doneToday ? (doneToday.name || t('Finished')) : (todayName || t('Choose your workout'))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0A0A0A', opacity: 0.8, marginTop: 4 }}>
          {routine ? tn('{0} exercise', '{0} exercises', todayRoutines.reduce((n, r) => n + r.ex.length, 0)) : doneToday ? t('Every session adds up.') : t('Start freestyle or pick a routine')}
        </div>
      </div>
      <div className="ico" style={{ background: '#0A0A0A', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={S.active ? 'play' : doneToday ? 'check' : 'arrowRight'} style={{ color: '#FF6A13', fontSize: 18 }} />
      </div>
    </div>

    <details className="home-quests">
      <summary><span>{t("Daily quests")}</span><span className="quest-count">{dailyQuests.filter(q => q.completed).length} / {dailyQuests.length} {t("complete")} <Icon name="chevronDown" /></span></summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
      {dailyQuests.map((q, idx) => {
        const iconBg = idx === 0 ? '#FFB3472e' : idx === 1 ? '#5EA8FF2e' : '#FF6A132e';
        const iconColor = idx === 0 ? '#FFB347' : idx === 1 ? '#5EA8FF' : '#FF6A13';
        return (
          <div key={q.id} className="rw" style={{ margin: 0 }}>
            <div className="ico" style={{ background: iconBg, width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={q.completed ? 'checkCircle' : idx === 0 ? 'utensils' : idx === 1 ? 'drop' : 'dumbbell'} style={{ color: iconColor, fontSize: 18 }} />
            </div>
            <div>
              <b style={{ color: 'var(--label)', fontSize: 14, textDecoration: q.completed ? 'line-through' : 'none', opacity: q.completed ? 0.75 : 1 }}>
                {q.title}
              </b>
              <div className="mu" style={{ fontSize: 12 }}>
                {q.completed ? t('Completed') : idx === 0 ? t('Fuel up') : idx === 1 ? t('Stay hydrated') : todayName || t('Build your momentum')}
              </div>
            </div>
            <div className="pill" style={{ background: q.completed ? '#5EA8FF' : '#FF6A13', color: '#0A0A0A', fontWeight: 800 }}>
              {q.completed ? 'DONE' : `+${q.xp} XP`}
            </div>
          </div>
        );
      })}
    </div>

    </details>

    <div className="card">
      {/* A coach week runs by order, not by weekday, so its progress row stands in for the
          seven dots (components/QueueRow.jsx). The today row below stays as it is: the queue's
          next session reaches it through effectiveRoutineIds like any planned routine. */}
      {rotating ? (queue ? <QueueRow S={S} today={todayISO()} onStart={onQueueStart} managed={managedQueue} /> : <div className="empty">
        {t('No rotation yet. Add routines to it in Plan.')}
        <div style={{ marginTop: 10 }}><Button size="sm" variant="tinted" onClick={() => nav('/plan')}>{t('Set up in Plan')}</Button></div>
      </div>) : <>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
          <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
          <button className="textbtn small muted" style={{ fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: '2px 6px' }} onClick={weeklySummarySheet}>
            {wkLabel} · <span style={{ color: 'var(--acc)' }}>{t('Summary')}</span>
          </button>
          <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
        </div>
        <div className="week">{strip}</div>
      </>}
      {/* Once today's session is logged the row stops asking for it. The week strip already
          knew (its dot goes 'done'); this row did not, so a finished day kept showing the
          routine name behind a green Start tag and read as still outstanding (issue #4).
          An in-progress session still wins — that one is happening right now. Tapping the
          row keeps working, so a second session in one day is a tap away, just not urged. */}
      <div className="today-row" {...tappable(onToday)}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : doneToday ? 'var(--surface-3)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? (editingSaved ? 'pencil' : 'play') : doneToday ? 'checkCircle' : routine ? glyphOf(routine.emoji) : 'moon'}
              style={doneToday && !S.active ? { color: 'var(--green)' } : undefined} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? (editingSaved ? S.active.name : t('{0} (in progress)', S.active.name))
              : doneToday ? (doneToday.name ? t('{0} (done)', doneToday.name) : t('Workout done'))
              : routine ? todayName : t('Rest day')}{todayOvr && routine && !doneToday ? ' · ' + t('rescheduled') : ''}</div>
            {next && !doneToday && <div className="ss">{t('Next session: {0}, {1}', t(DAYN[next.weekday]), next.routine.name)}</div>}
          </div>
        </div>
        {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'color-mix(in srgb,var(--orange) 16%,transparent)' }}>{editingSaved ? t('Edit') : t('Resume')}</span>
          : doneToday ? <span className="tag" style={{ color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)' }}>{t('Done')}</span>
          : routine ? <span className="row" style={{ gap: 8 }}><MiniBodyMap routines={todayRoutines} body={S.body} /><span className="tag acc">{t('Start')}</span></span>
          : <Icon name="plus" className="chev" />}
      </div>
      {/* The row above starts today's plan in one tap, and so does the Start button in the tab
          bar — which is the whole problem when you want something else. Both jump straight into
          the planned session whenever there is one, so the Start screen (a freestyle session,
          and your other routines) is only reachable on a day with nothing planned. The one other
          way in, "Choose a different workout" on the weigh-in sheet, does not exist when the
          weigh-in is switched off. This is that door, and it starts nothing on its own. */}
      {!S.active && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <Button size="sm" variant="ghost" className="dim" icon="swap" onClick={() => nav('/workout')}>
          {t('Choose a different workout')}
        </Button>
      </div>}
      <SeasonDeco spot="home-hero" />
    </div>

    {/* Jump to the gym check-in cards (QR membership codes). Shown here as a quick tap on
        arrival at the gym; folds away per user via the "Gym check-in" switch in Settings. */}
    {S.checkIn !== false && (
      <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => nav('/checkin'))}>
        <div className="row between">
          <div className="row" style={{ gap: 9 }}>
            <span className="lrow-i" style={{ background: 'var(--blue)' }}><Icon name="qr" /></span>
            <div>
              <div className="lbl2">{t('At the gym')}</div>
              <div className="ttl">{t('Check in')}</div>
            </div>
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      </div>
    )}

    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="calendar" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going, or grab a ready-made starter plan.')}</div>
        <Button variant="primary" icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    {/* Nutrition & Calorie Card */}
    <div className="card nutrition-card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="lrow-i" style={{ background: 'var(--acc)', color: 'var(--on-acc)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="utensils" style={{ fontSize: 15 }} />
          </span>
          <h2 style={{ margin: 0 }}>{t('Nutrition')}</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="plus" onClick={() => openSheet(close => <FoodSearchSheet date={todayStr} close={close} />)}>{t('Log')}</Button>
          <Button size="sm" variant="ghost" onClick={weeklySummarySheet}>{t('Summary')}</Button>
          <Button size="sm" variant="ghost" onClick={() => nav('/food')}>{t('Diary')}</Button>
        </div>
      </div>

      <div className="row between" style={{ alignItems: 'baseline', marginTop: 4 }}>
        <div className="big" style={{ fontSize: 26, fontWeight: 700 }}>
          {remainingKcal >= 0 ? remainingKcal : Math.abs(remainingKcal)}
          <span className="small muted" style={{ fontSize: 13, fontWeight: 500, marginInlineStart: 5 }}>
            {remainingKcal >= 0 ? t('kcal remaining') : t('kcal over')}
          </span>
        </div>
        <span className="small muted">{nutritionTotals.calories} / {calTarget} kcal</span>
      </div>

      <div style={{ width: '100%', height: 8, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden', margin: '8px 0 12px' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, Math.round((nutritionTotals.calories / calTarget) * 100))}%`,
          background: remainingKcal >= 0 ? 'var(--acc)' : 'var(--orange)',
          borderRadius: 4
        }} />
      </div>

      <div className="row between small" style={{ background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 'var(--r-sm)' }}>
        <div><span style={{ color: 'var(--blue)', fontWeight: 600 }}>P:</span> {nutritionTotals.protein} / {protTarget}g</div>
        <div><span style={{ color: 'var(--orange)', fontWeight: 600 }}>C:</span> {nutritionTotals.carbs} / {carbTarget}g</div>
        <div><span style={{ color: 'var(--yellow)', fontWeight: 600 }}>F:</span> {nutritionTotals.fat} / {fatTarget}g</div>
        <div><span style={{ color: 'var(--teal)', fontWeight: 600 }}><Icon name="drop" style={{ fontSize: 12, verticalAlign: 'middle' }} /></span> {todayNutrition.waterMl || 0}ml</div>
      </div>
    </div>

    {S.showWeightCard !== false && <div className="card">
      <div className="row between bw-head" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginInlineStart: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
        {/* the weekly rate and, with one set, how it sits in its corridor (#759) */}
        <WeightRate S={S} />
        {/* every weigh-in, week by week with its average (Discord 'Weight') */}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={weighInsSheet}>{t('All weigh-ins')}</Button>
        </div>
      </> : <div className="muted small">{S.weighIn === false
        ? t('No weigh-ins yet. Log your weight to start the curve.')
        : t("No weigh-ins yet. Log your weight to start the curve (we also ask before every workout).")}</div>}
    </div>}

    <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => calendarSheet())}>
      <SeasonDeco spot="home-streak" />
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--orange)' }} />
            {t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{doneThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {tn('{0} workout total', '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}


export function HomeMenu({ close }) {
  const nav = useNavigate()
  const openSheet = useUI(s => s.openSheet)
  const go = path => { close(); nav(path) }
  const show = Component => { close(); openSheet(done => <Component close={done} />) }
  return <div className="simple-menu">
    <div className="simple-sheet-header"><h3>{t('More')}</h3><button className="iconbtn" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button></div>
    <details className="menu-training"><summary><span className="menu-category-icon"><Icon name="questTraining" /></span><span>{t('Training')}<small>{t('Routines, exercises & schedule')}</small></span><Icon name="chevronDown" /></summary>
      <Row title={t('My workout plan')} accessory="chevron" onClick={() => go('/plan')} />
      <Row title={t('Exercise library')} accessory="chevron" onClick={() => go('/library')} />
      <Row title={t('Explore muscles')} accessory="chevron" onClick={() => go('/muscles')} />
      <Row title={t('Gym check-in')} accessory="chevron" onClick={() => go('/checkin')} />
    </details>
    <details className="menu-progress"><summary><span className="menu-category-icon"><Icon name="gameProgress" /></span><span>{t('Progress')}<small>{t('Your activity & body insights')}</small></span><Icon name="chevronDown" /></summary>
      <Row title={t('Statistics')} accessory="chevron" onClick={() => go('/stats')} />
      <Row title={t('Workout history')} accessory="chevron" onClick={() => go('/history')} />
      <Row title={t('Log body weight')} onClick={() => { close(); bwSheet() }} />
      <Row title={t('Body measurements')} accessory="chevron" onClick={() => go('/measurements')} />
      <Row title={t('Progress photos')} accessory="chevron" onClick={() => go('/progress-photos')} />
      <Row title={t('Structural balance')} accessory="chevron" onClick={() => go('/structural-balance')} />
      <Row title={t('Weekly summary')} onClick={() => { close(); weeklySummarySheet() }} />
    </details>
    <details className="menu-rewards"><summary><span className="menu-category-icon"><Icon name="trophy" /></span><span>{t('Rewards & goals')}<small>{t('Milestones, rankings & more')}</small></span><Icon name="chevronDown" /></summary>
      <Row title={t('Character, badges & forms')} onClick={() => show(CharacterSheetModal)} />
      <Row title={t('Rankings')} onClick={() => show(LeaderboardModal)} />
      <Row title={t('Daily quests & detailed overview')} accessory="chevron" onClick={() => go('/overview')} />
      <Row title={t('Weight goal')} onClick={() => { close(); goalSheet() }} />
    </details>
    <Row icon="gear" title={t('Settings & account')} accessory="chevron" onClick={() => go('/settings')} />
  </div>
}

export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const days = useNutrition(s => s.days)
  const addWater = useNutrition(s => s.addWater)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)
  const today = todayISO()
  const day = days[today] || { entries: [], waterMl: 0 }
  const totals = computeDayTotals(day.entries || [])
  const targets = getActiveTargets(S)
  const routines = effectiveRoutines(S, today)
  const hasTodayWorkout = routines.some(r => r.ex.length > 0)
  const chooseWorkout = !hasTodayWorkout && S.routines.some(r => r.ex.length > 0)
  const firstWorkout = needsFirstWorkout(S)
  const logWater = amount => { addWater(today, amount); toast(t('{0} ml water added', amount)) }
  const plannedWorkoutName = routines.map(r => r.name).join(' + ')
  const next = nextTrainingDay(S, today)
  const nextName = next?.routines.map(r => r.name).join(' + ')
  const isRestDay = S.dayPlan[today] === 'rest' || (!plannedWorkoutName && !!next)
  const planTitle = S.active?.name || plannedWorkoutName || (firstWorkout ? t('Your first workout') : isRestDay ? t('Rest day') : t('Your workout'))
  const loggedToday = (S.workouts || []).filter(workout => workout.d === today)
  const queued = queueOf(S)?.ids || []
  const plannedDone = routines.every(routine => !queued.includes(routine.id) && loggedToday.some(workout => (Array.isArray(workout.routineIds) ? workout.routineIds : [workout.routineId]).includes(routine.id)))
  const completed = !S.active && plannedDone ? loggedToday.at(-1) : null
  const recovery = isRestDay && !S.active && !completed
  const artwork = S.active || completed || (hasTodayWorkout ? routines : isRestDay ? { name: 'Recovery' } : null)
  const workoutName = S.active?.name || (completed ? t('You showed up.') : isRestDay ? t('Reset. Recharge.') : hasTodayWorkout ? t('Find your strong.') : t('Make your next move.'))
  const exerciseCount = S.active || completed ? ((S.active || completed).entries || []).length : routines.reduce((count, routine) => count + routine.ex.length, 0)
  const register = async () => { const { RegisterSheet } = await import('./Login.jsx'); openSheet(close => <RegisterSheet close={close} />) }
  return <div className="simple-home home-refined">
    <div className="home-app-bar"><Brand /><PlayerBadge /></div>
    <header className="simple-home-header"><div><p>{user?.name ? t('Good to see you, {0}', user.name) : t('Your workout plan')}</p><h1 className="home-plan-title">{planTitle}<span>.</span></h1></div></header>
    {next && !S.active && <button className="home-next-session" onClick={() => nav('/plan')} aria-label={t('Next workout: {0}, {1}', nextName, t(DAYN[next.weekday]))}><span>{t('Next up')}</span><b>{nextName}</b><small>{t(DAYN[next.weekday])}</small><Icon name="arrowRight" /></button>}
    <div className="daily-grid">
      <section className={'daily-action daily-workout' + (completed ? ' is-complete' : '')} style={workoutArtStyle(artwork)}>
        <div className="workout-photo" aria-hidden="true" />
        <div className="daily-action-heading"><span className="daily-icon"><Icon name={completed ? 'check' : recovery ? 'sparkles' : 'questTraining'} /></span><h2>{completed ? t('Logged today') : recovery ? t('Recovery is part of progress') : t('Your training')}</h2>{S.active && <span className="session-badge"><i />{t('In progress')}</span>}</div>
        <div className="daily-workout-copy"><h3>{firstWorkout && !completed ? t('Your first move.') : workoutName}</h3><p>{S.active ? t('Pick up where you left off.') : completed ? t('{0} is in the books. Every session adds up.', completed.name || t('Your workout')) : isRestDay ? t('A lighter day today. Your next session is already lined up.') : hasTodayWorkout ? t('Your plan is ready. One set at a time.') : t('Three simple moves. No gym experience needed.')}</p></div>
        <div className="workout-card-meta"><span><Icon name={completed ? 'check' : 'dumbbell'} />{exerciseCount ? tn('{0} exercise', '{0} exercises', exerciseCount) : completed ? t('Workout saved') : recovery ? t('Move at your own pace') : firstWorkout ? t('3 moves · No equipment') : t('A fresh start, whenever you’re ready')}</span></div>
        <Button variant="primary" trailingIcon="arrowRight" onClick={() => completed ? workoutDetailSheet(completed) : S.active || chooseWorkout ? nav('/workout') : firstWorkout ? firstWorkoutSheet() : startFlow(hasTodayWorkout ? effectiveRoutineIds(S, today) : [])}>{S.active ? t('Resume workout') : completed ? t('View workout') : chooseWorkout ? t('Choose workout') : t('Start workout')}</Button>
        {!S.active && !completed && <button className="home-quick-exercise" onClick={() => quickExerciseSheet()}>{t('Log an exercise')}<Icon name="plus" /></button>}
      </section>
      <section className="daily-action daily-water">
        <div className="daily-action-heading"><span className="daily-icon"><Icon name="questWater" /></span><h2>{t('Water')}</h2></div>
        <div className="daily-metric-row"><div><div className="daily-total" key={day.waterMl}>{((day.waterMl || 0) / 1000).toFixed(2).replace(/0$/, '')}<small> L</small></div><p className="daily-target">{t('of {0} L today', (targets.waterMl / 1000).toFixed(1))}</p></div><WaterGlass value={day.waterMl} target={targets.waterMl} /></div>
        <div className="home-goal-track water-goal" role="progressbar" aria-label={t('Daily water goal')} aria-valuemin={0} aria-valuemax={targets.waterMl} aria-valuenow={Math.min(day.waterMl || 0, targets.waterMl)}><span style={{ width: `${Math.min(100, ((day.waterMl || 0) / targets.waterMl) * 100)}%` }} /></div>
        <div className="daily-buttons"><Button variant="secondary" onClick={() => logWater(250)}>{t('+ 250 ml')}</Button><Button variant="secondary" onClick={() => logWater(500)}>{t('+ 500 ml')}</Button></div>
      </section>
      <section className="daily-action daily-calories">
        <div className="daily-action-heading"><span className="daily-icon"><Icon name="questFuel" /></span><h2>{t('Calories')}</h2><button onClick={() => nav('/food')}>{t('Diary')}<Icon name="chevronRight" /></button></div>
        <div className="daily-metric-row"><div><div className="daily-total">{Math.round(totals.calories).toLocaleString()}<small> kcal</small></div><p className="daily-target">{t('of {0} kcal today', targets.dailyCalories.toLocaleString())}</p></div><ProgressRing value={totals.calories} target={targets.dailyCalories}><Icon name="utensils" /></ProgressRing></div>
        <div className="home-goal-track" role="progressbar" aria-label={t('Daily calorie goal')} aria-valuemin={0} aria-valuemax={targets.dailyCalories} aria-valuenow={Math.min(totals.calories, targets.dailyCalories)}><span style={{ width: `${Math.min(100, (totals.calories / targets.dailyCalories) * 100)}%` }} /></div>
        <Button variant="secondary" icon="plus" onClick={() => openSheet(close => <FoodSearchSheet date={today} close={close} />)}>{t('Log food')}</Button>
      </section>
    </div>
    {!user && <section className="home-profile-card"><Icon name="bolt" /><div><h2>{t('Make your progress yours.')}</h2><p>{t('Create a profile to save your workouts and daily wins.')}</p></div><Button variant="primary" trailingIcon="arrowRight" onClick={register}>{t('Create profile')}</Button></section>}
  </div>
}
