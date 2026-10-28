// recipes.js — recipe nutrition aggregator and serving calculator for NXT FORM
import { scaleNutrients } from './portions.js'

/**
 * Calculate totals and per-serving nutrients for a recipe from its ingredients.
 * @param {Array} ingredients - Array of { food, qty, unit, name }
 * @param {number} servings - Number of portions the recipe makes (default 1)
 */
export function calculateRecipeTotals(ingredientsOrRecipe = [], servingsParam = 1) {
  let ingredients = ingredientsOrRecipe
  let servings = servingsParam
  if (ingredientsOrRecipe && !Array.isArray(ingredientsOrRecipe) && typeof ingredientsOrRecipe === 'object') {
    ingredients = ingredientsOrRecipe.ingredients || []
    servings = ingredientsOrRecipe.servings || 1
  }

  const numServings = Math.max(1, Number(servings) || 1)

  const totals = {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    totalWeightG: 0
  }

  const items = (ingredients || []).map(ing => {
    const foodItem = ing.food || ing
    const scaled = scaleNutrients(foodItem, ing.qty, ing.unit)
    const n = scaled.nutrients || {}

    totals.kcal += n.kcal ?? n.calories ?? 0
    totals.proteinG += n.proteinG ?? n.protein ?? 0
    totals.carbsG += n.carbsG ?? n.carbs ?? 0
    totals.fatG += n.fatG ?? n.fat ?? 0
    totals.fiberG += n.fiberG ?? n.fiber ?? 0
    totals.sugarG += n.sugarG ?? n.sugar ?? 0
    totals.sodiumMg += n.sodiumMg ?? n.sodium ?? 0
    if (scaled.weightGrams) totals.totalWeightG += scaled.weightGrams

    return {
      ...ing,
      scaledNutrients: n,
      weightGrams: scaled.weightGrams
    }
  })

  const pKcal = Math.round(totals.kcal / numServings)
  const pProt = Math.round((totals.proteinG / numServings) * 10) / 10
  const pCarb = Math.round((totals.carbsG / numServings) * 10) / 10
  const pFat = Math.round((totals.fatG / numServings) * 10) / 10
  const pFib = Math.round((totals.fiberG / numServings) * 10) / 10
  const pSug = Math.round((totals.sugarG / numServings) * 10) / 10
  const pSod = Math.round(totals.sodiumMg / numServings)

  // Per serving values
  const perServing = {
    kcal: pKcal,
    calories: pKcal,
    proteinG: pProt,
    protein: pProt,
    carbsG: pCarb,
    carbs: pCarb,
    fatG: pFat,
    fat: pFat,
    fiberG: pFib,
    fiber: pFib,
    sugarG: pSug,
    sugar: pSug,
    sodiumMg: pSod,
    sodium: pSod,
    weightGrams: totals.totalWeightG ? Math.round((totals.totalWeightG / numServings) * 10) / 10 : null
  }

  const tKcal = Math.round(totals.kcal)
  const tProt = Math.round(totals.proteinG * 10) / 10
  const tCarb = Math.round(totals.carbsG * 10) / 10
  const tFat = Math.round(totals.fatG * 10) / 10
  const tFib = Math.round(totals.fiberG * 10) / 10

  return {
    totals: {
      kcal: tKcal,
      calories: tKcal,
      proteinG: tProt,
      protein: tProt,
      carbsG: tCarb,
      carbs: tCarb,
      fatG: tFat,
      fat: tFat,
      fiberG: tFib,
      fiber: tFib,
      sugarG: Math.round(totals.sugarG * 10) / 10,
      sodiumMg: Math.round(totals.sodiumMg),
      totalWeightG: Math.round(totals.totalWeightG * 10) / 10
    },
    perServing,
    servings: numServings,
    items
  }
}

/**
 * Convert a saved recipe into a loggable Food object.
 */
export function recipeToFood(recipe) {
  const totals = calculateRecipeTotals(recipe.ingredients, recipe.servings)
  return {
    key: `recipe:${recipe.id}`,
    source: 'recipe',
    externalId: recipe.id,
    name: recipe.name,
    brand: 'My Recipe',
    basis: 'perServing',
    defaultServingQuantity: 1,
    defaultServingUnit: 'serving',
    serving: {
      label: '1 serving',
      grams: totals.totals.totalWeightG ? Math.round(totals.totals.totalWeightG / totals.servings) : null,
      nutrients: totals.perServing
    },
    portions: [
      { label: 'serving', grams: totals.totals.totalWeightG ? Math.round(totals.totals.totalWeightG / totals.servings) : null }
    ],
    dataQuality: 'user',
    recipeId: recipe.id
  }
}

export const recipeToFoodItem = recipeToFood
