// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('../api.js', () => ({ api: mocks.api }))
import { useNutrition } from '../../store/useNutrition.js'
import { mergeNutritionDays } from '../../../../shared/nutrition-sync.mjs'

const date = '2026-10-31', month = '2026-10'
const egg = { key: 'egg', name: 'Egg', per100g: { kcal: 143, proteinG: 12.6, carbsG: .7, fatG: 9.5 }, portions: [{ label: 'large', grams: 50 }] }
let owner, remote
function server(path, options) {
  const account = remote[owner] ||= {}
  if (path === '/api/nutrition') return Promise.resolve({ months: Object.keys(account) })
  const key = path.split('/').at(-1)
  if (!options?.method) return Promise.resolve(structuredClone(account[key] || { days: {}, rev: 0 }))
  const body = JSON.parse(options.body)
  if ((account[key]?.rev || 0) !== body.baseRev) return Promise.reject(Object.assign(new Error('conflict'), { status: 409 }))
  account[key] = structuredClone({ ...body, rev: (account[key]?.rev || 0) + 1 })
  return Promise.resolve({ ok: true, rev: account[key].rev })
}
async function signIn(id, options) {
  owner = id; useNutrition.getState().setAccount(id, options); await useNutrition.getState().syncNow({ refresh: true })
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T12:00:00Z')); vi.resetAllMocks()
  useNutrition.getState().setAccount(null)
  localStorage.clear()
  useNutrition.setState({ days: {}, customFoods: [], recipes: [], savedMeals: [], recentFoods: [], favouriteFoods: [], _dirtyMonths: [], _monthVersions: {}, _libraryUpdatedAt: 0, selectedDate: date })
  owner = null; remote = {}; mocks.api.mockImplementation(server)
})
afterEach(() => { useNutrition.getState().setAccount(null); vi.clearAllTimers(); vi.useRealTimers() })

it('keeps guest logging local and moves it only when a new account adopts it', async () => {
  useNutrition.getState().logFood(date, 'breakfast', egg, 2, 'large')
  useNutrition.getState().addWater(date, 250)
  await vi.advanceTimersByTimeAsync(1500)
  expect(mocks.api).not.toHaveBeenCalled()
  await signIn('alice', { adoptLocal: true })
  expect(remote.alice[month].days[date].entries).toHaveLength(1)
  expect(remote.alice[month].days[date].waterMl).toBe(250)
  expect(JSON.parse(localStorage.getItem('nxtform_nutrition_v1')).days).toEqual({})
})

it('restores server meals and water on a new browser copy', async () => {
  remote.alice = { [month]: { rev: 3, days: { [date]: { entries: [{ id: 'meal', name: 'Egg', createdAt: '2026-10-31T10:00:00Z', nutrients: { kcal: 143 } }], waterMl: 750 } } } }
  await signIn('alice')
  expect(useNutrition.getState().days[date].entries[0].name).toBe('Egg')
  expect(useNutrition.getState().days[date].waterMl).toBe(750)
})

it('keeps users separate through a sign-out, a different login, and a return', async () => {
  await signIn('alice')
  useNutrition.getState().logFood(date, 'breakfast', egg, 2, 'large')
  await useNutrition.getState().syncNow()
  await signIn('bob')
  expect(useNutrition.getState().days[date]?.entries || []).toHaveLength(0)
  useNutrition.getState().addWater(date, 500)
  await useNutrition.getState().syncNow()
  await signIn('alice')
  expect(useNutrition.getState().days[date].entries).toHaveLength(1)
  expect(useNutrition.getState().days[date].waterMl).toBe(0)
  expect(remote.bob[month].days[date].entries).toHaveLength(0)
  expect(remote.bob[month].days[date].waterMl).toBe(500)
})

it('does not apply a late response after the signed-in account changes', async () => {
  let release
  mocks.api.mockImplementation((path, options) => owner === 'alice' && path.endsWith(month) && !options
    ? new Promise(resolve => { release = resolve }) : server(path, options))
  owner = 'alice'; useNutrition.getState().setAccount('alice')
  await Promise.resolve(); await Promise.resolve()
  await signIn('bob')
  release({ rev: 2, days: { [date]: { entries: [{ id: 'private', name: 'Alice private meal' }], waterMl: 900 } } })
  await Promise.resolve(); await Promise.resolve()
  expect(useNutrition.getState().accountId).toBe('bob')
  expect(JSON.stringify(useNutrition.getState().days)).not.toContain('Alice private meal')
})

it('merges simultaneous water additions and prevents deleted meals returning', () => {
  const a = { [date]: { entries: [], deletedEntries: { old: 10 }, waterBaseMl: 0, waterEvents: { a: { delta: 250 } }, waterMl: 250 } }
  const b = { [date]: { entries: [{ id: 'old', createdAt: '1970-01-01T00:00:00.005Z' }, { id: 'new', createdAt: '1970-01-01T00:00:00.011Z' }], waterBaseMl: 0, waterEvents: { b: { delta: 500 } }, waterMl: 500 } }
  const merged = mergeNutritionDays(a, b)
  expect(merged[date].waterMl).toBe(750)
  expect(merged[date].entries.map(entry => entry.id)).toEqual(['new'])
  expect(mergeNutritionDays(merged, b)[date].waterMl).toBe(750)
})

it('preserves offline edits and retries when the server becomes available', async () => {
  await signIn('alice')
  mocks.api.mockRejectedValue(new Error('offline'))
  useNutrition.getState().addWater(date, 250)
  await useNutrition.getState().syncNow()
  expect(useNutrition.getState().syncStatus.pending).toBe(true)
  expect(useNutrition.getState().syncStatus.error).toContain('saved here')
  mocks.api.mockImplementation(server)
  await useNutrition.getState().syncNow()
  expect(remote.alice[month].days[date].waterMl).toBe(250)
  expect(useNutrition.getState().syncStatus.error).toBeNull()
})

it('re-reads and merges after a revision conflict instead of overwriting another device', async () => {
  await signIn('alice')
  useNutrition.getState().addWater(date, 250)
  let conflict = true
  mocks.api.mockImplementation((path, options) => {
    if (options?.method === 'PUT' && conflict) {
      conflict = false
      remote.alice[month] = { rev: 100, days: { [date]: { entries: [], waterBaseMl: 0, waterEvents: { phone: { delta: 500 } }, waterMl: 500 } } }
      return Promise.reject(Object.assign(new Error('conflict'), { status: 409 }))
    }
    return server(path, options)
  })
  await useNutrition.getState().syncNow()
  expect(remote.alice[month].days[date].waterMl).toBe(750)
})

it('restores custom foods, recipes and favourites along with progress', async () => {
  await signIn('alice')
  useNutrition.getState().saveCustomFood(egg)
  useNutrition.getState().toggleFavorite('egg')
  await useNutrition.getState().syncNow()
  useNutrition.getState().setAccount(null)
  localStorage.removeItem('nxtform_nutrition_v1:alice')
  await signIn('alice')
  expect(useNutrition.getState().customFoods[0].key).toBe('egg')
  expect(useNutrition.getState().favouriteFoods).toContain('egg')
})
