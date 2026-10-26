// Gửi chủ tàu qua app mail mặc định của máy (mailto). Hàm thuần, có test.
import { MAILTO_MAX } from '../../../constants/opportunityVoyage'

const dmy = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '')
// Bỏ dấu tiếng Việt cho tên trong thư tiếng Anh.
const ascii = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')

// Người liên hệ nhận thư: liên hệ chính có email, không thì liên hệ đầu tiên có email.
export function pickContact(contacts = []) {
  return contacts.find((c) => c.is_primary && c.email) || contacts.find((c) => c.email) || null
}

export function mailSubject(o) {
  const rank = o.rank_name_en || o.rank_name
  const port = o.planned_join_port_name ? ` ${ascii(o.planned_join_port_name)}` : ''
  return `MCAH · ${rank} candidates for ${o.vessel_name || 'your vessel'} · join ${dmy(o.planned_join_date)}${port}`
}

export function mailBody(o, contact, people, sender, { limit = null } = {}) {
  const rank = o.rank_name_en || o.rank_name
  const shown = limit == null ? people : people.slice(0, limit)
  const lines = shown.map((p, i) => `${i + 1}. ${ascii(p.full_name).toUpperCase()}`)
  if (shown.length < people.length) lines.push(`and ${people.length - shown.length} more, see attachments`)
  return [
    `Dear ${contact?.name ? ascii(contact.name) : 'Sir/Madam'},`,
    '',
    `Please find attached ${people.length} candidate${people.length > 1 ? 's' : ''} for ${rank} on ${o.vessel_name || 'your vessel'}, joining ${dmy(o.planned_join_date)}.`,
    ...lines,
    '',
    'Best regards,',
    sender || 'MCAH',
  ].join('\n')
}

// URL mailto: tới, CC, tiêu đề, nội dung. Dài quá MAILTO_MAX thì bỏ bớt dòng tên, thêm "and N more".
export function buildMailto({ opportunity, contact, people, cc, sender }) {
  const make = (limit) => {
    const query = [
      cc ? `cc=${encodeURIComponent(cc)}` : null,
      `subject=${encodeURIComponent(mailSubject(opportunity))}`,
      `body=${encodeURIComponent(mailBody(opportunity, contact, people, sender, { limit }))}`,
    ].filter(Boolean).join('&')
    return `mailto:${encodeURIComponent(contact.email)}?${query}`
  }
  let limit = people.length
  let url = make(null)
  while (url.length > MAILTO_MAX && limit > 0) {
    limit -= 1
    url = make(limit)
  }
  return url
}
