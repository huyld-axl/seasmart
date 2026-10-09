// Maintainer tool: capture schema after 000..020 on an isolated, clean DB.
const fs = require('fs')
const pool = require('../src/config/db')
async function main() {
  const [rows] = await pool.query('SELECT TABLE_NAME AS tbl, COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN (\'mcah_instance\', \'mcah_migration_history\') ORDER BY TABLE_NAME, ORDINAL_POSITION')
  const manifest = {}
  for (const { tbl, name, type } of rows) (manifest[tbl] ||= []).push({ name, type })
  const keys = {}
  for (const table of Object.keys(manifest)) {
    const [indexes] = await pool.query('SELECT INDEX_NAME AS name, COLUMN_NAME AS col, NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS pos FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX', [table])
    const [constraints] = await pool.query('SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_col, ORDINAL_POSITION AS pos FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION', [table])
    keys[table] = { indexes, constraints }
  }
  fs.writeFileSync(require('path').join(__dirname, 'mcah-baseline-keys.json'), '{\n' + Object.entries(keys).map(([table, values]) => `  ${JSON.stringify(table)}: ${JSON.stringify(values)}`).join(',\n') + '\n}\n')
  fs.writeFileSync(require('path').join(__dirname, 'mcah-baseline-schema.json'), '{\n' + Object.entries(manifest).map(([table, cols]) => `  ${JSON.stringify(table)}: ${JSON.stringify(cols)}`).join(',\n') + '\n}\n')
}
main().catch(err => { console.error(err.message); process.exitCode = 1 }).finally(() => pool.end())
