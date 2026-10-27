// Nạp ship_catalog từ ships_plain.db (SQLite). Dùng: npm run seed:ship-catalog -- [đường dẫn .db]
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const db = require('../src/config/db')
const { toCatalogRow } = require('../src/utils/ship_catalog_rows')

const DEFAULT_DB = path.join(__dirname, '../../docs/ships_plain.db')
const BATCH_SIZE = 5000
const SOURCE_SQL = `
  SELECT a.IMO_NO, a.SHIP_NAME, a.EX_NAMES, a.MMSI, a.REGISTER_ID,
         t.SHIP_TYPE, t.SHIP_TYPE_GROUP, c.COUNTRY_NAME, c.ABBR
  FROM ALL_FLEET a
  LEFT JOIN SHIP_TYPES t ON t._id = a.SHIP_TYPE_ID
  LEFT JOIN COUNTRIES c ON c._id = a.FLAG_ID`

async function insertBatch(client, rows) {
  const col = (name) => rows.map((row) => row[name])
  await client.query(
    `INSERT INTO ship_catalog (source_id, imo_number, ship_name, mmsi, ship_type, ship_type_group, flag_code, flag_name, register_id)
     SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[])`,
    ['source_id', 'imo_number', 'ship_name', 'mmsi', 'ship_type', 'ship_type_group', 'flag_code', 'flag_name', 'register_id'].map(col)
  )
  const ex = rows.flatMap((row) => row.ex_names.map((name) => [row.source_id, name]))
  if (!ex.length) return 0
  await client.query(
    'INSERT INTO ship_catalog_exname (source_id, name) SELECT * FROM unnest($1::bigint[], $2::text[])',
    [ex.map((pair) => pair[0]), ex.map((pair) => pair[1])]
  )
  return ex.length
}

async function seed(file) {
  const sqlite = new DatabaseSync(file, { readOnly: true })
  const client = await db.native.connect()
  let total = 0
  let exTotal = 0
  let skipped = 0
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE ship_catalog CASCADE')
    let batch = []
    for (const source of sqlite.prepare(SOURCE_SQL).iterate()) {
      const row = toCatalogRow(source)
      if (!row) { skipped += 1; continue }
      batch.push(row)
      if (batch.length >= BATCH_SIZE) {
        exTotal += await insertBatch(client, batch)
        total += batch.length
        batch = []
      }
    }
    if (batch.length) {
      exTotal += await insertBatch(client, batch)
      total += batch.length
    }
    await client.query('COMMIT')
    await client.query('ANALYZE ship_catalog')
    await client.query('ANALYZE ship_catalog_exname')
    console.log(`Đã nạp ${total} tàu, ${exTotal} tên cũ, bỏ qua ${skipped} dòng lỗi`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
    sqlite.close()
  }
}

seed(path.resolve(process.argv[2] || DEFAULT_DB))
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => db.end())
