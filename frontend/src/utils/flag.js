// Mã quốc gia 2 chữ (ISO 3166-1 alpha-2) → emoji cờ. Mã không hợp lệ thì trả chuỗi rỗng.
export function flagEmoji(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

// "🇻🇳 Việt Nam": cờ bên trái tên nước, thiếu cờ thì chỉ có tên.
export function withFlag(code, name) {
  return [flagEmoji(code), name].filter(Boolean).join(' ')
}
