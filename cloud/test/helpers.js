// Dựng DB thử (tạo nếu chưa có, chạy migration, xoá dữ liệu) và app Fastify để gọi bằng inject.
const { Client } = require('pg')
const config = require('../src/config')

async function resetDb() {
  const admin = new Client({ ...config.db, database: 'mcah_cloud' })
  await admin.connect()
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database])
  if (!rows.length) await admin.query(`CREATE DATABASE ${config.db.database}`)
  await admin.end()
  const { migrate } = require('../scripts/migrate')
  await migrate()
  const pool = require('../src/db')
  await pool.query('TRUNCATE ship_catalog CASCADE')
  await pool.query('TRUNCATE usage, audit, login_failure, refresh_token, auth_code, invite, office_member, office_machine, office, email_token, account RESTART IDENTITY CASCADE')
}

module.exports = { resetDb }
