import { describe, it, expect } from 'vitest'
import { scaleNutrients } from './portions.js'
import { parseLocalQuantity } from './parser.js'
import { calculateRecipeTotals, recipeToFood } from './recipes.js'
import { calculateNutrientSum, calculateDayDashboard, getLocalDateString } from './totals.js'

describe('Nutrition Core — portions.js', () => {
  const eggFood = {
    key: 'usda:egg',
    name: 'Egg, whole, raw, fresh',
    basis: 'per100g',
    per100g: { kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 },
    portions: [
      { label: 'large', grams: 50 },
      { label: 'medium', grams: 44 }
    ]
  }

  it('scales nutrients accurately by grams', () => {
    // 200g should be exactly 2x per100g
    const res = scaleNutrients(eggFood, 200, 'g')
    expect(res.weightGrams).toBe(200)
    expect(res.nutrients.kcal).toBe(286)
    expect(res.nutrients.proteinG).toBe(25.2)
    expect(res.nutrients.fatG).toBe(19)
  })

  it('scales custom portions (e.g. 2 large eggs = 100g)', () => {
    const res = scaleNutrients(eggFood, 2, 'large')
    expect(res.weightGrams).toBe(100)
    expect(res.nutrients.kcal).toBe(143)
    expect(res.nutrients.proteinG).toBe(12.6)
  })

  it('handles zero quantity safely', () => {
    const res = scaleNutrients(eggFood, 0, 'g')
    expect(res.nutrients.kcal).toBe(0)
    expect(res.weightGrams).toBe(0)
  })
})

describe('Nutrition Core — parser.js', () => {
  it('parses number and food name with default serving', () => {
    const res = parseLocalQuantity('2 eggs')
    expect(res.qty).toBe(2)
    expect(res.unit).toBe('serving')
    expect(res.query).toBe('eggs')
  })

  it('parses weight units (grams)', () => {
    const res = parseLocalQuantity('150g chicken breast')
    expect(res.qty).toBe(150)
    expect(res.unit).toBe('g')
    expect(res.query).toBe('chicken breast')
  })

  it('parses volume units and fractions', () => {
    const res = parseLocalQuantity('1 1/2 cups whole milk')
    expect(res.qty).toBe(1.5)
    expect(res.unit).toBe('cup')
    expect(res.query).toBe('whole milk')
  })

  it('parses unicode fractions', () => {
    const res = parseLocalQuantity('¾ cup oats')
    expect(res.qty).toBe(0.75)
    expect(res.unit).toBe('cup')
    expect(res.query).toBe('oats')
  })

  it('defaults to 1 serving when no number is given', () => {
    const res = parseLocalQuantity('avocado')
    expect(res.qty).toBe(1)
    expect(res.unit).toBe('serving')
    expect(res.query).toBe('avocado')
  })
})

describe('Nutrition Core — recipes.js', () => {
  const oats = {
    name: 'Rolled Oats',
    per100g: { kcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5 }
  }
  const milk = {
    name: 'Milk',
    per100g: { kcal: 60, proteinG: 3.2, carbsG: 4.8, fatG: 3.3 }
  }

  it('calculates totals and per-serving nutrients for a recipe', () => {
    const ingredients = [
      { food: oats, qty: 100, unit: 'g', name: 'Oats' },
      { food: milk, qty: 200, unit: 'g', name: 'Milk' }
    ]
    // Total kcal = 379 + 120 = 499 kcal
    const res = calculateRecipeTotals(ingredients, 2)
    expect(res.totals.kcal).toBe(499)
    expect(res.perServing.kcal).toBe(250) // 499 / 2 = 249.5 -> 250
    expect(res.servings).toBe(2)
  })

  it('converts recipe into a valid loggable Food object', () => {
    const recipe = {
      id: 'rec_123',
      name: 'Morning Oatmeal',
      servings: 2,
      ingredients: [
        { food: oats, qty: 100, unit: 'g', name: 'Oats' }
      ]
    }
    const food = recipeToFood(recipe)
    expect(food.key).toBe('recipe:rec_123')
    expect(food.name).toBe('Morning Oatmeal')
    expect(food.serving.nutrients.kcal).toBe(190) // 379 / 2
  })
})

describe('Nutrition Core — totals.js', () => {
  const entries = [
    { meal: 'breakfast', nutrients: { kcal: 400, proteinG: 30, carbsG: 40, fatG: 12 } },
    { meal: 'lunch', nutrients: { kcal: 650, proteinG: 50, carbsG: 60, fatG: 20 } },
    { meal: 'dinner', nutrients: { kcal: 700, proteinG: 45, carbsG: 70, fatG: 22 } },
    { meal: 'snack', nutrients: { kcal: 150, proteinG: 10, carbsG: 15, fatG: 5 } }
  ]

  it('sums nutrients across multiple entries', () => {
    const sum = calculateNutrientSum(entries)
    expect(sum.kcal).toBe(1900)
    expect(sum.proteinG).toBe(135)
    expect(sum.count).toBe(4)
  })

  it('calculates full day dashboard statistics', () => {
    const targets = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 65, waterMl: 3000 }
    const dash = calculateDayDashboard(entries, 2500, targets)

    expect(dash.consumed.kcal).toBe(1900)
    expect(dash.remainingKcal).toBe(100) // 2000 - 1900
    expect(dash.percentages.calories).toBe(95)
    expect(dash.percentages.water).toBe(83) // 2500 / 3000
    expect(dash.meals.breakfast.entries.length).toBe(1)
    expect(dash.meals.lunch.totals.kcal).toBe(650)
  })

  it('returns valid local date string format YYYY-MM-DD', () => {
    const dateStr = getLocalDateString()
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
