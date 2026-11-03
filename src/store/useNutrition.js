import { create } from 'zustand'
import { scaleNutrients, normalizeFoodRecord } from '../lib/nutrition/portions.js'
import { getLocalDateString } from '../lib/nutrition/totals.js'
import { api } from '../lib/api.js'
import { emptyNutrition, LIBRARY_FIELDS, nutritionLibrary, mergeLibrary, mergeNutritionDays, daysForMonth } from '../../../shared/nutrition-sync.mjs'

const STORAGE_KEY = 'nxtform_nutrition_v1'
const keyFor = id => id ? `${STORAGE_KEY}:${id}` : STORAGE_KEY
let generation = 0, timer, task, clock = 0
const tick = () => (clock = Math.max(Date.now(), clock + 1))
const id = prefix => `${prefix}_${tick()}_${Math.random().toString(36).slice(2, 8)}`
const libraryState = library => ({ ...Object.fromEntries(LIBRARY_FIELDS.map(key => [key, library[key] || []])), _libraryUpdatedAt: library.updatedAt || 0 })

function loadLocal(accountId = null) {
  try { return { ...emptyNutrition(), ...JSON.parse(localStorage.getItem(keyFor(accountId)) || '{}'), accountId } }
  catch { return { ...emptyNutrition(), accountId } }
}
function saveLocal(state) {
  try {
    const data = { days: state.days, ...nutritionLibrary(state), _libraryUpdatedAt: state._libraryUpdatedAt || 0,
      _dirtyMonths: state._dirtyMonths || [], _monthVersions: state._monthVersions || {} }
    delete data.updatedAt
    localStorage.setItem(keyFor(state.accountId), JSON.stringify(data))
  } catch { /* The in-memory copy is still available to export. */ }
}
function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => { useNutrition.getState().syncNow().catch(() => {}) }, 1000)
}
function changed(state, patch, months, library = false) {
  const version = tick()
  const monthList = Array.isArray(months) ? months : [months || getLocalDateString().slice(0, 7)]
  const next = { ...state, ...patch,
    _libraryUpdatedAt: library ? version : state._libraryUpdatedAt || 0,
    _dirtyMonths: [...new Set([...(state._dirtyMonths || []), ...monthList])],
    _monthVersions: { ...state._monthVersions, ...Object.fromEntries(monthList.map(month => [month, version])) },
    syncStatus: { ...state.syncStatus, pending: Boolean(state.accountId) } }
  saveLocal(next)
  if (next.accountId && !next.paused) schedule()
  return next
}

export const useNutrition = create((set, get) => ({
  ...loadLocal(), selectedDate: getLocalDateString(), paused: false,
  syncStatus: { pending: false, syncing: false, error: null, lastSynced: 0 },
  setSelectedDate: selectedDate => { set({ selectedDate }); if (get().accountId) schedule() },

  setAccount(accountId, { adoptLocal = false, paused = false } = {}) {
    const nextId = accountId || null
    if (get().accountId === nextId && get().paused !== paused) { generation++; clearTimeout(timer); set(state => ({ syncStatus: { ...state.syncStatus, syncing: false } })) }
    if (get().accountId !== nextId) {
      generation++; clearTimeout(timer)
      const local = loadLocal(nextId)
      set({ ...emptyNutrition(), ...local, paused,
        syncStatus: { pending: Boolean(nextId && local._dirtyMonths?.length), syncing: false, error: null, lastSynced: 0 } })
    } else set({ paused })
    if (nextId && adoptLocal) get().adoptGuest()
    if (nextId && !paused) get().syncNow({ refresh: true }).catch(() => {})
  },
  adoptGuest() {
    if (!get().accountId) return
    const guest = loadLocal()
    const months = Object.keys(guest.days || {}).map(date => date.slice(0, 7))
    if (!months.length && !LIBRARY_FIELDS.some(key => guest[key]?.length)) return
    set(state => changed(state, { days: mergeNutritionDays(state.days, guest.days),
      ...libraryState(mergeLibrary(nutritionLibrary(state), { ...nutritionLibrary(guest), updatedAt: tick() })) },
      [...new Set([...months, getLocalDateString().slice(0, 7)])], true))
    saveLocal({ ...emptyNutrition(), accountId: null })
  },

  async syncNow({ refresh = false } = {}) {
    if (!get().accountId || get().paused) return false
    if (task?.generation === generation) return task.promise
    const token = generation, accountId = get().accountId
    const current = () => generation === token && get().accountId === accountId && !get().paused
    const promise = (async () => {
      set(state => ({ syncStatus: { ...state.syncStatus, syncing: true, error: null } }))
      try {
        let remoteMonths = []
        if (refresh) {
          const index = await api('/api/nutrition')
          if (!current()) return false
          remoteMonths = (index?.months || []).filter(month => /^\d{4}-\d{2}$/.test(month))
        }
        const months = [...new Set([...remoteMonths, ...(refresh ? Object.keys(get().days).map(date => date.slice(0, 7)) : []),
          ...(get()._dirtyMonths || []), get().selectedDate.slice(0, 7), getLocalDateString().slice(0, 7)])].sort().reverse()
        for (const month of months) {
          let done = false
          for (let attempt = 0; attempt < 3 && current(); attempt++) {
            const remote = await api(`/api/nutrition/${month}`)
            if (!current()) return false
            const state = get(), localDays = daysForMonth(state.days, month)
            const mergedDays = mergeNutritionDays(localDays, remote?.days || {})
            const library = mergeLibrary(nutritionLibrary(state), remote?.library)
            const dirty = state._dirtyMonths?.includes(month)
            set(latest => {
              const next = { ...latest, days: { ...latest.days, ...mergeNutritionDays(daysForMonth(latest.days, month), mergedDays) }, ...libraryState(library) }
              saveLocal(next); return next
            })
            if (!dirty && JSON.stringify(mergedDays) === JSON.stringify(mergeNutritionDays(remote?.days || {}, {}))
              && library.updatedAt <= (remote?.library?.updatedAt || 0)) { done = true; break }
            const version = get()._monthVersions?.[month] || 0
            try {
              await api(`/api/nutrition/${month}`, { method: 'PUT', body: JSON.stringify({ month, baseRev: remote?.rev || 0, days: daysForMonth(get().days, month), library: nutritionLibrary(get()) }) })
              if (!current()) return false
              set(latest => {
                const next = { ...latest, _dirtyMonths: (latest._dirtyMonths || []).filter(value => value !== month || (latest._monthVersions?.[month] || 0) !== version) }
                saveLocal(next); return next
              })
              done = true; break
            } catch (error) { if (error.status !== 409 || attempt === 2) throw error }
          }
          if (!current()) return false
          if (!done) throw new Error('Another device is updating this meal. Try syncing again.')
        }
        if (current()) set(state => ({ syncStatus: { pending: Boolean(state._dirtyMonths?.length), syncing: false, error: null, lastSynced: Date.now() } }))
        return true
      } catch (error) {
        if (current()) set(state => ({ syncStatus: { ...state.syncStatus, pending: Boolean(state._dirtyMonths?.length), syncing: false,
          error: error.status === 401 ? 'Sign in again to sync food and water.' : 'Food and water are saved here. Sync will retry when connected.' } }))
        return false
      } finally { if (task?.generation === token) { task = null; if (current() && get()._dirtyMonths?.length && !get().syncStatus.error) schedule() } }
    })()
    task = { generation: token, promise }
    return promise
  },

  logFood(dateStr, meal, food, qty = 1, unit = 'g') {
    const date = dateStr || get().selectedDate
    food = normalizeFoodRecord(food)
    const scaled = scaleNutrients(food, qty, unit)
    const entry = { id: id('fn'), meal, foodKey: food.key || null, foodRef: food, name: food.name, brand: food.brand || null,
      qty: Number(qty), unit, ...scaled, createdAt: new Date(tick()).toISOString() }
    set(state => changed(state, { days: { ...state.days, [date]: { ...(state.days[date] || { waterMl: 0 }), entries: [...(state.days[date]?.entries || []), entry] } },
      recentFoods: [food, ...state.recentFoods.filter(value => value.key !== food.key)].slice(0, 50) }, date.slice(0, 7), true))
    return entry
  },
  deleteFood(dateStr, entryId) {
    const date = dateStr || get().selectedDate
    set(state => {
      const day = state.days[date]
      if (!day) return state
      return changed(state, { days: { ...state.days, [date]: { ...day, entries: day.entries.filter(entry => entry.id !== entryId),
        deletedEntries: { ...day.deletedEntries, [entryId]: tick() } } } }, date.slice(0, 7))
    })
  },
  updateEntryPortion(dateStr, entryId, foodRef, qty, unit, meal) {
    const date = dateStr || get().selectedDate, scaled = scaleNutrients(foodRef, qty, unit)
    set(state => {
      const day = state.days[date]
      if (!day) return state
      return changed(state, { days: { ...state.days, [date]: { ...day, entries: day.entries.map(entry => entry.id === entryId
        ? { ...entry, foodRef: normalizeFoodRecord(foodRef), meal: meal || entry.meal, qty: Number(qty), unit, ...scaled, updatedAt: new Date(tick()).toISOString() } : entry) } } }, date.slice(0, 7))
    })
  },
  addWater(dateStr, deltaMl) {
    const date = dateStr || get().selectedDate
    set(state => {
      const day = state.days[date] || { entries: [], waterMl: 0 }, previous = Number(day.waterMl) || 0
      const waterMl = Math.max(0, previous + (Number(deltaMl) || 0)), eventId = id('water')
      return changed(state, { days: { ...state.days, [date]: { ...day, waterMl,
        waterBaseMl: day.waterEvents ? day.waterBaseMl || 0 : previous,
        waterEvents: { ...day.waterEvents, [eventId]: { delta: waterMl - previous, at: tick() } } } } }, date.slice(0, 7))
    })
  },
  saveCustomFood(food) { set(state => changed(state, { customFoods: [food, ...state.customFoods.filter(value => value.key !== food.key)] }, null, true)) },
  saveRecipe(recipe) { set(state => changed(state, { recipes: [recipe, ...state.recipes.filter(value => value.id !== recipe.id)] }, null, true)) },
  toggleFavorite(foodKey) {
    set(state => { const values = new Set(state.favouriteFoods); if (values.has(foodKey)) values.delete(foodKey); else values.add(foodKey)
      return changed(state, { favouriteFoods: [...values] }, null, true) })
  },
  importNutritionData(data) {
    if (!data || typeof data !== 'object') return
    set(state => changed(state, { days: mergeNutritionDays(state.days, data.days || {}),
      ...Object.fromEntries(LIBRARY_FIELDS.map(key => [key, Array.isArray(data[key]) ? data[key] : state[key]])) },
      [...new Set([...Object.keys(state.days), ...Object.keys(data.days || {}), getLocalDateString()].map(date => date.slice(0, 7)))], true))
  }
}))
