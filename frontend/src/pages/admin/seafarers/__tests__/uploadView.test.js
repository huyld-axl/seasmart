import { describe, it, expect } from 'vitest'
import { summaryText, serverFile, localFile, rejectReason, panelSummary, hasRunning } from '../uploadView'

const upload = (id, summary, extra = {}) => ({ id, file_name: `f${id}.pdf`, mime_type: 'application/pdf', error: null, summary: { total: 0, book: 0, certificate: 0, other: 0, to_review: 0, published: 0, phase: 'done', stalled: false, ...summary }, ...extra })

describe('tệp tải lên', () => {
  it('tóm tắt theo loại', () => {
    expect(summaryText({ book: 1 })).toBe('1 sổ thuyền viên')
    expect(summaryText({ certificate: 3, other: 1 })).toBe('3 chứng chỉ, 1 giấy khác')
    expect(summaryText({})).toBe('')
  })

  it('trạng thái tệp ở máy chủ', () => {
    expect(serverFile(upload(1, { phase: 'running' })).state).toBe('running')
    expect(serverFile(upload(1, { phase: 'running', stalled: true })).state).toBe('stuck')
    expect(serverFile(upload(1, { phase: 'failed' }, { error: 'Lỗi' }))).toMatchObject({ state: 'error', error: 'Lỗi' })
    expect(serverFile(upload(1, { phase: 'failed' }), { aiConfigured: false }).state).toBe('saved')
    expect(serverFile(upload(1, { total: 0 })).state).toBe('error')
    expect(serverFile(upload(1, { total: 2, certificate: 2, to_review: 2 }))).toMatchObject({ state: 'done', summary: '2 chứng chỉ', canReview: true })
    expect(serverFile(upload(1, { total: 1, other: 1 }))).toMatchObject({ state: 'other', summary: '1 giấy khác' })
    expect(serverFile(upload(1, { total: 1, unsorted: 1 }))).toMatchObject({ state: 'other', summary: 'Giấy khác' })
    expect(serverFile(upload(1, { total: 2, certificate: 2, published: 2 }))).toMatchObject({ state: 'done', canReview: false })
  })

  it('kiểm tệp ở máy', () => {
    expect(rejectReason({ name: 'a.docx', size: 10 })).toEqual({ state: 'unsupported' })
    expect(rejectReason({ name: 'a.pdf', size: 31.4 * 1024 * 1024 })).toEqual({ state: 'tooBig', size: '31,4 MB' })
    expect(rejectReason({ name: 'A.JPG', size: 1000 })).toBeNull()
    expect(localFile({ key: 'k', name: 'a.png', state: 'running' })).toMatchObject({ kind: 'image', state: 'running' })
  })

  it('dòng tóm tắt đầu khung', () => {
    const run = serverFile(upload(1, { phase: 'running' }))
    const done = serverFile(upload(2, { total: 3, book: 1, certificate: 2, to_review: 5 }))
    const other = serverFile(upload(3, { total: 1, other: 1 }))
    expect(panelSummary([run, done, other])).toMatchObject({ title: expect.stringContaining('Đang xử lý 1 tệp'), note: 'Xong đến đâu duyệt được đến đó.' })
    expect(panelSummary([done, other])).toEqual({ title: 'Xong: 1 sổ thuyền viên, 2 chứng chỉ, 1 giấy khác', action: 'Duyệt 5 giấy' })
    expect(panelSummary([other])).toEqual({ title: 'Xong. Giấy "Khác" chỉ lưu kèm hồ sơ, không cần duyệt.' })
    expect(panelSummary([done, localFile({ key: 'x', name: 'x.pdf', state: 'unsent' })])).toEqual({ title: '1 tệp cần bạn xử lý' })
    expect(hasRunning([run])).toBe(true)
    expect(hasRunning([done])).toBe(false)
  })
})
