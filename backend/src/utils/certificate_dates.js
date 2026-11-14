const day = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value

function assertCertificateDates(data) {
  const issued = day(data.issued_date)
  const expiry = day(data.expiry_date)
  for (const value of [issued, expiry]) {
    if (value == null || value === '') continue
    const parsed = new Date(`${value}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw { statusCode: 400, message: 'Ngày cấp hoặc ngày hết hạn giấy tờ không hợp lệ' }
    }
  }
  if (data.no_expiry === true || data.no_expiry === 1) return
  if (issued && expiry && expiry < issued) {
    throw { statusCode: 400, message: 'Ngày hết hạn không được trước ngày cấp' }
  }
}

module.exports = { assertCertificateDates }
