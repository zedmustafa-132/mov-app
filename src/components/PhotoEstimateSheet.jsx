import { useState, useRef } from 'react'
import { api } from '../lib/api.js'
import { useUI } from '../store/useUI.js'
import { useNutrition } from '../store/useNutrition.js'
import { Button, TextField, NumberField, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export function PhotoEstimateSheet({ meal = 'lunch', date, close }) {
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [hint, setHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimation, setEstimation] = useState(null)
  const [items, setItems] = useState([])
  const [targetMeal, setTargetMeal] = useState(meal)

  const fileInputRef = useRef(null)
  const logFood = useNutrition(s => s.logFood)
  const toast = useUI(s => s.toast)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result
      setImagePreview(url)
      setImageBase64(typeof url === 'string' ? url.split(',')[1] : null)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const res = await api('/api/food/estimate-photo', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: imageBase64 || '',
          mimeType: 'image/jpeg',
          hint: hint.trim()
        })
      })

      if (res && Array.isArray(res.items)) {
        setEstimation(res)
        setItems(res.items)
      } else {
        toast(t('Could not analyze photo. Please try again or describe meal in text.'))
      }
    } catch (err) {
      toast(t('Analysis failed: {0}', err.message || 'Network error'))
    } finally {
      setLoading(false)
    }
  }

  // Calculate live totals for the confirmed items
  const totals = items.reduce(
    (acc, it) => {
      acc.calories += it.nutrients?.calories || 0
      acc.protein += it.nutrients?.protein || 0
      acc.carbs += it.nutrients?.carbs || 0
      acc.fat += it.nutrients?.fat || 0
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const handleUpdateItemQty = (id, newQty) => {
    setItems(current =>
      current.map(it => {
        if (it.id !== id) return it
        const factor = (Number(newQty) || 1) / (it.qty || 1)
        return {
          ...it,
          qty: Number(newQty) || 1,
          nutrients: {
            ...it.nutrients,
            calories: Math.round((it.nutrients?.calories || 0) * factor),
            protein: Math.round((it.nutrients?.protein || 0) * factor * 10) / 10,
            carbs: Math.round((it.nutrients?.carbs || 0) * factor * 10) / 10,
            fat: Math.round((it.nutrients?.fat || 0) * factor * 10) / 10
          }
        }
      })
    )
  }

  const handleRemoveItem = (id) => {
    setItems(current => current.filter(it => it.id !== id))
  }

  const handleConfirmAndLog = () => {
    if (items.length === 0) {
      toast(t('No items to log'))
      return
    }

    for (const item of items) {
      const foodItem = {
        key: item.foodKey || `photo_${Date.now()}_${item.id}`,
        name: item.name,
        source: 'photo_estimate',
        nutrients: item.nutrients,
        portions: [{ label: item.unit, grams: item.weightGrams || 100 }]
      }
      logFood(date, targetMeal, foodItem, item.qty, item.unit)
    }

    toast(t('Logged {0} items from photo estimate to {1}!', items.length, targetMeal))
    close()
  }

  const mealOptions = [
    { value: 'breakfast', label: t('Breakfast') },
    { value: 'lunch', label: t('Lunch') },
    { value: 'dinner', label: t('Dinner') },
    { value: 'snacks', label: t('Snacks') }
  ]

  return (
    <div className="photo-estimate-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="lrow-i" style={{ background: 'var(--teal)', color: '#000', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" style={{ fontSize: 16 }} />
          </span>
          <h3 style={{ margin: 0 }}>{t('Photo Nutrition Estimate')}</h3>
        </div>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
      </div>

      {/* Safety Notice / Disclaimer */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--surface-2)',
        color: 'var(--label-2)',
        borderRadius: 'var(--r-sm)',
        fontSize: 13,
        lineHeight: 1.4
      }}>
        <Icon name="sparkles" style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
        {t('Photo preview: this feature currently uses sample estimates, not image recognition. Review every food and portion before saving.')}
      </div>

      {/* Before analysis: Upload and preview */}
      {!estimation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
              <img src={imagePreview} alt="Meal preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                className="iconbtn"
                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                onClick={() => { setImagePreview(null); setImageBase64(null) }}
              >
                <Icon name="trash" />
              </button>
            </div>
          ) : (
            <div
              className="tappable"
              style={{
                height: 160,
                border: '2px dashed var(--sep)',
                borderRadius: 'var(--r-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="camera" style={{ fontSize: 32, color: 'var(--label-3)' }} />
              <span className="small muted">{t('Take photo or choose from library')}</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div>
            <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Optional Hint')}</label>
            <TextField
              placeholder={t('e.g. Grilled salmon, brown rice bowl')}
              value={hint}
              onChange={e => setHint(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            icon="sparkles"
            onClick={handleAnalyze}
            disabled={!imagePreview && !hint.trim() || loading}
          >
            {loading ? t('Analyzing Photo...') : t('Analyze Meal')}
          </Button>
        </div>
      )}

      {/* After analysis: Review and Confirmation View */}
      {estimation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div>
              <div className="lbl2">{t('Detected Meal')}</div>
              <div style={{ fontWeight: 600, fontSize: 17 }}>{estimation.mealName}</div>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setEstimation(null)}>
              {t('New Photo')}
            </Button>
          </div>

          <div>
            <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Log to Meal')}</label>
            <Segmented options={mealOptions} value={targetMeal} onChange={setTargetMeal} />
          </div>

          {/* Items breakdown list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="lbl2">{t('Estimated Items ({0})', items.length)}</div>
            {items.map(it => (
              <div
                key={it.id}
                style={{
                  background: 'var(--surface-2)',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div className="row between">
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{it.name}</div>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span className="tag small" style={{ color: 'var(--teal)', background: 'color-mix(in srgb,var(--teal) 16%,transparent)' }}>
                      {Math.round((it.confidence || 0.9) * 100)}% match
                    </span>
                    <button
                      className="iconbtn"
                      style={{ color: 'var(--red)', width: 28, height: 28 }}
                      onClick={() => handleRemoveItem(it.id)}
                      aria-label={t('Remove')}
                    >
                      <Icon name="xmark" />
                    </button>
                  </div>
                </div>

                <div className="row between" style={{ alignItems: 'center' }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <NumberField
                      value={it.qty}
                      onChange={v => handleUpdateItemQty(it.id, v)}
                      style={{ width: 64, height: 34, textAlign: 'center' }}
                    />
                    <span className="small muted">{it.unit}</span>
                  </div>

                  <div className="small muted" style={{ display: 'flex', gap: 6 }}>
                    <b>{it.nutrients?.calories || 0} kcal</b>
                    <span style={{ color: 'var(--blue)' }}>P:{it.nutrients?.protein || 0}g</span>
                    <span style={{ color: 'var(--orange)' }}>C:{it.nutrients?.carbs || 0}g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Aggregated Nutrition Box */}
          <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--acc)' }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span className="muted">{t('Confirmed Totals')}</span>
              <span className="big" style={{ fontSize: 18, fontWeight: 700 }}>
                {totals.calories} <span className="small muted">kcal</span>
              </span>
            </div>
            <div className="row between small">
              <span><b style={{ color: 'var(--blue)' }}>Protein:</b> {Math.round(totals.protein * 10) / 10}g</span>
              <span><b style={{ color: 'var(--orange)' }}>Carbs:</b> {Math.round(totals.carbs * 10) / 10}g</span>
              <span><b style={{ color: 'var(--yellow)' }}>Fat:</b> {Math.round(totals.fat * 10) / 10}g</span>
            </div>
          </div>

          <Button variant="primary" icon="check" onClick={handleConfirmAndLog}>
            {t('Confirm & Log to {0}', targetMeal)}
          </Button>
        </div>
      )}
    </div>
  )
}
