// WeeklySummaryModal.jsx — Non-AI deterministic weekly progress synthesis for NXT FORM
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useNutrition } from '../store/useNutrition.js'
import { useGamification } from '../lib/gamification/useGamification.js'
import { calculateWeeklySummary, getWeekRange } from '../lib/weekly-summary.js'
import { fmtNum, fmtDate, fmtVol, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export function WeeklySummaryModal({ close }) {
  const S = useStore(s => s.S)
  const nutritionDays = useNutrition(s => s.days)
  const { levelInfo, streakDays } = useGamification()
  const [weekOffset, setWeekOffset] = useState(0)

  // Calculate reference date based on weekOffset (7 days per offset)
  const today = new Date()
  const refDate = new Date(today.getTime() + weekOffset * 7 * 86400000)
  const refIso = refDate.toISOString().slice(0, 10)

  const summary = calculateWeeklySummary({
    workouts: S.workouts || [],
    nutritionDays: nutritionDays || {},
    bodyweight: S.bodyweight || [],
    targets: S.targets || {},
    weekStart: S.weekStart ?? 1,
    referenceDate: refIso,
    streak: streakDays,
    levelInfo
  })

  const { startIso, endIso, days } = summary.weekRange
  const calTarget = summary.calorieTarget
  const protTarget = summary.proteinTarget
  const carbTarget = summary.carbTarget
  const fatTarget = summary.fatTarget

  const DAY_LABELS = [t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat'), t('Sun')]

  return (
    <div className="sheet-content" style={{ maxHeight: '85vh', overflowY: 'auto', paddingBottom: 20 }}>
      {/* Header */}
      <div className="row between" style={{ alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{t('Weekly Summary')}</h2>
          <div className="small muted">
            {fmtDate(startIso, true)} – {fmtDate(endIso, true)}
          </div>
        </div>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}>
          <Icon name="xmark" />
        </button>
      </div>

      {/* Week Navigator */}
      <div className="row between" style={{
        background: 'var(--surface-2)',
        padding: '6px 10px',
        borderRadius: 'var(--r-sm)',
        marginBottom: 14,
        alignItems: 'center'
      }}>
        <button
          className="iconbtn sm"
          onClick={() => setWeekOffset(o => o - 1)}
          aria-label={t('Previous week')}
        >
          <Icon name="chevronLeft" />
        </button>
        <span className="small" style={{ fontWeight: 600 }}>
          {weekOffset === 0 ? t('Current Week') : weekOffset === -1 ? t('Last Week') : t('{0} weeks ago', Math.abs(weekOffset))}
        </span>
        <button
          className="iconbtn sm"
          disabled={weekOffset === 0}
          onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
          aria-label={t('Next week')}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      {/* Overview 4-KPI Grid */}
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        <div className="tile" style={{ padding: '10px 12px' }}>
          <div className="l"><Icon name="utensils" />{t('Nutrition')}</div>
          <div className="v" style={{ fontSize: 20 }}>
            {summary.daysLoggedCount} <span className="small muted">/ 7 {t('days')}</span>
          </div>
        </div>

        <div className="tile" style={{ padding: '10px 12px' }}>
          <div className="l"><Icon name="dumbbell" />{t('Workouts')}</div>
          <div className="v" style={{ fontSize: 20 }}>
            {summary.workoutsCompleted} <span className="small muted">{t('sessions')}</span>
          </div>
        </div>

        <div className="tile" style={{ padding: '10px 12px' }}>
          <div className="l"><Icon name="scale" />{t('Weight Delta')}</div>
          <div className="v" style={{ fontSize: 20, color: summary.weightDelta != null ? 'var(--acc)' : 'inherit' }}>
            {summary.weightDelta != null
              ? (summary.weightDelta > 0 ? '+' : '') + fmtNum(summary.weightDelta) + ' ' + S.unit
              : '–'}
          </div>
        </div>

        <div className="tile" style={{ padding: '10px 12px' }}>
          <div className="l"><Icon name="drop" />{t('Hydration')}</div>
          <div className="v" style={{ fontSize: 20 }}>
            {summary.waterDaysMet} <span className="small muted">/ 7 {t('days')}</span>
          </div>
        </div>
      </div>

      {/* Nutrition Details Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--acc)' }}><Icon name="utensils" /></span>
            <h3 style={{ margin: 0, fontSize: 16 }}>{t('Nutrition Averages')}</h3>
          </div>
          <span className="small dim">
            {summary.daysLoggedCount > 0
              ? t('on {0} logged days', summary.daysLoggedCount)
              : t('no days logged')}
          </span>
        </div>

        {summary.daysLoggedCount > 0 ? (
          <>
            <div className="row between" style={{ alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {fmtNum(summary.avgCalories)} <span className="small muted">/ {calTarget} kcal</span>
              </div>
              <span className="tag" style={{
                color: Math.abs(summary.calorieDeltaPct) <= 5 ? 'var(--green)' : 'var(--orange)',
                background: Math.abs(summary.calorieDeltaPct) <= 5
                  ? 'color-mix(in srgb,var(--green) 12%,transparent)'
                  : 'color-mix(in srgb,var(--orange) 12%,transparent)'
              }}>
                {summary.calorieDelta > 0 ? '+' : ''}{summary.calorieDelta} kcal ({summary.calorieDeltaPct > 0 ? '+' : ''}{summary.calorieDeltaPct}%)
              </span>
            </div>

            {/* Macro Pillars */}
            <div className="row between small" style={{
              background: 'var(--surface-2)',
              padding: '8px 12px',
              borderRadius: 'var(--r-sm)',
              marginTop: 8
            }}>
              <div>
                <span style={{ color: 'var(--blue)', fontWeight: 600 }}>P:</span> {summary.avgProtein} / {protTarget}g
              </div>
              <div>
                <span style={{ color: 'var(--orange)', fontWeight: 600 }}>C:</span> {summary.avgCarbs} / {carbTarget}g
              </div>
              <div>
                <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>F:</span> {summary.avgFat} / {fatTarget}g
              </div>
            </div>

            {/* 7-Day Day Strip */}
            <div style={{ marginTop: 10 }}>
              <div className="small muted" style={{ marginBottom: 6, fontWeight: 500 }}>{t('Day-by-Day Calorie Logging')}:</div>
              <div className="row between" style={{ gap: 4 }}>
                {summary.nutritionDays.map((nd, idx) => (
                  <div key={nd.date} style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 2px',
                    borderRadius: 4,
                    background: nd.logged ? 'color-mix(in srgb,var(--acc) 12%,transparent)' : 'var(--surface-2)',
                    border: nd.logged ? '1px solid color-mix(in srgb,var(--acc) 30%,transparent)' : '1px dashed var(--sep)'
                  }}>
                    <div className="dim" style={{ fontSize: 10, fontWeight: 600 }}>{DAY_LABELS[idx] || nd.date.slice(8)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: nd.logged ? 'var(--text)' : 'var(--label-3)', marginTop: 2 }}>
                      {nd.logged ? nd.calories : '–'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="muted small" style={{ padding: '8px 0' }}>
            {t('No food entries logged during this week. Log meals in the Food tab to unlock weekly nutrition insights.')}
          </div>
        )}
      </div>

      {/* Workouts Details Card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--orange)' }}><Icon name="dumbbell" /></span>
            <h3 style={{ margin: 0, fontSize: 16 }}>{t('Gym & Training')}</h3>
          </div>
          <span className="small dim">{summary.workoutsCompleted} {t('sessions')}</span>
        </div>

        {summary.workoutsCompleted > 0 ? (
          <div className="row between small" style={{
            background: 'var(--surface-2)',
            padding: '8px 12px',
            borderRadius: 'var(--r-sm)'
          }}>
            <div>
              <span className="muted">{t('Volume Lifted')}: </span>
              <strong>{fmtVol(summary.totalVolumeKg, S.unit)}</strong>
            </div>
            <div>
              <span className="muted">{t('Working Sets')}: </span>
              <strong>{summary.totalSets}</strong>
            </div>
          </div>
        ) : (
          <div className="muted small" style={{ padding: '8px 0' }}>
            {t('No gym workouts logged this week. Consistent resistance training stimulates muscle retention and progression.')}
          </div>
        )}
      </div>

      {/* Bodyweight & Fluctuations Callout */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--yellow)' }}><Icon name="scale" /></span>
            <h3 style={{ margin: 0, fontSize: 16 }}>{t('Body Weight Trend')}</h3>
          </div>
          <span className="small dim">{summary.weighInCount} {t('weigh-ins')}</span>
        </div>

        {summary.weighInCount > 0 ? (
          <div className="row between small" style={{ marginBottom: 8 }}>
            <div>{t('Start')}: <strong>{fmtNum(summary.startWeight)} {S.unit}</strong></div>
            <div>{t('Latest')}: <strong>{fmtNum(summary.endWeight)} {S.unit}</strong></div>
            <div>{t('Change')}: <strong style={{ color: 'var(--acc)' }}>{summary.weightDelta != null ? (summary.weightDelta > 0 ? '+' : '') + fmtNum(summary.weightDelta) + ' ' + S.unit : '–'}</strong></div>
          </div>
        ) : (
          <div className="muted small" style={{ marginBottom: 8 }}>
            {t('No weigh-ins logged this week.')}
          </div>
        )}

        {/* Short-term weight fluctuation disclaimer */}
        <div className="small" style={{
          background: 'color-mix(in srgb,var(--blue) 8%,transparent)',
          borderLeft: '3px solid var(--blue)',
          padding: '8px 10px',
          borderRadius: '0 var(--r-sm) var(--r-sm) 0',
          color: 'var(--text-2)',
          lineHeight: 1.4
        }}>
          <strong>{t('Understanding Weight Trends')}:</strong> {t(summary.weightDisclaimer)}
        </div>
      </div>

      {/* Coach Insights (Deterministic Rules) */}
      <div className="card">
        <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: 'var(--acc)' }}><Icon name="lightbulb" /></span>
          <h3 style={{ margin: 0, fontSize: 16 }}>{t('Coach Observations')}</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {summary.insights.map((ins, i) => {
            const isPos = ins.type === 'positive'
            const isWarn = ins.type === 'warning'
            const borderCol = isPos ? 'var(--green)' : isWarn ? 'var(--orange)' : 'var(--blue)'
            const bgCol = isPos
              ? 'color-mix(in srgb,var(--green) 8%,transparent)'
              : isWarn
              ? 'color-mix(in srgb,var(--orange) 8%,transparent)'
              : 'color-mix(in srgb,var(--blue) 8%,transparent)'

            return (
              <div key={i} style={{
                background: bgCol,
                borderLeft: `3px solid ${borderCol}`,
                padding: '8px 10px',
                borderRadius: '0 var(--r-sm) var(--r-sm) 0'
              }}>
                <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 3 }}>
                  <Icon
                    name={isPos ? 'checkCircle' : isWarn ? 'warning' : 'info'}
                    style={{ color: borderCol, fontSize: 14 }}
                  />
                  <strong style={{ fontSize: 13 }}>{ins.title}</strong>
                </div>
                <div className="small dim" style={{ lineHeight: 1.4 }}>
                  {ins.text}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
        <Button variant="primary" onClick={close} style={{ width: '100%' }}>{t('Done')}</Button>
      </div>
    </div>
  )
}

export const weeklySummarySheet = () => useUI.getState().openSheet(close => <WeeklySummaryModal close={close} />)
