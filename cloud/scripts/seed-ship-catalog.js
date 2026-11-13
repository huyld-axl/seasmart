// Nạp danh mục tàu thế giới vào máy chủ dịch vụ từ ships_plain.db (SQLite), dùng lại cách đổi dòng của backend.
//   node scripts/seed-ship-catalog.js [đường dẫn .db]
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const pool = require('../src/db')
const { toCatalogRow } = require('../../backend/src/utils/ship_catalog_rows')

const DEFAULT_DB = path.join(__dirname, '../../docs/ships_plain.db')
const BATCH = 5000
const SOURCE_SQL = `
  SELECT a.IMO_NO, a.SHIP_NAME, a.EX_NAMES, a.MMSI, a.REGISTER_ID,
         t.SHIP_TYPE, t.SHIP_TYPE_GROUP, c.COUNTRY_NAME, c.ABBR
  FROM ALL_FLEET a
  LEFT JOIN SHIP_TYPES t ON t._id = a.SHIP_TYPE_ID
  LEFT JOIN COUNTRIES c ON c._id = a.FLAG_ID`

async function main() {
  const source = new DatabaseSync(process.argv[2] || DEFAULT_DB, { readOnly: true })
  const client = await pool.connect()
  let ships = 0
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE ship_catalog CASCADE')
    let batch = []
    const flush = async () => {
      const col = (n) => batch.map((r) => r[n])
      await client.query(
        `INSERT INTO ship_catalog (source_id, imo_number, ship_name, mmsi, ship_type, ship_type_group, flag_code, flag_name, register_id)
         SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[])
         ON CONFLICT DO NOTHING`,
        ['source_id', 'imo_number', 'ship_name', 'mmsi', 'ship_type', 'ship_type_group', 'flag_code', 'flag_name', 'register_id'].map(col)
      )
      const ex = batch.flatMap((r) => r.ex_names.map((name) => [r.source_id, name]))
      if (ex.length) await client.query('INSERT INTO ship_catalog_exname (source_id, name) SELECT * FROM unnest($1::bigint[], $2::text[])', [ex.map((e) => e[0]), ex.map((e) => e[1])])
      ships += batch.length
      batch = []
    }
    for (const raw of source.prepare(SOURCE_SQL).iterate()) {
      const row = toCatalogRow(raw)
      if (!row) continue
      batch.push(row)
      if (batch.length >= BATCH) await flush()
    }
    if (batch.length) await flush()
    await client.query('COMMIT')
    console.log(`Đã nạp ${ships} tàu`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
