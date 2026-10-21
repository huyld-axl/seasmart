// One-time copy from an existing project MySQL container into empty PostgreSQL.
// Neither credentials nor row contents are logged. The MySQL source is read-only.
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { readSource: readMysqlSource } = require('./mysql_source')

const root = path.resolve(__dirname, '../..')
const container = process.argv[2] || 'seasmart-mysql'
if (!/^[a-zA-Z0-9_.-]+$/.test(container)) throw new Error('Invalid MySQL container name')
const env = dotenv.parse(fs.readFileSync(path.join(root, 'docker/postgres.env')))
Object.assign(process.env, env, {
  DB_HOST: '127.0.0.1', DB_PORT: process.env.POSTGRES_PORT || '5433',
  DB_USER: env.POSTGRES_USER, DB_PASSWORD: env.POSTGRES_PASSWORD, DB_NAME: env.POSTGRES_DB,
  JWT_SECRET_FILE: path.join(root, 'docker/jwt_secret'),
})
const db = require('../src/config/db')
const references = new Set(['rank', 'certificate_type', 'vessel_type', 'country', 'contract_type', 'port'])
const identifier = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid table or column')
  return `"${name}"`
}
function readSource(sql) {
  return readMysqlSource(container, sql)
}

async function copy() {
  const client = await db.native.connect()
  try {
    await client.query('SELECT pg_advisory_lock(741930271)')
    const { rows: columns } = await client.query("SELECT table_name, column_name, is_generated FROM information_schema.columns WHERE table_schema='public' AND table_name NOT IN ('schema_migration', 'legacy_import') ORDER BY table_name, ordinal_position")
    const tables = [...new Set(columns.map((c) => c.table_name))]
    await client.query('BEGIN')
    await client.query('SET CONSTRAINTS ALL DEFERRED')
    for (const table of tables.filter((table) => !references.has(table))) {
      const { rows } = await client.query(`SELECT COUNT(*)::integer AS count FROM ${identifier(table)}`)
      if (rows[0].count) throw new Error('Target PostgreSQL contains application records; import aborted without changes')
    }
    // Replace only freshly seeded reference rows, then preserve all source IDs.
    await client.query(`TRUNCATE ${tables.map(identifier).join(', ')} RESTART IDENTITY`)
    let total = 0
    for (const table of tables) {
      const sourceCols = readSource(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`).split('\n')
      const names = columns.filter((c) => c.table_name === table && c.is_generated === 'NEVER' && sourceCols.includes(c.column_name)).map((c) => c.column_name)
      if (!names.length) throw new Error(`Source table missing: ${table}`)
      const select = names.flatMap((name) => [`'${name}'`, `CAST(\`${name}\` AS CHAR)`]).join(', ')
      const raw = readSource(`SELECT JSON_OBJECT(${select}) FROM \`${table}\` ORDER BY id`)
      const records = raw ? raw.split('\n').map((line) => JSON.parse(line)) : []
      const sql = `INSERT INTO ${identifier(table)} (${names.map(identifier).join(', ')}) VALUES (${names.map((_,i) => `$${i+1}`).join(', ')})`
      for (const row of records) {
        if (table === 'export_pack') { row.status = 'DONE'; row.sign_token = null; row.sign_token_expires_at = null }
        await client.query(sql, names.map((name) => row[name]))
      }
      await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${identifier(table)}`, [table])
      total += records.length
    }
    await client.query('CREATE TABLE IF NOT EXISTS legacy_import (source TEXT PRIMARY KEY, imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
    await client.query('INSERT INTO legacy_import (source) VALUES ($1)', [container])
    await client.query('COMMIT')
    console.log(`Copied ${total} records across ${tables.length} tables. MySQL source unchanged.`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(error.code ? `Import failed (${error.code}); target changes rolled back` : error.message)
    process.exitCode = 1
  } finally {
    await client.query('SELECT pg_advisory_unlock(741930271)').catch(() => {})
    client.release()
  }
}
copy().catch(() => { console.error('Import connection failed'); process.exitCode = 1 }).finally(() => db.end())
