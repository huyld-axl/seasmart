'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mysql = require('mysql2/promise')
const bcrypt = require('bcrypt')

const EMAIL = process.env.ADMIN_EMAIL || 'admin@crewmanning.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'crewmanning@2026'

async function main() {
  const pool = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'marineport',
  })

  try {
    const [existing] = await pool.query(
      'SELECT id FROM `user` WHERE email = ? AND deleted_at IS NULL',
      [EMAIL]
    )

    if (existing.length > 0) {
      console.log(`Admin đã tồn tại: ${EMAIL}`)
      return
    }

    const hash = await bcrypt.hash(PASSWORD, 10)

    await pool.query(
      `INSERT INTO \`user\` (email, password_hash, role, verification_status, is_active)
       VALUES (?, ?, 'admin', 'verified', 1)`,
      [EMAIL, hash]
    )

    console.log(`✓ Tạo admin thành công: ${EMAIL}`)
    console.log(`  Password: ${PASSWORD}`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Lỗi:', err.message)
  process.exit(1)
})
