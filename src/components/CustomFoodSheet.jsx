import { useState } from 'react'
import { useNutrition } from '../store/useNutrition.js'
import { useUI } from '../store/useUI.js'
import { Button, TextField, NumberField } from './ui.jsx'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export function CustomFoodSheet({ initial, onSaved, close }) {
  const saveCustomFood = useNutrition(s => s.saveCustomFood)
  const toast = useUI(s => s.toast)

  const [name, setName] = useState(initial?.name || '')
  const [brand, setBrand] = useState(initial?.brand || '')
  const [servingSize, setServingSize] = useState(initial?.servingSize || 100)
  const [servingUnit, setServingUnit] = useState(initial?.servingUnit || 'g')
  const [calories, setCalories] = useState(initial?.nutrients?.calories ?? 150)
  const [protein, setProtein] = useState(initial?.nutrients?.protein ?? 20)
  const [carbs, setCarbs] = useState(initial?.nutrients?.carbs ?? 10)
  const [fat, setFat] = useState(initial?.nutrients?.fat ?? 3)
  const [fiber, setFiber] = useState(initial?.nutrients?.fiber ?? 0)

  const handleSave = () => {
    if (!name.trim()) {
      toast(t('Please enter a food name'))
      return
    }

    const foodKey = initial?.key || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const isPer100g = servingUnit.toLowerCase() === 'g' && Number(servingSize) === 100

    // Compute standard nutrients per 100g for portion scaling
    const factor = isPer100g ? 1 : 100 / (Number(servingSize) || 100)
    const per100g = {
      calories: Math.round(Number(calories) * factor),
      protein: Math.round(Number(protein) * factor * 10) / 10,
      carbs: Math.round(Number(carbs) * factor * 10) / 10,
      fat: Math.round(Number(fat) * factor * 10) / 10,
      fiber: Math.round(Number(fiber) * factor * 10) / 10
    }

    const food = {
      key: foodKey,
      name: name.trim(),
      brand: brand.trim() || null,
      source: 'custom',
      nutrients: per100g,
      portions: [
        { label: '100g', grams: 100 },
        ...(isPer100g ? [] : [{
          label: `1 ${servingUnit} (${servingSize}g)`,
          grams: Number(servingSize) || 100
        }])
      ]
    }

    saveCustomFood(food)
    toast(t('Custom food saved!'))
    if (onSaved) onSaved(food)
    close()
  }

  return (
    <div className="custom-food-sheet kb-lift" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <h3>{initial ? t('Edit Custom Food') : t('Create Custom Food')}</h3>
        <button className="iconbtn" onClick={close} aria-label={t('Close')}><Icon name="xmark" /></button>
      </div>

      <div>
        <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Food Name *')}</label>
        <TextField
          placeholder={t('e.g. Whey Protein Isolate')}
          aria-label={t('Food name')}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Brand / Maker (optional)')}</label>
        <TextField
          placeholder={t('e.g. Optimum Nutrition')}
          aria-label={t('Brand (optional)')}
          value={brand}
          onChange={e => setBrand(e.target.value)}
        />
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Serving Size')}</label>
          <NumberField
            value={servingSize}
            aria-label={t('Serving size')}
            onChange={setServingSize}
            decimal={false}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="lbl2" style={{ marginBottom: 4, display: 'block' }}>{t('Unit')}</label>
          <TextField
            value={servingUnit}
            aria-label={t('Serving unit')}
            onChange={e => setServingUnit(e.target.value)}
            placeholder="g, scoop, bar"
          />
        </div>
      </div>

      <div style={{ borderTop: 'var(--hair) solid var(--sep)', paddingTop: 10 }}>
        <div className="lbl2" style={{ marginBottom: 8 }}>{t('Nutrients per Serving')}</div>
        <div className="nutrient-fields">
          <div>
            <span className="small muted">{t('Calories (kcal)')}</span>
            <NumberField value={calories} onChange={setCalories} decimal={false} aria-label={t('Calories (kcal)')} />
          </div>
          <div>
            <span className="small muted" style={{ color: 'var(--blue)' }}>{t('Protein (g)')}</span>
            <NumberField value={protein} onChange={setProtein} decimal={true} aria-label={t('Protein (g)')} />
          </div>
          <div>
            <span className="small muted" style={{ color: 'var(--orange)' }}>{t('Carbs (g)')}</span>
            <NumberField value={carbs} onChange={setCarbs} decimal={true} aria-label={t('Carbs (g)')} />
          </div>
          <div>
            <span className="small muted" style={{ color: 'var(--yellow)' }}>{t('Fat (g)')}</span>
            <NumberField value={fat} onChange={setFat} decimal={true} aria-label={t('Fat (g)')} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Button variant="primary" icon="check" onClick={handleSave} disabled={!name.trim()}>
          {t('Save Food')}
        </Button>
      </div>
    </div>
  )
}
