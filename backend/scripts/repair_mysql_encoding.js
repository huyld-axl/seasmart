// Restore only unchanged values that match the old latin1 import exactly.
// Default is a dry run. Row contents, credentials and hashes are never logged.
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Client } = require('pg')
const { readSource } = require('./mysql_source')

const apply = process.argv.includes('--apply')
const container = process.env.MYSQL_SOURCE_CONTAINER || 'seasmart-mysql'
const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../docker/postgres.env')))
const identifier = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid SQL identifier')
  return `"${name}"`
}
const canonical = (value) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item)
function restoreJson(current, bad, good) {
  if (canonical(bad) === canonical(good)) return current
  if (canonical(current) === canonical(bad)) return good
  if (current && bad && good && typeof current === 'object' && typeof bad === 'object' && typeof good === 'object') {
    if (Array.isArray(current) !== Array.isArray(bad) || Array.isArray(current) !== Array.isArray(good)) return current
    const next = Array.isArray(current) ? [...current] : { ...current }
    for (const key of Object.keys(current)) {
      if (Object.hasOwn(bad, key) && Object.hasOwn(good, key)) next[key] = restoreJson(current[key], bad[key], good[key])
    }
    return next
  }
  return current
}

async function repair() {
  const db = new Client({ host: '127.0.0.1', port: Number(process.env.POSTGRES_PORT || 5433), user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB })
  await db.connect()
  try {
    const { rows: columns } = await db.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND (data_type IN ('character varying','character','text','jsonb') OR udt_name='citext') AND table_name NOT IN ('schema_migration','legacy_import') ORDER BY table_name,ordinal_position")
    const tables = [...new Set(columns.map((column) => column.table_name))]
    const plans = []
    for (const table of tables) {
      const sourceCols = readSource(container, `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='${table}'`).split('\n')
      const fields = columns.filter((column) => column.table_name === table && sourceCols.includes(column.column_name))
      if (!fields.length) continue
      const pairs = ['\'id\'', 'id', ...fields.flatMap(({ column_name: name }) => [`'${name}'`, `CAST(\`${name}\` AS CHAR)`])].join(', ')
      const sql = `SELECT JSON_OBJECT(${pairs}) FROM \`${table}\` ORDER BY id`
      const parse = (raw) => raw ? raw.split('\n').map((line) => JSON.parse(line)) : []
      const goodRows = parse(readSource(container, sql))
      const badRows = new Map(parse(readSource(container, sql, { legacy: true })).map((row) => [String(row.id), row]))
      const { rows: targetRows } = await db.query(`SELECT id, ${fields.map((field) => identifier(field.column_name)).join(', ')} FROM ${identifier(table)}`)
      const target = new Map(targetRows.map((row) => [String(row.id), row]))
      for (const good of goodRows) {
        const bad = badRows.get(String(good.id)), current = target.get(String(good.id))
        if (!bad || !current) continue
        const edits = []
        for (const field of fields) {
          const key = field.column_name
          if (bad[key] === good[key]) continue
          if (field.data_type === 'jsonb') {
            const old = bad[key] === null ? null : JSON.parse(bad[key])
            const correct = good[key] === null ? null : JSON.parse(good[key])
            const restored = restoreJson(current[key], old, correct)
            if (canonical(restored) !== canonical(current[key])) edits.push({ key, before: JSON.stringify(current[key]), after: JSON.stringify(restored) })
          } else if (current[key] === bad[key]) edits.push({ key, before: bad[key], after: good[key] })
        }
        if (edits.length) plans.push({ table, id: current.id, edits })
      }
    }
    console.log(`Encoding repair ${apply ? 'apply' : 'dry run'}: ${plans.length} rows, ${plans.reduce((total, row) => total + row.edits.length, 0)} fields`)
    if (!apply) return
    await db.query('BEGIN')
    let changed = 0
    try {
      for (const row of plans) {
        const values = [row.id]
        const updates = [], guards = []
        for (const edit of row.edits) {
          values.push(edit.after); updates.push(`${identifier(edit.key)} = $${values.length}`)
          values.push(edit.before); guards.push(`${identifier(edit.key)} IS NOT DISTINCT FROM $${values.length}`)
        }
        const result = await db.query(`UPDATE ${identifier(row.table)} SET ${updates.join(', ')} WHERE id = $1 AND ${guards.join(' AND ')}`, values)
        changed += result.rowCount
      }
      await db.query('COMMIT')
      console.log(`Restored ${changed} rows. New rows and changed values were preserved.`)
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  } finally { await db.end() }
}

if (require.main === module) repair().catch((error) => { console.error('Encoding repair failed:', error.code || error.name); process.exitCode = 1 })
module.exports = { restoreJson }
