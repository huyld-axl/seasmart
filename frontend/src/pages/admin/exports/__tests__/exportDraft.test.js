import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDraftStore, draftKey, emptyDraft } from '../exportDraft'

describe('bản nháp tạo bộ giấy', () => {
  beforeEach(() => localStorage.clear())

  it('restores every selection and rich cell edit after a page reload', () => {
    const store = createDraftStore(17)
    const data = {
      people: ['7', '8'], pickedLabels: { 7: 'Nguyễn Văn A', 8: 'Trần Văn B' },
      ownerId: 3, ownerLabel: 'Chủ tàu A', selected: ['pt', 'cv'],
      inputs: { 'Tên tàu': 'Tàu mới', 'Số tiền': '1.500.000' },
      edits: { 7: { pt: { C6: { runs: [{ text: 'Nội dung đã sửa', bold: true, color: '#003366' }], align: 'center' } } } },
      picked: 'pt', viewId: '7', editing: true,
    }
    for (const [field, value] of Object.entries(data)) store.setField(field, value)
    // New instance simulates a full refresh, with no component memory.
    const restored = createDraftStore(17, '99').getSnapshot()
    expect(restored.data).toEqual(data)
    expect(restored.savedAt).toBeGreaterThan(0)
    expect(restored.storageError).toBe(false)
  })

  it('keeps accounts separate and clears only the current account', () => {
    createDraftStore(1).setField('inputs', { 'Tên tàu': 'Tàu A' })
    const second = createDraftStore(2)
    expect(second.getSnapshot().data).toEqual(emptyDraft())
    second.setField('inputs', { 'Tên tàu': 'Tàu B' })
    second.clear()
    expect(localStorage.getItem(draftKey(2))).toBeNull()
    expect(createDraftStore(1).getSnapshot().data.inputs['Tên tàu']).toBe('Tàu A')
    expect(second.getSnapshot().data).toEqual(emptyDraft())
  })

  it('writes before returning from a field update, without waiting for blur or a timer', () => {
    const store = createDraftStore(1, '8')
    store.setField('edits', (current) => ({ ...current, 8: { pt: { A1: 'Đang gõ' } } }))
    expect(JSON.parse(localStorage.getItem(draftKey(1))).data.edits[8].pt.A1).toBe('Đang gõ')
  })

  it('recovers from malformed saved data and filters obsolete template keys', () => {
    localStorage.setItem(draftKey(1), '{bad json')
    expect(createDraftStore(1).getSnapshot().data).toEqual(emptyDraft())
    localStorage.setItem(draftKey(1), JSON.stringify({ version: 1, data: { ...emptyDraft(), selected: ['removed', 'pt'] } }))
    expect(createDraftStore(1).getSnapshot().data.selected).toEqual(['pt'])
    localStorage.setItem(draftKey(1), JSON.stringify({ version: 1, data: { ...emptyDraft(), edits: { 1: null } } }))
    expect(createDraftStore(1).getSnapshot().data).toEqual(emptyDraft())
  })

  it('keeps the in-memory draft and reports a failed disk save', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded') }, removeItem: () => {} }
    const store = createDraftStore(1, null, storage)
    store.setField('inputs', { 'Tên tàu': 'Không được mất' })
    expect(store.getSnapshot()).toMatchObject({ data: { inputs: { 'Tên tàu': 'Không được mất' } }, storageError: true, savedAt: null })
    // A later successful write must clear the warning.
    storage.setItem = vi.fn()
    store.setField('selected', ['pt'])
    expect(store.getSnapshot().storageError).toBe(false)
  })
})
