require('dotenv').config({ quiet: true })
const pool = require('../src/config/db')
const bcrypt = require('bcrypt')
const { migrationStatus } = require('../src/config/migrations')
async function bootstrap() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (at least 12 chars) required')
  }
  if (!await migrationStatus(pool)) throw new Error('Run MCAH migrations first')
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT role, is_active, deleted_at FROM `user` WHERE email = ? FOR UPDATE', [email])
    if (rows[0]) {
      if (rows[0].role !== 'admin' || !rows[0].is_active || rows[0].deleted_at) throw new Error('Existing bootstrap email is not an active admin; no account overwritten')
      console.log('Admin already exists; password unchanged')
    } else {
      await conn.query('INSERT INTO `user` (email, password_hash, role, verification_status) VALUES (?, ?, \'admin\', \'verified\')', [email, await bcrypt.hash(password, 12)])
      console.log('MCAH admin created')
    }
    await conn.commit()
  } catch (err) { await conn.rollback(); throw err } finally { conn.release() }
}
bootstrap().catch(err => { console.error(err.message); process.exitCode = 1 }).finally(() => pool.end())
