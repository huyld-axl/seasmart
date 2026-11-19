export const RESET_LIST_SEARCH = 'mcah:reset-list-search'

export function resetListSearch() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('list:') || key.startsWith('seafarers:list:')) sessionStorage.removeItem(key)
    }
  } catch { /* Storage có thể bị chặn. */ }
  window.dispatchEvent(new Event(RESET_LIST_SEARCH))
}
