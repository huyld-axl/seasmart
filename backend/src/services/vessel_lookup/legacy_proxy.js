const crypto = require('crypto')

// Nguồn "legacy_proxy": server trung gian của Crew Manning, GET {baseUrl}/api/vessel/{imo}.
// Trả { e: "<base64>" } mã hoá AES-256-GCM (khoá = sha256(encKey), gói = iv(12) + tag(16) + ciphertext) hoặc { data } không mã hoá.
function decryptPayload(base64, encKey) {
  try {
    const buffer = Buffer.from(String(base64 || ''), 'base64')
    if (buffer.length < 29) throw new Error('payload too short')
    const key = crypto.createHash('sha256').update(String(encKey)).digest()
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12))
    decipher.setAuthTag(buffer.subarray(12, 28))
    const plain = Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()])
    return JSON.parse(plain.toString('utf8'))
  } catch {
    // Không đưa chi tiết giải mã ra ngoài (tránh lộ thông tin về khoá).
    throw { statusCode: 502, message: 'Không đọc được dữ liệu từ nguồn ngoài' }
  }
}

function createLegacyProxy({ baseUrl, encKey, timeoutMs = 15000, fetchImpl = fetch }) {
  const root = String(baseUrl || '').replace(/\/$/, '')
  return {
    name: 'legacy_proxy',
    // Trả { found: true, raw } hoặc { found: false }. Lỗi mạng, lỗi nguồn, giải mã sai: ném { statusCode: 502, message }.
    async fetchByImo(imo) {
      let response
      try {
        response = await fetchImpl(`${root}/api/vessel/${imo}`, { signal: AbortSignal.timeout(timeoutMs) })
      } catch (error) {
        // Phân biệt hết giờ chờ với không nối được để người dùng và quản trị biết nên làm gì.
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
        throw { statusCode: 502, message: timedOut ? 'Nguồn ngoài không trả lời kịp' : 'Không kết nối được tới nguồn ngoài' }
      }
      if (response.status === 404) return { found: false }
      if (!response.ok) throw { statusCode: 502, message: 'Nguồn ngoài báo lỗi' }
      let json
      try {
        json = await response.json()
      } catch {
        throw { statusCode: 502, message: 'Nguồn ngoài trả dữ liệu không hợp lệ' }
      }
      const payload = json && json.e ? decryptPayload(json.e, encKey) : json
      const data = payload && payload.data
      if (!data || typeof data !== 'object' || !data.name) return { found: false }
      return { found: true, raw: data }
    },
  }
}

module.exports = { createLegacyProxy, decryptPayload }
