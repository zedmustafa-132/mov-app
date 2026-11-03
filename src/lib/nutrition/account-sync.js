// The main store owns authentication and its adoption question. Nutrition follows
// that identity; requests queued for another account can never follow a new cookie.
export function startNutritionAccounts(mainStore, nutritionStore) {
  const follow = () => {
    const state = mainStore.getState()
    nutritionStore.getState().setAccount(state.ready === false ? null : state.user?.id || null, { paused: Boolean(state.sync?.held || state.ready === false) })
  }
  const account = event => nutritionStore.getState().setAccount(event.detail.id, { paused: event.detail.paused, adoptLocal: event.detail.adoptLocal })
  const adopt = event => { if (event.detail.added && nutritionStore.getState().accountId === event.detail.id) nutritionStore.getState().adoptGuest() }
  window.addEventListener('mov:nutrition-account', account)
  window.addEventListener('mov:nutrition-adopt', adopt)
  const unsubscribe = mainStore.subscribe((next, previous) => {
    if (next.user?.id !== previous.user?.id || next.sync?.held !== previous.sync?.held || next.ready !== previous.ready) follow()
  })
  const refresh = () => { if (document.visibilityState !== 'hidden') nutritionStore.getState().syncNow().catch(() => {}) }
  window.addEventListener('online', refresh); window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  const timer = setInterval(refresh, 60000)
  follow()
  return () => { unsubscribe(); clearInterval(timer); window.removeEventListener('mov:nutrition-account', account); window.removeEventListener('mov:nutrition-adopt', adopt)
    window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
}
