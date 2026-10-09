const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const base = path.resolve(__dirname, '../..')
function migrationPlan() {
  const entries = [{ name: '000_schema.sql', file: path.join(base, '../migration.sql') }]
  for (const name of fs.readdirSync(path.join(base, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
    entries.push({ name, file: path.join(base, 'migrations', name) })
  }
  return entries.map(entry => ({ ...entry,
    checksum: crypto.createHash('sha256').update(fs.readFileSync(entry.file)).digest('hex'),
    skipped: entry.name === '011_seed_seafarer.sql',
  }))
}
async function migrationStatus(conn) {
  const [rows] = await conn.query('SELECT name, checksum FROM mcah_migration_history WHERE state = \'APPLIED\'')
  return migrationPlan().every(entry => rows.some(row => row.name === entry.name && row.checksum === entry.checksum))
}
module.exports = { migrationPlan, migrationStatus }
