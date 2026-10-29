// Nội dung thư gửi chủ tàu (điền sẵn trong hộp soạn thư). Hàm thuần, có test.

const dmy = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '')
// Bỏ dấu tiếng Việt cho tên trong thư tiếng Anh.
const ascii = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')

// Người liên hệ nhận thư: liên hệ chính có email, không thì liên hệ đầu tiên có email.
export function pickContact(contacts = []) {
  return contacts.find((c) => c.is_primary && c.email) || contacts.find((c) => c.email) || null
}

export function mailSubject(o) {
  const rank = o.rank_name_en || o.rank_name
  return `${rank} candidates for ${o.vessel_name || 'your vessel'} · join ${dmy(o.planned_join_date)}`
}

export function mailBody(o, contact, people, sender) {
  const rank = o.rank_name_en || o.rank_name
  const lines = people.map((p, i) => `${i + 1}. ${ascii(p.full_name).toUpperCase()}`)
  return [
    `Dear ${contact?.name ? ascii(contact.name) : 'Sir/Madam'},`,
    '',
    `Please find attached ${people.length} candidate${people.length > 1 ? 's' : ''} for ${rank} on ${o.vessel_name || 'your vessel'}, joining ${dmy(o.planned_join_date)}.`,
    ...lines,
    '',
    'Best regards,',
    ascii(sender) || 'MCAH',
  ].join('\n')
}
