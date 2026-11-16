const shown = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 20 })

export function parseNumericInput(text) {
  const raw = String(text ?? '')
  const clean = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')
  if (clean === '') return null
  return raw.trim().startsWith('-') ? -Number(clean) : Number(clean)
}

export function formatNumericInput(value, info) {
  if (!info?.userTyping) {
    return value === '' || value == null ? '' : shown.format(Number(value))
  }

  // Group digits without converting to a number, preserving a trailing comma and decimal zeros.
  const raw = String(info.input ?? '')
  const [integer, fraction] = raw.replace(/\./g, '').replace(/[^\d,]/g, '').split(',')
  const sign = raw.trim().startsWith('-') ? '-' : ''
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return sign + grouped + (fraction === undefined ? '' : `,${fraction}`)
}