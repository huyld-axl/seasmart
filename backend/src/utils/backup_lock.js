// Khoá dùng chung với bản chụp dữ liệu của app máy tính (desktop/src/backup.js LOCK_KEY): job xoá tệp 180 ngày và job
// sắp thư mục hồ sơ chỉ chạy khi không có bản chụp đang chép tệp; đang chụp thì bỏ lượt, lần sau chạy.
const pool = require('../config/db')

const LOCK_KEY = 741930277

async function unlessBackingUp(fn) {
  const client = await pool.native.connect()
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY])
    if (!rows[0].ok) return { skipped: true }
    try {
      return await fn()
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    }
  } finally {
    client.release()
  }
}

module.exports = { unlessBackingUp, LOCK_KEY }
