'use strict'

const path = require('path')
const pool = require('../src/config/db')

const DB_PATH = path.join(__dirname, '../db/ships_plain.db')
const BATCH_SIZE = 2000

async function seed() {
  let Database
  try {
    Database = require('better-sqlite3')
  } catch {
    console.error('Cài better-sqlite3 trước: npm install better-sqlite3')
    process.exit(1)
  }

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
  console.log('Truncating ship_catalog...')
  await pool.query('TRUNCATE TABLE ship_catalog')

  const stmt = db.prepare(
    'SELECT IMO_NO, SHIP_NAME, EX_NAMES, MMSI, SHIP_TYPE, COUNTRY_NAME FROM SHOW_FLEET'
  )

  let inserted = 0
  let batch = []

  for (const row of stmt.iterate()) {
    batch.push([
      row.IMO_NO ? String(row.IMO_NO) : null,
      row.SHIP_NAME || '',
      row.EX_NAMES || null,
      row.MMSI ? String(row.MMSI) : null,
      row.SHIP_TYPE || null,
      row.COUNTRY_NAME || null,
    ])
    if (batch.length >= BATCH_SIZE) {
      await pool.query(
        'INSERT INTO ship_catalog (imo_no, ship_name, ex_names, mmsi, ship_type, country_name) VALUES ?',
        [batch]
      )
      inserted += batch.length
      batch = []
      process.stdout.write(`\r${inserted.toLocaleString()} records...`)
    }
  }

  if (batch.length > 0) {
    await pool.query(
      'INSERT INTO ship_catalog (imo_no, ship_name, ex_names, mmsi, ship_type, country_name) VALUES ?',
      [batch]
    )
    inserted += batch.length
  }

  db.close()
  console.log(`\nDone: ${inserted.toLocaleString()} records inserted`)
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
