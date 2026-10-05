import dayjs from 'dayjs'

function parseDdmmyyyy(s) {
  if (!s || s.length !== 8) return null
  const d = dayjs(`${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`)
  return d.isValid() ? d : null
}

/**
 * Parse QR data from Vietnamese CCCD.
 * Format: cccd|old_id|full_name|DDMMYYYY_dob|gender|address|DDMMYYYY_issued
 * Address format: street, ward, district, province
 */
export function parseCccdQr(raw) {
  const parts = raw.split('|')
  if (parts.length < 7) return null

  const addrStr = parts[5] || ''
  const addrParts = addrStr.split(', ')
  const n = addrParts.length

  const genderRaw = parts[4]?.trim()

  return {
    national_id: parts[0]?.trim() || '',
    full_name: parts[2]?.trim() || '',
    date_of_birth: parseDdmmyyyy(parts[3]?.trim()),
    gender: genderRaw === 'Nam' ? 'M' : genderRaw === 'Nữ' ? 'F' : undefined,
    permanent_province: n >= 1 ? addrParts[n - 1].trim() : '',
    permanent_district: n >= 2 ? addrParts[n - 2].trim() : '',
    permanent_ward: n >= 3 ? addrParts[n - 3].trim() : '',
    permanent_address:
      n > 3
        ? addrParts
            .slice(0, n - 3)
            .join(', ')
            .trim()
        : '',
    national_id_issued_date: parseDdmmyyyy(parts[6]?.trim()),
  }
}
