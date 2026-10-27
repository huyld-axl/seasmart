import { describe, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const crypto = require('crypto')
const { createLegacyProxy, decryptPayload } = require('../legacy_proxy')

const KEY = 'test-key'
function encrypt(object, key = KEY) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(key).digest(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(object), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
}
const reply = (status, json) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => json })

describe('decryptPayload', () => {
  it('giải mã gói iv + tag + ciphertext', () => {
    expect(decryptPayload(encrypt({ data: { name: 'A' } }), KEY)).toEqual({ data: { name: 'A' } })
  })
  it('sai khoá, gói hỏng hoặc quá ngắn thì 502 và không lộ chi tiết', () => {
    for (const bad of [encrypt({ a: 1 }, 'other'), 'abc', '']) {
      expect(() => decryptPayload(bad, KEY)).toThrowError()
      try { decryptPayload(bad, KEY) } catch (error) { expect(error).toEqual({ statusCode: 502, message: 'Không đọc được dữ liệu từ nguồn ngoài' }) }
    }
  })
})

describe('legacy_proxy.fetchByImo', () => {
  const make = (fetchImpl) => createLegacyProxy({ baseUrl: 'http://x/', encKey: KEY, fetchImpl })
  it('gọi đúng đường dẫn và giải mã trường e', async () => {
    let url
    const proxy = make(async (u) => { url = u; return { status: 200, ok: true, json: async () => ({ e: encrypt({ data: { name: 'GEIYO K', imo_number: '9747613' } }) }) } })
    expect(await proxy.fetchByImo('9747613')).toEqual({ found: true, raw: { name: 'GEIYO K', imo_number: '9747613' } })
    expect(url).toBe('http://x/api/vessel/9747613')
  })
  it('nhận dữ liệu không mã hoá ở trường data', async () => {
    expect(await make(reply(200, { data: { name: 'B' } })).fetchByImo('9747613')).toEqual({ found: true, raw: { name: 'B' } })
  })
  it('404 hoặc thiếu tên tàu thì found: false', async () => {
    expect(await make(reply(404, {})).fetchByImo('9747613')).toEqual({ found: false })
    expect(await make(reply(200, { data: {} })).fetchByImo('9747613')).toEqual({ found: false })
  })
  it('hết giờ chờ và không nối được cho thông báo khác nhau', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' })
    await expect(make(async () => { throw timeout }).fetchByImo('9747613')).rejects.toEqual({ statusCode: 502, message: 'Nguồn ngoài không trả lời kịp' })
    await expect(make(async () => { throw new TypeError('fetch failed') }).fetchByImo('9747613')).rejects.toEqual({ statusCode: 502, message: 'Không kết nối được tới nguồn ngoài' })
  })
  it('lỗi nguồn, lỗi mạng, JSON hỏng đều 502', async () => {
    await expect(make(reply(500, {})).fetchByImo('9747613')).rejects.toMatchObject({ statusCode: 502 })
    await expect(make(async () => { throw new Error('ECONNREFUSED') }).fetchByImo('9747613')).rejects.toMatchObject({ statusCode: 502 })
    await expect(make(async () => ({ status: 200, ok: true, json: async () => { throw new Error('bad') } })).fetchByImo('9747613')).rejects.toMatchObject({ statusCode: 502 })
  })
})
