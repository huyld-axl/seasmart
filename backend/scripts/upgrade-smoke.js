// Copies only the isolated test database. Never connects to production/legacy.
require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const mysql = require('mysql2/promise')
const config = require('../src/config')
async function main() {
  assert.equal(process.env.MCAH_TEST_CONFIRM, config.db.database)
  assert.match(config.db.database, /^mcah_.*(test|clean)$/)
  assert.ok(config.db.socketPath, 'private socket required')
  const target = `mcah_00_upgrade_${Date.now()}_test`
  console.log(`Upgrade rehearsal target: ${target}`)
  const admin = await mysql.createConnection({ ...config.db, database: undefined })
  try {
    await admin.query(`CREATE DATABASE ${target} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    const args = [`--socket=${config.db.socketPath}`, `--user=${config.db.user}`]
    const dump = spawnSync('mariadb-dump', [...args, '--skip-comments', '--skip-add-drop-table', '--order-by-primary', `--ignore-table=${config.db.database}.mcah_migration_history`, `--ignore-table=${config.db.database}.mcah_instance`, config.db.database], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    assert.equal(dump.status, 0, dump.stderr)
    const restore = spawnSync('mariadb', [...args, target], { input: dump.stdout, encoding: 'utf8' })
    assert.equal(restore.status, 0, restore.stderr)
    const before = spawnSync('mariadb-dump', [...args, '--no-create-info', '--skip-comments', '--order-by-primary', target], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    const env = { ...process.env, DB_NAME: target, MCAH_INSTANCE: target }
    const migrate = spawnSync(process.execPath, ['scripts/migrate.js', '--adopt-baseline'], { env, encoding: 'utf8' })
    console.log(migrate.stdout)
    assert.equal(migrate.status, 0, migrate.stderr)
    const after = spawnSync('mariadb-dump', [...args, '--no-create-info', '--skip-comments', '--order-by-primary', `--ignore-table=${target}.mcah_migration_history`, `--ignore-table=${target}.mcah_instance`, target], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    assert.equal(before.status, 0)
    assert.equal(after.status, 0)
    assert.equal(before.stdout, after.stdout, 'all existing table data unchanged byte-for-byte in ordered SQL dumps')
    console.log('PASS upgrade of full baseline with synthetic profiles/users/documents/exports; all pre-existing data unchanged')
    const second = spawnSync(process.execPath, ['scripts/migrate.js'], { env, encoding: 'utf8' })
    assert.equal(second.status, 0, second.stderr)
    console.log('PASS upgraded database rerun does not replay migrations')
    // No drop/cleanup: retain database as evidence; use a new target for subsequent rehearsal.
  } finally { await admin.end() }
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
