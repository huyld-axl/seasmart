require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const mysql = require('mysql2/promise')
const { spawnSync } = require('node:child_process')
const config = require('../src/config')
async function main() {
  assert.equal(process.env.MCAH_TEST_CONFIRM, config.db.database)
  assert.match(config.db.database, /^mcah_.*(test|clean)$/)
  assert.ok(config.db.socketPath, 'private test socket required')
  const target = `mcah_00_install_${Date.now()}_test`
  const conn = await mysql.createConnection({ ...config.db, database: undefined })
  try {
    await conn.query(`CREATE DATABASE ${target} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    const env = { ...process.env, DB_NAME: target, MCAH_INSTANCE: target }
    const first = spawnSync(process.execPath, ['scripts/migrate.js'], { env, encoding: 'utf8' })
    console.log(first.stdout)
    assert.equal(first.status, 0, first.stderr)
    await conn.changeUser({ database: target })
    const [[counts]] = await conn.query('SELECT (SELECT COUNT(*) FROM seafarer) AS profiles, (SELECT COUNT(*) FROM `user`) AS users')
    assert.deepEqual(counts, { profiles: 0, users: 0 })
    console.log('PASS clean database has no personal profiles or default users')
    const [before] = await conn.query('SELECT * FROM mcah_migration_history ORDER BY name')
    const rerun = spawnSync(process.execPath, ['scripts/migrate.js'], { env, encoding: 'utf8' })
    assert.equal(rerun.status, 0, rerun.stderr)
    const [after] = await conn.query('SELECT * FROM mcah_migration_history ORDER BY name')
    assert.deepEqual(before, after)
    console.log('PASS second migration run preserves history timestamps/checksums and does not replay SQL')
    const bootstrap = spawnSync(process.execPath, ['scripts/bootstrap-admin.js'], { env: { ...env, BOOTSTRAP_ADMIN_EMAIL: '', BOOTSTRAP_ADMIN_PASSWORD: '' }, encoding: 'utf8' })
    assert.equal(bootstrap.status, 1)
    console.log('PASS bootstrap refuses missing credentials; no default login created')
  } finally { await conn.end() }
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
