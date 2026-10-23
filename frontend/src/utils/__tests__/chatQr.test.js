import { describe, it, expect } from 'vitest'
import { parseChatQr, chatHref, isLink } from '../chatQr'

describe('parseChatQr', () => {
  it('WhatsApp có số thì lấy số', () => {
    expect(parseChatQr('https://wa.me/6591234567')).toEqual({ channel: 'whatsapp', value: '+6591234567' })
    expect(parseChatQr('https://api.whatsapp.com/send?phone=6591234567&text=hi')).toEqual({ channel: 'whatsapp', value: '+6591234567' })
  })
  it('WhatsApp mã wa.me/qr chỉ có đường dẫn thì giữ đường dẫn', () => {
    expect(parseChatQr('https://wa.me/qr/ABCDEF123')).toEqual({ channel: 'whatsapp', value: 'https://wa.me/qr/ABCDEF123' })
  })
  it('LINE có ID thì lấy ID, mã ngẫu nhiên thì giữ đường dẫn', () => {
    expect(parseChatQr('https://line.me/ti/p/~weiming.tan')).toEqual({ channel: 'line', value: 'weiming.tan' })
    expect(parseChatQr('https://line.me/R/ti/p/~weiming.tan')).toEqual({ channel: 'line', value: 'weiming.tan' })
    expect(parseChatQr('https://line.me/ti/p/aBcD1234')).toEqual({ channel: 'line', value: 'https://line.me/ti/p/aBcD1234' })
  })
  it('WeChat chỉ có đường dẫn kết bạn', () => {
    expect(parseChatQr('https://u.wechat.com/MAbCdEf')).toEqual({ channel: 'wechat', value: 'https://u.wechat.com/MAbCdEf' })
  })
  it('Zalo theo số điện thoại', () => {
    expect(parseChatQr('https://zalo.me/0912345678')).toEqual({ channel: 'zalo', value: '0912345678' })
  })
  it('mã không phải chat thì bỏ', () => {
    expect(parseChatQr('https://example.com/x')).toBeNull()
    expect(parseChatQr('hello')).toBeNull()
    expect(parseChatQr('')).toBeNull()
  })
})

describe('chatHref', () => {
  it('giá trị là đường dẫn thì mở thẳng', () => {
    expect(isLink('https://u.wechat.com/abc')).toBe(true)
    expect(chatHref('wechat', 'https://u.wechat.com/abc')).toBe('https://u.wechat.com/abc')
  })
  it('dựng đường dẫn từ số / ID', () => {
    expect(chatHref('whatsapp', '+65 9123 4567')).toBe('https://wa.me/6591234567')
    expect(chatHref('line', 'an.tan')).toBe('https://line.me/ti/p/~an.tan')
  })
  it('WeChat theo ID hay giá trị rỗng thì không có đường dẫn', () => {
    expect(chatHref('wechat', 'wm_tan')).toBeNull()
    expect(chatHref('line', '')).toBeNull()
  })
})
