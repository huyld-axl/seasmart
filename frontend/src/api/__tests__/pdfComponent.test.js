// client.js: máy chủ báo thiếu LibreOffice (424 PDF_COMPONENT_MISSING) → app máy tính mời cài, cài xong gửi lại yêu cầu.
import { afterEach, describe, expect, it, vi } from 'vitest'
import api from '../client'
import usePdfComponentStore from '../../stores/pdfComponentStore'

function adapterFailingOnce(body) {
  let calls = 0
  return vi.fn(async (config) => {
    calls += 1
    if (calls === 1) {
      const error = new Error('424')
      error.config = config
      error.response = { status: 424, data: body, config, headers: {} }
      throw error
    }
    return { data: 'pdf', status: 200, statusText: 'OK', headers: {}, config }
  })
}

describe('thiếu thành phần xuất PDF', () => {
  afterEach(() => {
    delete window.mcah
    usePdfComponentStore.setState({ open: false, resolvers: [] })
  })

  it('app máy tính: hỏi cài, cài xong gửi lại đúng yêu cầu (kể cả lỗi dạng blob)', async () => {
    window.mcah = {}
    const adapter = adapterFailingOnce(new Blob([JSON.stringify({ code: 'PDF_COMPONENT_MISSING' })], { type: 'application/json' }))
    const pending = api.get('/exports/1/download', { adapter, responseType: 'blob' })
    await vi.waitFor(() => expect(usePdfComponentStore.getState().open).toBe(true))
    usePdfComponentStore.getState().finish(true)
    await expect(pending).resolves.toMatchObject({ data: 'pdf' })
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('bản web: không hỏi, trả lỗi để nơi gọi báo', async () => {
    const adapter = adapterFailingOnce({ code: 'PDF_COMPONENT_MISSING', error: 'Máy chưa có thành phần xuất PDF' })
    await expect(api.get('/exports/1/download', { adapter })).rejects.toMatchObject({ response: { status: 424 } })
    expect(usePdfComponentStore.getState().open).toBe(false)
  })
})
