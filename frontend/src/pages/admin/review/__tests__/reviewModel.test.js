import { describe, it, expect } from 'vitest'
import { DEMO_DOCS } from './demoDocs'
import { canPublish, fromApi, applyAction, updateField, progress, docStatus, totalTodo, nextTodo } from '../reviewModel'

const doc = DEMO_DOCS.find((d) => d.key === 'so-45')
const field = (key) => doc.fields.find((f) => f.key === key)

describe('reviewModel', () => {
  it('chấp nhận, sửa, từ chối, giữ UNKNOWN', () => {
    expect(applyAction(field('gt'), 'accept').state).toBe('ACCEPTED')
    expect(applyAction(field('type'), 'accept').state).toBe('UNKNOWN_KEPT')
    expect(applyAction(field('gt'), 'edit', ' 320 GT ')).toMatchObject({ state: 'EDITED', value: '320 GT' })
    expect(applyAction(field('gt'), 'edit', '   ')).toBe(field('gt'))
    expect(applyAction(field('owner'), 'reject').state).toBe('REJECTED')
    expect(applyAction(field('off'), 'keepUnknown')).toMatchObject({ state: 'UNKNOWN_KEPT', value: '' })
  })

  it('hoàn tác về đúng đề xuất ban đầu, kể cả sau hai lần sửa', () => {
    const twice = applyAction(applyAction(field('gt'), 'edit', '1'), 'edit', '2')
    expect(applyAction(twice, 'undo')).toEqual(field('gt'))
  })

  it('đếm tiến độ và trạng thái giấy', () => {
    expect(progress(doc)).toEqual({ done: 5, total: 11, todo: 6 })
    expect(docStatus(doc)).toBe('REVIEW_REQUIRED')
    let docs = DEMO_DOCS
    doc.fields.forEach((f) => { docs = updateField(docs, 'so-45', f.key, f.value ? 'accept' : 'keepUnknown') })
    expect(docStatus(docs.find((d) => d.key === 'so-45'))).toBe('COMPLETED')
    expect(totalTodo(docs)).toBe(totalTodo(DEMO_DOCS) - 6)
  })

  it('updateField không đổi giấy khác và không đổi dữ liệu gốc', () => {
    const docs = updateField(DEMO_DOCS, 'so-45', 'gt', 'accept')
    expect(docs.find((d) => d.key === 'coc')).toBe(DEMO_DOCS.find((d) => d.key === 'coc'))
    expect(field('gt').state).toBe('PROPOSED')
  })

  it('ô kế tiếp cần xem, vòng lại từ đầu, hết thì null', () => {
    expect(nextTodo(doc, 'gt')).toBe('kw')
    expect(nextTodo(doc, 'off')).toBe('type')
    expect(nextTodo({ fields: [{ key: 'a', state: 'ACCEPTED' }] }, 'a')).toBeNull()
  })
})

describe('giấy từ API', () => {
  const api = { id: 7, label: 'Hộ chiếu', file_name: 'hc.jpg', mime_type: 'image/jpeg', page: null, title: null, status: 'REVIEW_REQUIRED', fields: [{ key: 'no', value: 'C1', state: 'PROPOSED' }] }

  it('đổi sang dạng màn duyệt', () => {
    expect(fromApi(api)).toMatchObject({ key: '7', file: 'hc.jpg', title: ['Hộ chiếu', ''], fields: [{ key: 'no', note: null }] })
  })

  it('chỉ đưa vào hồ sơ khi không còn ô cần xem và không còn giấy đang đọc', () => {
    const doc = fromApi(api)
    const done = { ...doc, status: 'COMPLETED', fields: [{ key: 'no', state: 'ACCEPTED' }] }
    expect(canPublish([doc])).toBe(false)
    expect(canPublish([done])).toBe(true)
    expect(canPublish([done, { ...doc, status: 'READING', fields: [] }])).toBe(false)
    expect(canPublish([done, { ...doc, status: 'FAILED', fields: [] }])).toBe(true)
    expect(canPublish([{ ...doc, status: 'FAILED', fields: [] }])).toBe(false)
  })
})
