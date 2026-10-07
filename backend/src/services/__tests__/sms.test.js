import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { smsService, toAscii, normalizePhone, maskPhone } = require('../sms.service')

describe('sms', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('bỏ dấu và chuẩn hoá số', () => {
    expect(toAscii('Mời ký bộ giấy Đã')).toBe('Moi ky bo giay Da')
    expect(normalizePhone('0912 345 678')).toBe('+84912345678')
    expect(normalizePhone('+84912345678')).toBe('+84912345678')
    expect(normalizePhone('12345')).toBeNull()
    expect(maskPhone('+84912345678')).toBe('+84912***678')
  })

  it('chưa cấu hình thì 503, không gửi', async () => {
    vi.stubEnv('SMS_WEBHOOK_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(smsService.send('+84912345678', 'x')).rejects.toMatchObject({ statusCode: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cổng từ chối thì báo lỗi, không coi là đã gửi', async () => {
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.example.test/send')
    vi.stubEnv('APP_URL', 'https://app.example.test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(smsService.send('+84912345678', 'x')).rejects.toMatchObject({ statusCode: 502 })
  })

  it('gửi được thì trả số đã che', async () => {
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.example.test/send')
    vi.stubEnv('APP_URL', 'https://app.example.test')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    await expect(smsService.send('+84912345678', 'Mời ký')).resolves.toEqual({ sent_to: '+84912***678' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ to: '+84912345678', text: 'Moi ky' })
  })
})
