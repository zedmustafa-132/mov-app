// useNutrition.js — client-side Zustand store for NXT FORM nutrition diary and recipes
import { create } from 'zustand'
import { scaleNutrients } from '../lib/nutrition/portions.js'
import { getLocalDateString } from '../lib/nutrition/totals.js'
import { api } from '../lib/api.js'

const STORAGE_KEY = 'nxtform_nutrition_v1'

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Could not parse nutrition storage:', e)
  }
  return {
    days: {},
    customFoods: [],
    recipes: [],
    savedMeals: [],
    recentFoods: [],
    favouriteFoods: []
  }
}

function saveLocal(state) {
  try {
    const toSave = {
      days: state.days || {},
      customFoods: state.customFoods || [],
      recipes: state.recipes || [],
      savedMeals: state.savedMeals || [],
      recentFoods: (state.recentFoods || []).slice(0, 50),
      favouriteFoods: state.favouriteFoods || []
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('Failed to save nutrition state:', e)
  }
}

let syncTimeout = null
function debouncePushMonth(month, days) {
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(async () => {
    try {
      const monthDays = {}
      for (const [d, data] of Object.entries(days || {})) {
        if (d.startsWith(month)) monthDays[d] = data
      }
      await api(`/api/nutrition/${month}`, {
        method: 'PUT',
        body: JSON.stringify({ month, days: monthDays, rev: Date.now() })
      })
    } catch {
      // Offline or unauthenticated; local changes remain safe in localStorage
    }
  }, 1500)
}

export const useNutrition = create((set, get) => {
  const initial = loadLocal()

  return {
    ...initial,
    selectedDate: getLocalDateString(),

    setSelectedDate: (dateStr) => set({ selectedDate: dateStr }),

    // Log a food entry into a meal
    logFood: (dateStr, mealType, food, qty = 1, unit = 'g') => {
      const d = dateStr || get().selectedDate
      const scaled = scaleNutrients(food, qty, unit)
      const entry = {
        id: `fn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        meal: mealType,
        foodKey: food.key || null,
        name: food.name,
        brand: food.brand || null,
        qty: Number(qty) || 1,
        unit,
        weightGrams: scaled.weightGrams,
        nutrients: scaled.nutrients,
        createdAt: new Date().toISOString()
      }

      set(state => {
        const day = state.days[d] || { entries: [], waterMl: 0 }
        const updatedEntries = [...day.entries, entry]
        const updatedDays = { ...state.days, [d]: { ...day, entries: updatedEntries } }

        // Update recents
        const filteredRecents = state.recentFoods.filter(f => f.key !== food.key)
        const updatedRecents = [food, ...filteredRecents].slice(0, 50)

        const next = { ...state, days: updatedDays, recentFoods: updatedRecents }
        saveLocal(next)
        debouncePushMonth(d.slice(0, 7), updatedDays)
        return next
      })

      return entry
    },

    // Delete a logged food entry
    deleteFood: (dateStr, entryId) => {
      const d = dateStr || get().selectedDate
      set(state => {
        const day = state.days[d]
        if (!day) return state
        const updatedEntries = day.entries.filter(e => e.id !== entryId)
        const updatedDays = { ...state.days, [d]: { ...day, entries: updatedEntries } }

        const next = { ...state, days: updatedDays }
        saveLocal(next)
        debouncePushMonth(d.slice(0, 7), updatedDays)
        return next
      })
    },

    // Update portion of an existing food entry
    updateEntryPortion: (dateStr, entryId, foodRef, qty, unit) => {
      const d = dateStr || get().selectedDate
      const scaled = scaleNutrients(foodRef, qty, unit)
      set(state => {
        const day = state.days[d]
        if (!day) return state
        const updatedEntries = day.entries.map(e => {
          if (e.id !== entryId) return e
          return {
            ...e,
            qty: Number(qty),
            unit,
            weightGrams: scaled.weightGrams,
            nutrients: scaled.nutrients,
            updatedAt: new Date().toISOString()
          }
        })
        const updatedDays = { ...state.days, [d]: { ...day, entries: updatedEntries } }
        const next = { ...state, days: updatedDays }
        saveLocal(next)
        debouncePushMonth(d.slice(0, 7), updatedDays)
        return next
      })
    },

    // Add or remove water (in ml)
    addWater: (dateStr, deltaMl) => {
      const d = dateStr || get().selectedDate
      set(state => {
        const day = state.days[d] || { entries: [], waterMl: 0 }
        const nextWater = Math.max(0, (day.waterMl || 0) + deltaMl)
        const updatedDays = { ...state.days, [d]: { ...day, waterMl: nextWater } }
        const next = { ...state, days: updatedDays }
        saveLocal(next)
        debouncePushMonth(d.slice(0, 7), updatedDays)
        return next
      })
    },

    // Save a custom food
    saveCustomFood: (food) => {
      set(state => {
        const nextCustom = [food, ...state.customFoods.filter(f => f.key !== food.key)]
        const next = { ...state, customFoods: nextCustom }
        saveLocal(next)
        return next
      })
    },

    // Save a custom recipe
    saveRecipe: (recipe) => {
      set(state => {
        const nextRecipes = [recipe, ...state.recipes.filter(r => r.id !== recipe.id)]
        const next = { ...state, recipes: nextRecipes }
        saveLocal(next)
        return next
      })
    },

    // Toggle a food as favorite
    toggleFavorite: (foodKey) => {
      set(state => {
        const favs = new Set(state.favouriteFoods || [])
        if (favs.has(foodKey)) favs.delete(foodKey)
        else favs.add(foodKey)
        const next = { ...state, favouriteFoods: Array.from(favs) }
        saveLocal(next)
        return next
      })
    }
  }
})
