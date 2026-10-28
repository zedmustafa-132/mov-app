// portions.js — portion math and nutrient calculations for NXT FORM
// Normalizes nutrient basis (per100g vs perServing) and scales accurately without losing precision.

export const STANDARD_UNITS = {
  g: { label: 'g', toGrams: 1 },
  ml: { label: 'ml', toGrams: 1 }, // assume 1g/ml for water/beverages by default
  oz: { label: 'oz', toGrams: 28.3495 },
  lb: { label: 'lb', toGrams: 453.592 },
  serving: { label: 'serving', toGrams: null }
}

/**
 * Scale nutrients of a food record based on selected portion quantity and unit.
 * @param {Object} food - Normalized Food object (must have either per100g or serving.nutrients)
 * @param {number} quantity - Number of units (e.g. 150 for 150g, 2 for 2 servings)
 * @param {string} unit - Unit identifier ('g', 'oz', 'serving', or custom portion label)
 * @returns {Object} Scaled nutrients object and calculated weight in grams
 */
export function scaleNutrients(food, quantity = 1, unit = 'g') {
  const qty = Math.max(0, Number(quantity) || 0)
  if (!food || qty === 0) {
    return {
      weightGrams: 0,
      nutrients: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 }
    }
  }

  let multiplier = 0
  let weightGrams = null

  // 1. Grams basis
  if (unit === 'g') {
    weightGrams = qty
    if (food.per100g) {
      multiplier = qty / 100
    } else if (food.serving?.grams) {
      multiplier = qty / food.serving.grams
    }
  }
  // 2. Ounces basis
  else if (unit === 'oz') {
    weightGrams = Math.round(qty * STANDARD_UNITS.oz.toGrams * 10) / 10
    if (food.per100g) {
      multiplier = weightGrams / 100
    } else if (food.serving?.grams) {
      multiplier = weightGrams / food.serving.grams
    }
  }
  // 3. Serving basis
  else if (unit === 'serving') {
    multiplier = qty
    if (food.serving?.grams) {
      weightGrams = Math.round(food.serving.grams * qty * 10) / 10
    } else if (food.per100g && food.defaultServingGrams) {
      weightGrams = Math.round(food.defaultServingGrams * qty * 10) / 10
    }
  }
  // 4. Custom portion (e.g. '1 cup', '1 large egg', '1 slice')
  else if (Array.isArray(food.portions)) {
    const matched = food.portions.find(p => p.label?.toLowerCase() === unit.toLowerCase())
    if (matched && matched.grams) {
      weightGrams = Math.round(matched.grams * qty * 10) / 10
      if (food.per100g) {
        multiplier = weightGrams / 100
      } else if (food.serving?.grams) {
        multiplier = weightGrams / food.serving.grams
      }
    }
  }

  // Fallback if basis could not be determined directly
  if (multiplier === 0 && qty > 0) {
    if (food.serving?.nutrients) {
      multiplier = qty
    } else if (food.per100g) {
      multiplier = qty / 100
      weightGrams = qty
    }
  }

  // Determine base nutrients (per100g or per serving)
  const base = food.per100g || food.serving?.nutrients || {}

  const scale = val => (val == null ? null : Math.round(Number(val) * multiplier * 10) / 10)
  const scaleWhole = val => (val == null ? null : Math.round(Number(val) * multiplier))

  return {
    weightGrams,
    nutrients: {
      kcal: scaleWhole(base.kcal),
      proteinG: scale(base.proteinG),
      carbsG: scale(base.carbsG),
      fatG: scale(base.fatG),
      fiberG: scale(base.fiberG),
      sugarG: scale(base.sugarG),
      sodiumMg: scaleWhole(base.sodiumMg)
    }
  }
}
