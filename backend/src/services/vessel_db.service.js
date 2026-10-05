'use strict'

const path = require('path')
const fs = require('fs')
const pool = require('../config/db')

const DB_PATH = path.join(__dirname, '../../db/ships_plain.db')
const BATCH_SIZE = 2000

function openSqlite() {
  try {
    const Database = require('better-sqlite3')
    return new Database(DB_PATH, { readonly: true, fileMustExist: true })
  } catch (e) {
    throw {
      statusCode: 500,
      message: `Không thể mở ships_plain.db: ${e.message}`,
    }
  }
}

const vesselDbService = {
  dbFileExists() {
    return fs.existsSync(DB_PATH)
  },

  async catalogCount() {
    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM ship_catalog')
    return Number(c)
  },

  async seedFromSqlite() {
    if (!this.dbFileExists()) {
      throw { statusCode: 400, message: 'File ships_plain.db chưa được upload' }
    }

    const db = openSqlite()
    try {
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
        }
      }

      if (batch.length > 0) {
        await pool.query(
          'INSERT INTO ship_catalog (imo_no, ship_name, ex_names, mmsi, ship_type, country_name) VALUES ?',
          [batch]
        )
        inserted += batch.length
      }

      return { inserted }
    } finally {
      db.close()
    }
  },

  async searchByName(q) {
    const term = `%${q}%`
    const [rows] = await pool.query(
      `SELECT imo_no, ship_name, ex_names, ship_type, country_name
       FROM ship_catalog
       WHERE ship_name LIKE ? OR ex_names LIKE ?
       ORDER BY ship_name
       LIMIT 20`,
      [term, term]
    )
    return rows
  },

  saveUploadedFile(buffer) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(DB_PATH, buffer)
  },
}

module.exports = vesselDbService
