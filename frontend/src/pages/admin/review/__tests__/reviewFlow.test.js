import { describe, it, expect } from 'vitest'
import {
  docKind, needsTouch, touchCount, fieldView, decisionFor, pager, firstToReview, nextToReview,
  canContinue, publishState, certificateNeedsConfirm,
} from '../reviewFlow'

const field = (key, state, extra = {}) => ({ key, label: key, value: 'v', ai_value: 'v', raw: 'v', state, half: false, to_profile: false, confirm: false, ...extra })
const doc = (id, status, extra = {}) => ({ id, status, doc_type: 'seaman_book_duty', fields: [field('ship', 'PROPOSED')], ...extra })

describe('loại giấy và ô cần chạm', () => {
  it('xếp sổ, chứng chỉ, khác', () => {
    expect(docKind({ doc_type: 'seaman_book_info' })).toBe('book')
    expect(docKind({ doc_type: 'certificate' })).toBe('certificate')
    expect(docKind({ doc_type: 'other' })).toBe('other')
    expect(docKind({ doc_type: 'passport' })).toBe('other')
  })

  it('chỉ ngày chưa chắc và ô confirm còn đề xuất cần chạm', () => {
    expect(needsTouch(field('offDate', 'DATE_AMBIGUOUS'))).toBe(true)
    expect(needsTouch(field('coc', 'PROPOSED', { confirm: true }))).toBe(true)
    expect(needsTouch(field('coc', 'ACCEPTED', { confirm: true }))).toBe(false)
    expect(needsTouch(field('coc', 'EDITED', { confirm: true }))).toBe(false)
    expect(needsTouch(field('ship', 'PROPOSED'))).toBe(false)
    expect(needsTouch(field('type', 'UNKNOWN'))).toBe(false)
    expect(touchCount({ fields: [field('a', 'DATE_AMBIGUOUS'), field('coc', 'PROPOSED', { confirm: true }), field('b', 'PROPOSED')] })).toBe(2)
  })
})

describe('ô nhập', () => {
  it('đích của ô, nhãn ô cần chạm, gợi ý', () => {
    const d = doc(1, 'REVIEW_REQUIRED')
    expect(fieldView(field('rank', 'PROPOSED', { to_profile: true, normalized: { code: 'OLR', name_vi: 'Thợ máy' } }), d))
      .toMatchObject({ hint: '→ Thợ máy (OLR)' })
    expect(fieldView(field('offDate', 'DATE_AMBIGUOUS'), d)).toMatchObject({ fieldKey: 'offDate', needsConfirm: true, hint: 'Chữ viết tay, kiểm lại với bản gốc', destination: undefined })
    const book = { doc_type: 'seaman_book_info' }
    expect(fieldView(field('no', 'PROPOSED', { to_profile: true }), book).destination).toBe('profile')
    expect(fieldView(field('name', 'PROPOSED'), book).destination).toBe('compare')
    const cert = { doc_type: 'certificate' }
    expect(fieldView(field('valid', 'PROPOSED'), cert).destination).toBe('profile')
    expect(fieldView(field('holder', 'PROPOSED'), cert).destination).toBe('compare')
    expect(fieldView(field('coc', 'PROPOSED', { confirm: true }), d)).toMatchObject({ mono: true, needsConfirm: true })
    expect(fieldView(field('coc', 'ACCEPTED', { confirm: true }), d).needsConfirm).toBe(true)
    expect(fieldView(field('x', 'UNKNOWN', { value: 'zzz' }), d).value).toBe('')
  })

  it('gõ vào ô: trống thì giữ trống, khác thì sửa, về giá trị AI thì hoàn tác, không đổi thì bỏ qua', () => {
    expect(decisionFor(field('a', 'PROPOSED'), '  ')).toEqual({ action: 'keepUnknown' })
    expect(decisionFor(field('a', 'PROPOSED'), 'v')).toBeNull()
    expect(decisionFor(field('a', 'PROPOSED'), ' x ')).toEqual({ action: 'edit', value: 'x' })
    expect(decisionFor(field('a', 'EDITED', { value: 'x', ai_value: 'v' }), 'v')).toEqual({ action: 'undo' })
    expect(decisionFor(field('a', 'EDITED', { value: 'x', ai_value: 'v' }), 'x')).toBeNull()
  })
})

describe('chuyển giấy', () => {
  const docs = [doc(1, 'COMPLETED'), doc(2, 'REVIEW_REQUIRED'), doc(3, 'COMPLETED'), doc(4, 'REVIEW_REQUIRED')]

  it('bộ chuyển Giấy n/tổng', () => {
    expect(pager(docs, 1)).toEqual({ index: 1, total: 4, prevId: null, nextId: 2 })
    expect(pager(docs, 4)).toEqual({ index: 4, total: 4, prevId: 3, nextId: null })
  })

  it('giấy đầu tiên còn việc và giấy kế tiếp còn việc (vòng lại)', () => {
    expect(firstToReview(docs)).toBe(2)
    expect(firstToReview([doc(1, 'COMPLETED')])).toBe(1)
    expect(nextToReview(docs, 2)).toBe(4)
    expect(nextToReview(docs, 4)).toBe(2)
    expect(nextToReview([doc(1, 'COMPLETED')], 1)).toBeNull()
  })

  it('qua giấy kế khi hết ô cần chạm; giấy khác (không ô) luôn qua được', () => {
    expect(canContinue(doc(1, 'REVIEW_REQUIRED'))).toBe(true)
    expect(canContinue(doc(1, 'REVIEW_REQUIRED', { fields: [field('coc', 'PROPOSED', { confirm: true })] }))).toBe(false)
    expect(canContinue(doc(1, 'READING'))).toBe(false)
    expect(canContinue(doc(1, 'SKIPPED', { doc_type: 'other', fields: [] }))).toBe(true)
  })

  it('chứng chỉ chờ duyệt có nút xác nhận riêng', () => {
    expect(certificateNeedsConfirm(doc(1, 'REVIEW_REQUIRED', { doc_type: 'certificate' }))).toBe(true)
    expect(certificateNeedsConfirm(doc(1, 'COMPLETED', { doc_type: 'certificate' }))).toBe(false)
  })
})

describe('nút Đưa vào hồ sơ', () => {
  it('chặn kèm lý do, cùng luật với backend', () => {
    const s = publishState([doc(1, 'COMPLETED'), doc(2, 'REVIEW_REQUIRED'), doc(3, 'READING')])
    expect(s.canPublish).toBe(false)
    expect(s.reasons).toEqual(['Còn 1 giấy đang đọc', 'Còn 1 giấy chưa duyệt'])
  })

  it('khác người chưa xác nhận chặn; xong hết thì cho', () => {
    expect(publishState([doc(1, 'COMPLETED', { owner_mismatch: true, owner_mismatch_confirmed: false })]).reasons[0]).toContain('mang tên khác')
    expect(publishState([doc(1, 'COMPLETED'), doc(2, 'SKIPPED', { doc_type: 'other', fields: [] })]).canPublish).toBe(true)
  })

  it('không có giấy nào xong hoặc chỉ giấy đã vào hồ sơ thì không đưa vào được', () => {
    expect(publishState([doc(1, 'PUBLISHED')]).canPublish).toBe(false)
    expect(publishState([]).reasons).toEqual(['Chưa có giấy nào duyệt xong để đưa vào hồ sơ'])
  })
})
