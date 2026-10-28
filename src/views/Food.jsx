import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../store/useNutrition.js'
import { computeDayTotals, getLocalDateString } from '../lib/nutrition/totals.js'
import { FoodSearchSheet } from '../components/FoodSearchSheet.jsx'
import { CustomFoodSheet } from '../components/CustomFoodSheet.jsx'
import { RecipeSheet } from '../components/RecipeSheet.jsx'
import { PortionEditSheet } from '../components/PortionEditSheet.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { t, dateLocale } from '../lib/i18n.js'

export default function Food() {
  const S = useStore(s => s.S)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)

  const days = useNutrition(s => s.days)
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
  const calorieTarget = S.targets?.dailyCalories || 2000
  const proteinTarget = S.targets?.proteinGrams || 150
  const carbTarget = S.targets?.carbsGrams || 200
  const fatTarget = S.targets?.fatGrams || 65
  const waterTarget = S.targets?.waterMl || 3000

  const remainingCalories = calorieTarget - totals.calories
  const caloriePct = Math.min(100, Math.round((totals.calories / calorieTarget) * 100))

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
          updateEntryPortion(selectedDate, entry.id, entry, updated.qty, updated.unit)
          toast(t('Portion updated'))
        }}
        onDelete={() => {
          deleteFood(selectedDate, entry.id)
          toast(t('Food deleted'), {
            action: t('Undo'),
            onAction: () => logFood(selectedDate, entry.meal, entry, entry.qty, entry.unit)
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
    // Stub ready for Milestone 3 barcode camera integration
    toast(t('Barcode scanner ready for Milestone 3! Use Food Search in the meantime.'))
  }

  // Meals grouping
  const mealSections = [
    { key: 'breakfast', title: t('Breakfast'), icon: 'sunrise' },
    { key: 'lunch', title: t('Lunch'), icon: 'sun' },
    { key: 'dinner', title: t('Dinner'), icon: 'moon' },
    { key: 'snacks', title: t('Snacks'), icon: 'sparkles' }
  ]

  return (
    <div className="narrow food-view">
      {/* Header with Date Navigator */}
      <div className="hdr">
        <div>
          <h1>{t('Nutrition')}</h1>
          <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 2 }}>
            <button
              className="iconbtn"
              style={{ width: 28, height: 28, fontSize: 13 }}
              onClick={() => shiftDate(-1)}
              aria-label={t('Previous day')}
            >
              <Icon name="chevronLeft" />
            </button>

            <span className="sub" style={{ fontWeight: 600 }}>{formattedDate}</span>

            <button
              className="iconbtn"
              style={{ width: 28, height: 28, fontSize: 13 }}
              onClick={() => shiftDate(1)}
              aria-label={t('Next day')}
            >
              <Icon name="chevronRight" />
            </button>

            {!isToday && (
              <Button size="xs" variant="tinted" onClick={() => setSelectedDate(todayStr)}>
                {t('Today')}
              </Button>
            )}
          </div>
        </div>

        <div className="hdr-actions" style={{ display: 'flex', gap: 6 }}>
          <button className="iconbtn" onClick={handleOpenRecipes} aria-label={t('Recipes')} title={t('Recipes')}>
            <Icon name="clipboard" />
          </button>
          <button className="iconbtn" onClick={handleOpenCustom} aria-label={t('Custom Food')} title={t('Custom Food')}>
            <Icon name="plus" />
          </button>
        </div>
      </div>

      {/* Main Calories & Macros Summary Card */}
      <div className="card">
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 8 }}>
          <div>
            <div className="lbl2">{t('Calories')}</div>
            <div className="big" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {remainingCalories >= 0 ? remainingCalories : Math.abs(remainingCalories)}
              <span className="small muted" style={{ fontSize: 14, fontWeight: 500, marginInlineStart: 6 }}>
                {remainingCalories >= 0 ? t('remaining') : t('over target')}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="small muted">{t('{0} / {1} kcal', totals.calories, calorieTarget)}</span>
          </div>
        </div>

        {/* Calorie Progress Bar */}
        <div style={{
          width: '100%',
          height: 10,
          background: 'var(--surface-3)',
          borderRadius: 5,
          overflow: 'hidden',
          marginBottom: 16
        }}>
          <div style={{
            height: '100%',
            width: `${caloriePct}%`,
            background: remainingCalories >= 0 ? 'var(--acc)' : 'var(--orange)',
            borderRadius: 5,
            transition: 'width 200ms ease'
          }} />
        </div>

        {/* 3 Macro Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {/* Protein */}
          <div style={{ background: 'var(--surface-2)', padding: '10px 8px', borderRadius: 'var(--r-sm)' }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--blue)' }}>{t('Protein')}</span>
              <span className="small muted">{totals.protein}g</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.round((totals.protein / proteinTarget) * 100))}%`,
                background: 'var(--blue)',
                borderRadius: 3
              }} />
            </div>
            <div className="dim small" style={{ marginTop: 4, fontSize: 11 }}>{t('Target: {0}g', proteinTarget)}</div>
          </div>

          {/* Carbs */}
          <div style={{ background: 'var(--surface-2)', padding: '10px 8px', borderRadius: 'var(--r-sm)' }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--orange)' }}>{t('Carbs')}</span>
              <span className="small muted">{totals.carbs}g</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.round((totals.carbs / carbTarget) * 100))}%`,
                background: 'var(--orange)',
                borderRadius: 3
              }} />
            </div>
            <div className="dim small" style={{ marginTop: 4, fontSize: 11 }}>{t('Target: {0}g', carbTarget)}</div>
          </div>

          {/* Fat */}
          <div style={{ background: 'var(--surface-2)', padding: '10px 8px', borderRadius: 'var(--r-sm)' }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="small" style={{ fontWeight: 600, color: 'var(--yellow)' }}>{t('Fat')}</span>
              <span className="small muted">{totals.fat}g</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.round((totals.fat / fatTarget) * 100))}%`,
                background: 'var(--yellow)',
                borderRadius: 3
              }} />
            </div>
            <div className="dim small" style={{ marginTop: 4, fontSize: 11 }}>{t('Target: {0}g', fatTarget)}</div>
          </div>
        </div>
      </div>

      {/* Quick Water Tracker Card */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="lrow-i" style={{ background: 'var(--teal)', color: '#000', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="drop" style={{ fontSize: 16 }} />
            </span>
            <span style={{ fontWeight: 600 }}>{t('Water Intake')}</span>
          </div>
          <span className="small muted">{dayData.waterMl || 0} / {waterTarget} ml</span>
        </div>

        {/* Water fill bar */}
        <div style={{
          width: '100%',
          height: 8,
          background: 'var(--surface-3)',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 10
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.round(((dayData.waterMl || 0) / waterTarget) * 100))}%`,
            background: 'var(--teal)',
            borderRadius: 4,
            transition: 'width 200ms ease'
          }} />
        </div>

        {/* Quick Water Buttons */}
        <div className="row between" style={{ gap: 6 }}>
          <Button size="xs" variant="ghost" onClick={() => addWater(selectedDate, -250)}>
            -250 ml
          </Button>
          <Button size="xs" variant="tinted" onClick={() => addWater(selectedDate, 250)}>
            +250 ml
          </Button>
          <Button size="xs" variant="tinted" onClick={() => addWater(selectedDate, 500)}>
            +500 ml
          </Button>
          <Button size="xs" variant="tinted" onClick={() => addWater(selectedDate, 1000)}>
            +1 L
          </Button>
        </div>
      </div>

      {/* Meals Diary */}
      {mealSections.map(({ key, title, icon }) => {
        const mealEntries = (dayData.entries || []).filter(e => e.meal === key)
        const mealCalories = mealEntries.reduce((sum, e) => sum + (e.nutrients?.calories || 0), 0)
        const mealProtein = Math.round(mealEntries.reduce((sum, e) => sum + (e.nutrients?.protein || 0), 0) * 10) / 10

        return (
          <div key={key} className="card" style={{ marginBottom: 12 }}>
            <div className="row between" style={{ marginBottom: mealEntries.length ? 10 : 4 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span className="lrow-i" style={{ background: 'var(--surface-3)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    style={{
                      padding: '8px 10px',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenPortionEdit(entry)}
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
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.nutrients?.calories || 0} kcal</div>
                      <div className="small muted" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <span style={{ color: 'var(--blue)' }}>P:{entry.nutrients?.protein || 0}</span>
                        <span style={{ color: 'var(--orange)' }}>C:{entry.nutrients?.carbs || 0}</span>
                        <span style={{ color: 'var(--yellow)' }}>F:{entry.nutrients?.fat || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small muted" style={{ padding: '6px 2px' }}>
                {t('No food logged yet.')}
              </div>
            )}
          </div>
        )
      })}

      {/* Quick Action Buttons */}
      <div className="row" style={{ gap: 8, marginTop: 4, marginBottom: 20 }}>
        <Button size="sm" variant="tinted" icon="barcode" onClick={handleOpenBarcodeScanner} style={{ flex: 1 }}>
          {t('Scan Barcode')}
        </Button>
        <Button size="sm" variant="tinted" icon="clipboard" onClick={handleOpenRecipes} style={{ flex: 1 }}>
          {t('Recipes')}
        </Button>
        <Button size="sm" variant="tinted" icon="plus" onClick={handleOpenCustom} style={{ flex: 1 }}>
          {t('Custom Food')}
        </Button>
      </div>
    </div>
  )
}
