// Mã QR kết bạn của WhatsApp, LINE, WeChat, Zalo → kênh và giá trị để điền vào ô liên hệ.
// Có số / ID thì lấy số / ID; mã QR chỉ chứa đường dẫn kết bạn (WhatsApp wa.me/qr/…, LINE line.me/R/ti/p/…, WeChat u.wechat.com/…) thì giữ nguyên đường dẫn.

const URL_RE = /^https?:\/\//i
export const isLink = (value) => URL_RE.test(String(value || '').trim())

const safeUrl = (text) => {
  try {
    return new URL(text.trim())
  } catch {
    return null
  }
}

// Trả { channel: 'whatsapp' | 'line' | 'wechat' | 'zalo', value } hoặc null nếu không phải mã chat nào biết.
export function parseChatQr(text) {
  const raw = String(text || '').trim()
  const url = safeUrl(raw)
  if (!url) return null
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '')

  if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'wa.link') {
    const phone = host === 'api.whatsapp.com' ? url.searchParams.get('phone') : path.slice(1)
    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length >= 6 && /^\+?[\d\s-]+$/.test(String(phone))) return { channel: 'whatsapp', value: `+${digits}` }
    return { channel: 'whatsapp', value: raw }
  }
  if (host === 'line.me' || host === 'lin.ee') {
    const id = path.match(/\/ti\/p\/~?(.+)$/)?.[1]
    if (host === 'line.me' && id && path.includes('/ti/p/~')) return { channel: 'line', value: id }
    return { channel: 'line', value: raw }
  }
  if (host === 'u.wechat.com' || host === 'weixin.qq.com' || host === 'wechat.com') return { channel: 'wechat', value: raw }
  if (host === 'zalo.me') {
    const digits = path.slice(1).replace(/\D/g, '')
    if (digits.length >= 8 && /^\+?\d+$/.test(path.slice(1))) return { channel: 'zalo', value: path.slice(1) }
    return null
  }
  return null
}

// Đường dẫn mở app chat cho giá trị đã lưu: là đường dẫn thì dùng luôn, còn lại dựng theo kênh. WeChat theo ID thì không có đường dẫn.
export function chatHref(channel, value) {
  const v = String(value || '').trim()
  if (!v) return null
  if (isLink(v)) return v
  if (channel === 'whatsapp') return `https://wa.me/${v.replace(/\D/g, '')}`
  if (channel === 'line') return `https://line.me/ti/p/~${encodeURIComponent(v)}`
  return null
}
