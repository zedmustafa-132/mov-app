import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../store/useNutrition.js'
import { computeDayTotals, getLocalDateString } from '../lib/nutrition/totals.js'
import { FoodSearchSheet } from '../components/FoodSearchSheet.jsx'
import { CustomFoodSheet } from '../components/CustomFoodSheet.jsx'
import { RecipeSheet } from '../components/RecipeSheet.jsx'
import { PortionEditSheet } from '../components/PortionEditSheet.jsx'
import { BarcodeScannerModal } from '../components/BarcodeScannerModal.jsx'
import { PhotoEstimateSheet } from '../components/PhotoEstimateSheet.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { ProgressRing } from '../components/DailyVisuals.jsx'
import { t, dateLocale } from '../lib/i18n.js'
import { getActiveTargets } from '../lib/targets.js'
import { foodForEntry } from '../lib/nutrition/portions.js'

export default function Food() {
  const S = useStore(s => s.S)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)

  const days = useNutrition(s => s.days)
  const nutritionAccount = useNutrition(s => s.accountId)
  const nutritionSync = useNutrition(s => s.syncStatus)
  const selectedDate = useNutrition(s => s.selectedDate || getLocalDateString())
  const setSelectedDate = useNutrition(s => s.setSelectedDate)
  const deleteFood = useNutrition(s => s.deleteFood)
  const updateEntryPortion = useNutrition(s => s.updateEntryPortion)
  const addWater = useNutrition(s => s.addWater)
  const logFood = useNutrition(s => s.logFood)

  const todayStr = getLocalDateString()
  const isToday = selectedDate === todayStr

  // Current day data
  const dayData = useMemo(() => {
    return days[selectedDate] || { entries: [], waterMl: 0 }
  }, [days, selectedDate])

  // Aggregate totals
  const totals = useMemo(() => {
    return computeDayTotals(dayData.entries || [])
  }, [dayData.entries])

  // User nutrition targets (from Onboarding Plan Engine or defaults)
  const activeTargets = getActiveTargets(S)
  const calorieTarget = activeTargets.dailyCalories
  const proteinTarget = activeTargets.proteinGrams
  const carbTarget = activeTargets.carbsGrams
  const fatTarget = activeTargets.fatGrams
  const waterTarget = activeTargets.waterMl

  const remainingCalories = calorieTarget - totals.calories

  // Date navigation helpers
  const shiftDate = (deltaDays) => {
    const parts = selectedDate.split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    d.setDate(d.getDate() + deltaDays)
    setSelectedDate(getLocalDateString(d))
  }

  const formattedDate = useMemo(() => {
    const parts = selectedDate.split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    if (isToday) return t('Today')
    return d.toLocaleDateString(dateLocale(), { weekday: 'short', month: 'short', day: 'numeric' })
  }, [selectedDate, isToday])

  // Open sheets
  const handleOpenSearch = (mealType) => {
    openSheet(close => (
      <FoodSearchSheet
        meal={mealType}
        date={selectedDate}
        close={close}
      />
    ))
  }

  const handleOpenPortionEdit = (entry) => {
    openSheet(close => (
      <PortionEditSheet
        entry={entry}
        onSave={updated => {
          updateEntryPortion(selectedDate, entry.id, updated.foodRef, updated.qty, updated.unit, updated.meal)
          toast(t('Portion updated'))
        }}
        onDelete={() => {
          deleteFood(selectedDate, entry.id)
          toast(t('Food deleted'), {
            action: t('Undo'),
            onAction: () => logFood(selectedDate, entry.meal, foodForEntry(entry), entry.qty, entry.unit)
          })
        }}
        close={close}
      />
    ))
  }

  const handleOpenCustom = () => {
    openSheet(close => <CustomFoodSheet close={close} />)
  }

  const handleOpenRecipes = () => {
    openSheet(close => <RecipeSheet date={selectedDate} close={close} />)
  }

  const handleOpenBarcodeScanner = () => {
    openSheet(close => (
      <BarcodeScannerModal
        meal="lunch"
        date={selectedDate}
        close={close}
      />
    ))
  }

  const handleOpenPhotoEstimator = () => {
    openSheet(close => (
      <PhotoEstimateSheet
        meal="lunch"
        date={selectedDate}
        close={close}
      />
    ))
  }

  // Meals grouping
  const mealSections = [
    { key: 'breakfast', title: t('Breakfast'), icon: 'sunrise' },
    { key: 'lunch', title: t('Lunch'), icon: 'sun' },
    { key: 'dinner', title: t('Dinner'), icon: 'moon' },
    { key: 'snacks', title: t('Snacks'), icon: 'sparkles' }
  ]

  // Calculate 5 days centered on selectedDate
  const daysWindow = useMemo(() => {
    const parts = selectedDate.split('-').map(Number);
    const center = new Date(parts[0], parts[1] - 1, parts[2]);
    const arr = [];
    for (let i = -2; i <= 2; i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      const iso = getLocalDateString(d);
      const dayName = d.toLocaleDateString(dateLocale(), { weekday: 'short' });
      const dayNum = d.getDate();
      arr.push({ iso, dayName, dayNum, isSelected: iso === selectedDate });
    }
    return arr;
  }, [selectedDate]);

  const protPct = Math.min(100, Math.round((totals.protein / proteinTarget) * 100));
  const carbPct = Math.min(100, Math.round((totals.carbs / carbTarget) * 100));
  const fatPct = Math.min(100, Math.round((totals.fat / fatTarget) * 100));

  return (
    <div className="narrow food-view s-food" style={{ paddingBottom: 24 }}>
      <header className="food-header">
        <div><h1>{t('Food diary')}</h1><p>{formattedDate} · {t('Fuel your next move.')}</p></div>
        <div className="food-header-actions">
          <button className="ib" onClick={handleOpenBarcodeScanner} aria-label={t('Barcode Scanner')}><Icon name="barcode" /></button>
          <button className="ib" onClick={handleOpenPhotoEstimator} aria-label={t('Photo Estimate')}><Icon name="camera" /></button>
        </div>
      </header>
      {nutritionAccount && nutritionSync?.error && <p className="small muted" role="status">{t(nutritionSync.error)} <button className="meal-text-button" onClick={() => useNutrition.getState().syncNow({ refresh: true })}>{t('Retry sync')}</button></p>}
      <label className="simple-date">{t('Date')}<input type="date" className="field" aria-label={t('Diary date')} value={selectedDate} onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }} /></label>
      <section className="card diary-nutrition" aria-label={t('Daily nutrition')}>
        <div className="calorie-heading">
          <div><div className="k">{remainingCalories >= 0 ? t('Calories remaining') : t('Above your target')}</div>
            <strong>{Math.abs(remainingCalories).toLocaleString()} <small>kcal</small></strong>
            <div className="calorie-total">{t('{0} eaten', totals.calories.toLocaleString())} <span> / {calorieTarget.toLocaleString()} kcal</span></div>
          </div>
          <ProgressRing label={t('Daily calories')} value={totals.calories} target={calorieTarget}><Icon name="questFuel" /></ProgressRing>
        </div>
        <details className="simple-macros"><summary>{t("Nutrition details")}<Icon name="chevronDown" /></summary><div className="macro-grid">
          {[
            { label: t('Protein'), value: totals.protein, target: proteinTarget, pct: protPct, color: 'var(--orange)' },
            { label: t('Carbs'), value: totals.carbs, target: carbTarget, pct: carbPct, color: 'var(--amber)' },
            { label: t('Fat'), value: totals.fat, target: fatTarget, pct: fatPct, color: 'var(--blue)' }
          ].map(m => <div key={m.label}>
            <div className="macro-label">{m.label}</div>
            <div className="macro-value">{Math.round(m.value)}<small> / {m.target} g</small></div>
            <div className="progress-track" role="progressbar" aria-label={m.label} aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={Math.min(m.target, m.value)}><span style={{ width: `${m.pct}%`, background: m.color }} /></div>
          </div>)}
        </div>
        </details>
      </section>

      {/* Meals Diary */}
      {mealSections.map(({ key, title, icon }) => {
        const mealEntries = (dayData.entries || []).filter(e => e.meal === key)
        const mealTotals = computeDayTotals(mealEntries)
        const mealCalories = mealTotals.kcal
        const mealProtein = mealTotals.proteinG

        return (
          <div key={key} className="card meal-card" style={{ marginBottom: 12 }}>
            <div className="row between" style={{ marginBottom: mealEntries.length ? 10 : 4 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span className={`meal-icon meal-icon-${key}`}>
                  <Icon name={icon} style={{ fontSize: 15 }} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
                  {mealCalories > 0 && (
                    <div className="small muted">
                      {mealCalories} kcal · <span style={{ color: 'var(--blue)' }}>{mealProtein}g protein</span>
                    </div>
                  )}
                </div>
              </div>

              <Button size="xs" variant="tinted" icon="plus" onClick={() => handleOpenSearch(key)}>
                {t('Add')}
              </Button>
            </div>

            {/* List of items in meal */}
            {mealEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mealEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="row between tappable"
                    role="button"
                    tabIndex={0}
                    aria-label={t('Edit {0}', entry.name)}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenPortionEdit(entry)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleOpenPortionEdit(entry) } }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.name}
                      </div>
                      <div className="small muted" style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <span>{entry.qty} {entry.unit}</span>
                        {entry.brand && <span className="dim">({entry.brand})</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.nutrients?.kcal ?? entry.nutrients?.calories ?? 0} kcal</div>
                      <div className="small muted" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <span style={{ color: 'var(--blue)' }}>P:{entry.nutrients?.proteinG ?? entry.nutrients?.protein ?? 0}</span>
                        <span style={{ color: 'var(--orange)' }}>C:{entry.nutrients?.carbsG ?? entry.nutrients?.carbs ?? 0}</span>
                        <span style={{ color: 'var(--yellow)' }}>F:{entry.nutrients?.fatG ?? entry.nutrients?.fat ?? 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              null
            )}
          </div>
        )
      })}

      <section className="card diary-water">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="row"><Icon name="questWater" /><h2 style={{ margin: 0 }}>{t('Water')}</h2></div>
          <span className="small muted">{((dayData.waterMl || 0) / 1000).toFixed(2).replace(/0$/, '')} / {(waterTarget / 1000).toFixed(1)} L</span>
        </div>
        <div className="progress-track"><span style={{ width: `${Math.min(100, ((dayData.waterMl || 0) / waterTarget) * 100)}%`, background: 'var(--blue)' }} /></div>
        <div className="row" style={{ marginTop: 14 }}>
          <Button size="sm" variant="tinted" icon="plus" onClick={() => addWater(selectedDate, 250)}>{t('250 ml')}</Button>
          <Button size="sm" variant="tinted" icon="plus" onClick={() => addWater(selectedDate, 500)}>{t('500 ml')}</Button>
        </div>
      </section>

      {/* Quick Action Buttons */}
      <details className="food-more">
        <summary>{t("More food tools")} <Icon name="chevronDown" /></summary>
      <div className="food-tools">
        <Button size="sm" variant="tinted" icon="barcode" onClick={handleOpenBarcodeScanner} style={{ flex: 1 }}>
          {t('Barcode')}
        </Button>
        <Button size="sm" variant="tinted" icon="camera" onClick={handleOpenPhotoEstimator} style={{ flex: 1 }}>
          {t('Photo')}
        </Button>
        <Button size="sm" variant="tinted" icon="clipboard" onClick={handleOpenRecipes} style={{ flex: 1 }}>
          {t('Recipes')}
        </Button>
        <Button size="sm" variant="tinted" icon="plus" onClick={handleOpenCustom} style={{ flex: 1 }}>
          {t('Custom')}
        </Button>
      </div>
      </details>
    </div>
  )
}
