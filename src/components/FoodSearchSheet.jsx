import { useState, useEffect, useRef, useMemo } from 'react'
import { useNutrition } from '../store/useNutrition.js'
import { useUI } from '../store/useUI.js'
import { scaleNutrients } from '../lib/nutrition/portions.js'
import { parseNaturalLanguageMeal } from '../lib/nutrition/parser.js'
import { api } from '../lib/api.js'
import { CustomFoodSheet } from './CustomFoodSheet.jsx'
import { BarcodeScannerModal } from './BarcodeScannerModal.jsx'
import { PhotoEstimateSheet } from './PhotoEstimateSheet.jsx'
import { Button, SearchField, NumberField, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'
import { MealQuickEntry } from './MealQuickEntry.jsx'
import { t } from '../lib/i18n.js'
import { pantrySearch } from '../../../shared/food-pantry.mjs'

export function FoodSearchSheet({ meal = 'lunch', date, close }) {
  const [tab, setTab] = useState('describe')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [qty, setQty] = useState(100)
  const [unit, setUnit] = useState('g')
  const [targetMeal, setTargetMeal] = useState(meal)
  const [quickFooter, setQuickFooter] = useState(null)
  const [quickReview, setQuickReview] = useState(false)

  const logFood = useNutrition(s => s.logFood)
  const favouriteFoods = useNutrition(s => s.favouriteFoods || [])
  const recentFoods = useNutrition(s => s.recentFoods || [])
  const customFoods = useNutrition(s => s.customFoods || [])
  const toggleFavorite = useNutrition(s => s.toggleFavorite)
  const openSheet = useUI(s => s.openSheet)
  const toast = useUI(s => s.toast)

  const debounceRef = useRef(null)

  // Debounced search
  useEffect(() => {
    let cancelled = false
    setSearchError(false)
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)

    debounceRef.current = setTimeout(async () => {
      try {
        // Natural language pre-parsing
        const parsed = parseNaturalLanguageMeal(query)
        const qToFetch = (parsed.qty && parsed.foodQuery) ? parsed.foodQuery : query
        const localFoods = pantrySearch(qToFetch)
        if (localFoods.length) {
          if (!cancelled) setResults(localFoods)
          return
        }
        const res = await api(`/api/food/search?q=${encodeURIComponent(qToFetch)}`)
        if (!cancelled) setResults(Array.isArray(res?.foods) ? res.foods : [])
      } catch (err) {
        if (!cancelled) { setResults([]); setSearchError(true) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // When a food is selected, initialize portion
  const handleSelectFood = (food) => {
    setSelectedFood(food)
    const parsed = parseNaturalLanguageMeal(query)
    const requestedAmount = tab === 'search' && /^\s*(?:\d|[½⅓⅔¼¾⅛⅜⅝⅞])/.test(query)
    const requestedPortion = food.portions?.find(p => p.label.toLowerCase() === parsed.unit || p.label.toLowerCase().startsWith(parsed.unit + ','))
    if (requestedAmount && ['g', 'oz', 'kg', 'lb'].includes(parsed.unit)) {
      const grams = parsed.unit === 'kg' ? parsed.qty * 1000 : parsed.unit === 'lb' ? parsed.qty * 453.592 : null
      setQty(grams ?? parsed.qty)
      setUnit(grams == null ? parsed.unit : 'g')
      return
    }
    if (requestedAmount && requestedPortion) {
      setQty(parsed.qty)
      setUnit(requestedPortion.label)
      return
    }
    // Default portion: if it has portions, pick the first non-100g or 100g
    if (food.portions && food.portions.length > 0) {
      const p = food.portions[0]
      setUnit(p.label)
      setQty(requestedAmount ? parsed.qty : 1)
    } else {
      setUnit('g')
      setQty(requestedAmount ? parsed.qty * 100 : 100)
    }
  }

  // Calculated nutrients for selected food
  const scaled = useMemo(() => {
    if (!selectedFood) return null
    return scaleNutrients(selectedFood, Number(qty) || 0, unit)
  }, [selectedFood, qty, unit])

  const handleLog = () => {
    if (!selectedFood) return
    logFood(date, targetMeal, selectedFood, Number(qty) || 1, unit)
    toast(t('Added {0} to {1}!', selectedFood.name, targetMeal))
    close()
  }

  const handleOpenCustomFood = () => {
    openSheet(closeCustom => (
      <CustomFoodSheet
        onSaved={food => {
          handleSelectFood(food)
        }}
        close={closeCustom}
      />
    ))
  }

  const handleOpenBarcode = () => {
    openSheet(closeBc => (
      <BarcodeScannerModal
        meal={targetMeal}
        date={date}
        onFoodLogged={() => close()}
        close={closeBc}
      />
    ))
  }

  const handleOpenPhoto = () => {
    openSheet(closePhoto => (
      <PhotoEstimateSheet
        meal={targetMeal}
        date={date}
        close={closePhoto}
      />
    ))
  }

  const mealOptions = [
    { value: 'breakfast', label: t('Breakfast') },
    { value: 'lunch', label: t('Lunch') },
    { value: 'dinner', label: t('Dinner') },
    { value: 'snacks', label: t('Snacks') }
  ]

  const tabOptions = [
    { value: 'search', label: t('Search') },
    { value: 'recents', label: t('Recents') },
    { value: 'favorites', label: t('Favorites') },
    { value: 'custom', label: t('Custom') }
  ]

  // Render food item row
  const renderFoodRow = (food) => {
    const isFav = favouriteFoods.includes(food.key)
    const isSelected = selectedFood?.key === food.key
    const nutrients = food.per100g || food.serving?.nutrients || food.nutrients || {}

    return (
      <div
        key={food.key}
        className={`food-result-row tappable ${isSelected ? 'selected' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: isSelected ? 'var(--surface-3)' : 'var(--surface-2)',
          borderRadius: 'var(--r-sm)',
          cursor: 'pointer',
          marginBottom: 6,
          border: isSelected ? '1px solid var(--acc)' : '1px solid transparent'
        }}
        onClick={() => handleSelectFood(food)}
      >
        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {food.name}
          </div>
          <div className="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
            {food.brand && <span style={{ color: 'var(--label-2)' }}>{food.brand}</span>}
            <span>{nutrients.kcal ?? nutrients.calories ?? 0} kcal {food.per100g ? t('/ 100 g') : t('/ serving')}</span>
            <span style={{ color: 'var(--blue)' }}>P: {nutrients.proteinG ?? nutrients.protein ?? 0}g</span>
            <span style={{ color: 'var(--orange)' }}>C: {nutrients.carbsG ?? nutrients.carbs ?? 0}g</span>
            <span style={{ color: 'var(--yellow)' }}>F: {nutrients.fatG ?? nutrients.fat ?? 0}g</span>
          </div>
        </div>

        <button
          className="iconbtn"
          style={{ width: 32, height: 32, fontSize: 16, color: isFav ? 'var(--yellow)' : 'var(--label-3)' }}
          onClick={(e) => {
            e.stopPropagation()
            toggleFavorite(food.key)
          }}
          aria-label={t('Toggle Favorite')}
        >
          <Icon name={isFav ? 'starFill' : 'star'} />
        </button>
      </div>
    )
  }

  // Active list based on tab
  let displayList = []
  if (tab === 'search') {
    displayList = results
  } else if (tab === 'recents') {
    displayList = recentFoods
  } else if (tab === 'favorites') {
    displayList = recentFoods.filter(f => favouriteFoods.includes(f.key))
  } else if (tab === 'custom') {
    displayList = customFoods
  }

  return (
    <div className="food-search-sheet kb-lift" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '82vh', gap: 12 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{t('Add Food')}</h3>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
      </div>

      <Segmented options={[{ value: 'describe', label: t('Quick entry'), icon: 'sparkles' }, { value: 'search', label: t('Find food'), icon: 'magnifier' }]} value={tab === 'describe' ? 'describe' : 'search'} onChange={setTab} />

      {tab !== 'describe' && <>
        <SearchField
          placeholder={t('Search foods, e.g. eggs or oats')}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedFood(null); setTab('search') }}
          onClear={() => { setQuery(''); setSelectedFood(null) }}
          autoFocus
        />
        <label className="simple-select">{t('Your foods')}<select className="field" value={tab} onChange={e => { setTab(e.target.value); setSelectedFood(null) }}>{tabOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </>}

      {/* Selected Food Portion Configuration Panel */}
      {tab !== 'describe' && selectedFood && scaled && (
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-sm)',
          padding: 12,
          border: '1px solid var(--acc)'
        }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 600 }}>{selectedFood.name}</div>
            <div className="big" style={{ fontSize: 18, fontWeight: 700 }}>
              {scaled.nutrients.kcal} <span className="small muted">kcal</span>
            </div>
          </div>

          <div className="row between small" style={{ marginBottom: 10 }}>
            <span><b style={{ color: 'var(--blue)' }}>P:</b> {scaled.nutrients.proteinG}g</span>
            <span><b style={{ color: 'var(--orange)' }}>C:</b> {scaled.nutrients.carbsG}g</span>
            <span><b style={{ color: 'var(--yellow)' }}>F:</b> {scaled.nutrients.fatG}g</span>
            <span className="dim">{scaled.weightGrams}g</span>
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="lbl2 small" style={{ marginBottom: 2, display: 'block' }}>{t('Amount')}</label>
              <NumberField value={qty} onChange={setQty} decimal={true} />
            </div>

            <div style={{ flex: 2 }}>
              <label className="lbl2 small" style={{ marginBottom: 2, display: 'block' }}>{t('Serving / Unit')}</label>
              <select
                className="field"
                style={{ height: 44, width: '100%', background: 'var(--surface-3)', color: 'var(--label)', borderRadius: 'var(--r-sm)', padding: '0 8px' }}
                value={unit}
                onChange={e => setUnit(e.target.value)}
              >
                <option value="g">Grams (g)</option>
                <option value="oz">Ounces (oz)</option>
                {(selectedFood.portions || []).map((p, idx) => (
                  <option key={idx} value={p.label}>{p.label} ({p.grams}g)</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label className="lbl2 small" style={{ marginBottom: 4, display: 'block' }}>{t('Meal')}</label>
            <Segmented options={mealOptions} value={targetMeal} onChange={setTargetMeal} />
          </div>

          <Button variant="primary" icon="check" onClick={handleLog} disabled={!Number.isFinite(Number(qty)) || Number(qty) <= 0}>
            {t('Log to {0}', targetMeal)}
          </Button>
        </div>
      )}

      {/* Results / List area */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 100 }}>
        <MealQuickEntry active={tab === 'describe'} date={date} meal={targetMeal} onMealChange={setTargetMeal} close={close} onFindFood={() => setTab('search')} footerTarget={quickFooter} onReviewChange={setQuickReview} />
        {tab !== 'describe' && (
          <>
            {loading && (
              <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>
                {t('Searching foods...')}
              </div>
            )}

            {!loading && displayList.length > 0 && (
              <div>{displayList.map(renderFoodRow)}</div>
            )}

            {!loading && displayList.length === 0 && (
              <div className="empty" style={{ padding: '30px 10px', textAlign: 'center' }}>
                <div className="muted small" style={{ marginBottom: 10 }}>
                  {searchError && tab === 'search' ? t('Food search is unavailable. Try again, or create a food below.') : tab === 'search'
                    ? (query ? t('No matching foods found.') : t('Type a food name or amount (e.g. "2 bananas", "oats").'))
                    : t('No items in this category yet.')}
                </div>
                <Button size="sm" variant="tinted" icon="plus" onClick={handleOpenCustomFood}>
                  {t('Create Custom Food')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div ref={setQuickFooter} className="meal-quick-footer" hidden={tab !== 'describe'} />
      {(!quickReview || tab !== 'describe') && <details className="simple-filters food-entry-alternatives">
        <summary>{t('Other ways to log food')}<Icon name="chevronDown" /></summary>
        <div className="daily-buttons">
          <Button size="sm" variant="secondary" icon="barcode" onClick={handleOpenBarcode}>{t('Scan barcode')}</Button>
          <Button size="sm" variant="secondary" icon="camera" onClick={handleOpenPhoto}>{t('Photo estimate')}</Button>
        </div>
      </details>}
    </div>
  )
}
