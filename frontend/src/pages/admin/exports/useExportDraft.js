import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { createDraftStore, hasDraft } from './exportDraft'

const stores = new Map()

export default function useExportDraft(userId, seafarer) {
  const store = useMemo(() => {
    const current = stores.get(userId)
    if (!current || (seafarer && !hasDraft(current.getSnapshot().data))) {
      stores.set(userId, createDraftStore(userId, seafarer))
    }
    return stores.get(userId)
  }, [userId, seafarer])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const clearDraft = useCallback(() => {
    store.clear()
    stores.delete(userId)
  }, [store, userId])
  return { ...snapshot, setField: store.setField, clearDraft }
}
