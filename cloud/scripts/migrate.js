// Chạy migrations/*.sql theo thứ tự, mỗi tệp một transaction, nhớ tệp đã chạy và mã băm.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const pool = require('../src/db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    const dir = path.join(__dirname, '../migrations')
    for (const name of fs.readdirSync(dir).filter((n) => /^\d+.*\.sql$/.test(n)).sort()) {
      const sql = fs.readFileSync(path.join(dir, name), 'utf8')
      const checksum = crypto.createHash('sha256').update(sql).digest('hex')
      const { rows } = await client.query('SELECT checksum FROM schema_migration WHERE name = $1', [name])
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Migration đã chạy bị sửa: ${name}`)
        continue
      }
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migration (name, checksum) VALUES ($1, $2)', [name, checksum])
        await client.query('COMMIT')
        console.log(`Đã chạy ${name}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
  }
}

if (require.main === module) {
  migrate().then(() => console.log('Migration xong')).catch((e) => { console.error(e.message); process.exitCode = 1 }).finally(() => pool.end())
}

module.exports = { migrate }
