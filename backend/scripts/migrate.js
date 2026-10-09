require('dotenv').config({ quiet: true })
const mysql = require('mysql2/promise')
const fs = require('fs')
const config = require('../src/config')
const { migrationPlan } = require('../src/config/migrations')

async function migrate() {
  // Database creation is a DBA operation: runner only touches explicitly confirmed existing MCAH DB.
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true })
  let locked = false
  try {
    const [[{ version }]] = await conn.query('SELECT VERSION() AS version')
    if (!/^(10\.(6|[7-9]|1[0-9])|11\.)/.test(version) || !version.includes('MariaDB')) {
      throw new Error('Supported engine: MariaDB 10.6+ or 11.x (SQL uses ADD/INDEX IF NOT EXISTS)')
    }
    console.log(`MCAH target: ${config.db.database}; engine: ${version}`)
    const [[{ acquired }]] = await conn.query('SELECT GET_LOCK(?, 10) AS acquired', [`${config.db.database}:mcah_migrate`])
    if (acquired !== 1) throw new Error('Migration lock unavailable')
    locked = true
    const [tables] = await conn.query('SHOW TABLES')
    const names = tables.map(row => Object.values(row)[0])
    if (names.length && !names.includes('mcah_migration_history') && !process.argv.includes('--adopt-baseline')) {
      throw new Error('Existing database without history: backup then use --adopt-baseline after verifying MCAH target')
    }
    if (process.argv.includes('--adopt-baseline') && !names.includes('mcah_migration_history')) {
      const manifest = require('./mcah-baseline-schema.json')
      for (const [table, columns] of Object.entries(manifest)) {
        const [actual] = await conn.query('SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [config.db.database, table])
        for (const column of columns) {
          if (!actual.some(c => c.name === column.name && c.type === column.type)) throw new Error(`Baseline mismatch: ${table}.${column.name}; manual upgrade required`)
        }
      }
      const keys = require('./mcah-baseline-keys.json')
      for (const [table, expected] of Object.entries(keys)) {
        const [indexes] = await conn.query('SELECT INDEX_NAME AS name, COLUMN_NAME AS col, NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS pos FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX', [table])
        const [constraints] = await conn.query('SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_col, ORDINAL_POSITION AS pos FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION', [table])
        for (const [kind, rows] of Object.entries({ indexes, constraints })) {
          if (!expected[kind].every(row => rows.some(actual => JSON.stringify(actual) === JSON.stringify(row)))) {
            throw new Error(`Baseline mismatch: ${table} ${kind}; manual upgrade required`)
          }
        }
      }
    }
    await conn.query(`CREATE TABLE IF NOT EXISTS mcah_migration_history (
      name VARCHAR(150) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      state VARCHAR(20) NOT NULL, applied_at DATETIME NULL, note VARCHAR(255) NULL
    ) ENGINE=InnoDB`)
    if (process.argv.includes('--adopt-baseline') && !names.includes('mcah_migration_history')) {
      for (const entry of migrationPlan().filter(e => e.name < '021')) {
        await conn.query('INSERT INTO mcah_migration_history VALUES (?, ?, \'APPLIED\', NOW(), ?)', [entry.name, entry.checksum, 'Adopted verified existing baseline; no SQL replay'])
      }
    }
    for (const entry of migrationPlan()) {
      const [rows] = await conn.query('SELECT * FROM mcah_migration_history WHERE name = ?', [entry.name])
      if (rows[0]) {
        if (rows[0].checksum !== entry.checksum) throw new Error(`Checksum changed: ${entry.name}`)
        if (rows[0].state !== 'APPLIED') throw new Error(`Incomplete migration ${entry.name}: inspect/repair from backup; no automatic DDL replay`)
        continue
      }
      await conn.query('INSERT INTO mcah_migration_history (name, checksum, state) VALUES (?, ?, \'RUNNING\')', [entry.name, entry.checksum])
      // 011 contains personal sample records and is intentionally never executed.
      if (!entry.skipped) await conn.query(fs.readFileSync(entry.file, 'utf8'))
      await conn.query('UPDATE mcah_migration_history SET state = \'APPLIED\', applied_at = NOW(), note = ? WHERE name = ?', [entry.skipped ? 'Skipped personal seed by MCAH policy' : null, entry.name])
      console.log(`${entry.skipped ? 'SKIPPED personal seed' : 'APPLIED'} ${entry.name}`)
    }
  } finally {
    if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [`${config.db.database}:mcah_migrate`])
    await conn.end()
  }
}
migrate().catch(err => { console.error(err.message); process.exitCode = 1 })
