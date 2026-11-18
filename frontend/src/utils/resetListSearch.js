export const RESET_LIST_SEARCH = 'mcah:reset-list-search'

export function resetListSearch() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (/^list:.*:(search|page)$/.test(key)) sessionStorage.removeItem(key)
      if (key.startsWith('seafarers:list:')) {
        const value = JSON.parse(sessionStorage.getItem(key))
        sessionStorage.setItem(key, JSON.stringify({ ...value, search: '', page: 1 }))
      }
    }
  } catch { /* Storage có thể bị chặn. */ }
  window.dispatchEvent(new Event(RESET_LIST_SEARCH))
}
