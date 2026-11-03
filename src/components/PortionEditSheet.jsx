import { useState, useMemo } from 'react'
import { scaleNutrients, foodForEntry } from '../lib/nutrition/portions.js'
import { Button, NumberField, Segmented } from './ui.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export function PortionEditSheet({ entry, onSave, onDelete, close }) {
  const [qty, setQty] = useState(entry.qty || 1)
  const [unit, setUnit] = useState(entry.unit || 'g')
  const [meal, setMeal] = useState(entry.meal || 'lunch')

  const foodRef = useMemo(() => foodForEntry(entry), [entry])

  const scaled = useMemo(() => {
    return scaleNutrients(foodRef, Number(qty) || 0, unit)
  }, [foodRef, qty, unit])

  const handleSave = () => {
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) return
    onSave({
      foodRef,
      qty: Number(qty) || 1,
      unit,
      meal,
      weightGrams: scaled.weightGrams,
      nutrients: scaled.nutrients
    })
    close()
  }

  const handleDelete = () => {
    onDelete()
    close()
  }

  const mealOptions = [
    { value: 'breakfast', label: t('Breakfast') },
    { value: 'lunch', label: t('Lunch') },
    { value: 'dinner', label: t('Dinner') },
    { value: 'snacks', label: t('Snacks') }
  ]

  return (
    <div className="portion-edit-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <div>
          <h3 style={{ margin: 0 }}>{entry.name}</h3>
          {entry.brand && <div className="small muted">{entry.brand}</div>}
        </div>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
      </div>

      <div>
        <label className="lbl2" style={{ marginBottom: 6, display: 'block' }}>{t('Meal')}</label>
        <Segmented options={mealOptions} value={meal} onChange={setMeal} />
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Amount')}</label>
          <NumberField value={qty} onChange={setQty} decimal={true} autoFocus aria-label={t('Amount')} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Unit')}</label>
          <div style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-sm)',
            fontWeight: 500
          }}>
            {unit}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 12 }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="muted">{t('Calculated')}</span>
          <span className="big" style={{ fontSize: 18, fontWeight: 700 }}>
            {scaled.nutrients.kcal} <span className="small muted">kcal</span>
          </span>
        </div>
        <div className="row between small">
          <span><b style={{ color: 'var(--blue)' }}>P:</b> {scaled.nutrients.proteinG}g</span>
          <span><b style={{ color: 'var(--orange)' }}>C:</b> {scaled.nutrients.carbsG}g</span>
          <span><b style={{ color: 'var(--yellow)' }}>F:</b> {scaled.nutrients.fatG}g</span>
          <span className="dim">{scaled.weightGrams}g</span>
        </div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 6 }}>
        <Button variant="danger" icon="trash" onClick={handleDelete} style={{ flex: 1 }}>
          {t('Delete')}
        </Button>
        <Button variant="primary" icon="check" onClick={handleSave} disabled={!Number.isFinite(Number(qty)) || Number(qty) <= 0} style={{ flex: 2 }}>
          {t('Save Changes')}
        </Button>
      </div>
    </div>
  )
}
