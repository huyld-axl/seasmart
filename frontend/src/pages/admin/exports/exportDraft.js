import { TEMPLATES } from './packModel'

const VERSION = 1
const fields = ['people', 'pickedLabels', 'ownerId', 'ownerLabel', 'selected', 'inputs', 'edits', 'picked', 'viewId', 'editing', 'opportunityId']
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value)
export const draftKey = (userId) => `exports.new.draft.v${VERSION}.${userId}`
export const emptyDraft = (seafarer) => ({
  people: seafarer ? [String(seafarer)] : [], pickedLabels: {}, ownerId: null, ownerLabel: null,
  selected: [], inputs: {}, edits: {}, picked: null, viewId: null, editing: false,
})
export const hasDraft = (data) => !!(data.people.length || data.ownerId || data.selected.length ||
  Object.values(data.inputs).some(Boolean) || Object.values(data.edits).some((docs) =>
    Object.values(docs).some((cells) => Object.keys(cells).length)))

// One browser draft per account. Writes are synchronous so leaving the route
// immediately after typing cannot outrun a timer or an unmount effect.
export function createDraftStore(userId, seafarer, storage = localStorage) {
  const storageKey = draftKey(userId)
  let snapshot = { data: emptyDraft(seafarer), savedAt: null, storageError: false }
  try {
    const saved = JSON.parse(storage.getItem(storageKey) || 'null')
    if (saved?.version === VERSION && isObject(saved.data) && Array.isArray(saved.data.people) &&
      Array.isArray(saved.data.selected) && ['pickedLabels', 'inputs', 'edits'].every((field) => isObject(saved.data[field])) &&
      Object.values(saved.data.edits).every((docs) => isObject(docs) && Object.values(docs).every(isObject))) {
      const data = { ...emptyDraft(), ...Object.fromEntries(fields.filter((field) => field in saved.data).map((field) => [field, saved.data[field]])) }
      data.people = data.people.map(String)
      data.selected = data.selected.filter((key) => TEMPLATES.some((template) => template.key === key))
      snapshot = { data, savedAt: saved.savedAt || null, storageError: false }
    }
  } catch {
    // Malformed drafts can be replaced by the next edit. Storage restrictions
    // must be visible; the in-memory store still survives route navigation.
    try { storage.getItem(storageKey) } catch { snapshot.storageError = true }
  }
  const listeners = new Set()
  const publish = (data) => {
    const savedAt = hasDraft(data) ? Date.now() : null
    let storageError = false
    try {
      if (savedAt) storage.setItem(storageKey, JSON.stringify({ version: VERSION, savedAt, data }))
      else storage.removeItem(storageKey)
    } catch { storageError = true }
    snapshot = { data, savedAt: storageError ? null : savedAt, storageError }
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    setField: (field, value) => publish({ ...snapshot.data, [field]: typeof value === 'function' ? value(snapshot.data[field]) : value }),
    clear: () => publish(emptyDraft()),
  }
}
