const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const db = require('../src/config/db')

async function migrate() {
  const client = await db.native.connect()
  try {
    await client.query('SELECT pg_advisory_lock(741930271)')
    await client.query('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    const dir = path.join(__dirname, '../migrations/postgres')
    for (const name of fs.readdirSync(dir).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
      const sql = fs.readFileSync(path.join(dir, name), 'utf8')
      const checksum = crypto.createHash('sha256').update(sql).digest('hex')
      const { rows } = await client.query('SELECT checksum FROM schema_migration WHERE name = $1', [name])
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`)
        continue
      }
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migration (name, checksum) VALUES ($1, $2)', [name, checksum])
        await client.query('COMMIT')
        console.log(`Applied ${name}`)
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`Migration failed: ${name} (${error.code || 'UNKNOWN'})`)
        throw error
      }
    }
    console.log('PostgreSQL migrations complete')
  } finally {
    await client.query('SELECT pg_advisory_unlock(741930271)').catch(() => {})
    client.release()
  }
}
migrate().catch((error) => {
  console.error(error.code ? `Migration error (${error.code})` : error.message)
  process.exitCode = 1
}).finally(() => db.end())
