// Script import vessel từ thư mục JSON
// Usage: node backend/scripts/import_vessels_json.js

const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const VESSELS_DIR = 'D:\\app hàng hải\\Document\\vessels'

const LIFECYCLE_MAP = {
  'in service/commission': 'IN_SERVICE',
  'in service': 'IN_SERVICE',
  'laid up': 'LAID_UP',
  'broken up': 'SCRAPPED',
  scrapped: 'SCRAPPED',
  'under construction': 'UNDER_CONSTRUCTION',
}

function parseYear(raw) {
  if (!raw) return null
  const m = String(raw).match(/\d{4}/)
  return m ? parseInt(m[0]) : null
}

function mapLifecycle(raw) {
  if (!raw) return 'IN_SERVICE'
  return LIFECYCLE_MAP[raw.toLowerCase()] || 'IN_SERVICE'
}

function mapDpClass(raw) {
  if (!raw) return null
  const s = String(raw).toUpperCase()
  if (s.includes('DPS-1') || s === 'DP1') return 'DPS-1'
  if (s.includes('DPS-2') || s === 'DP2') return 'DPS-2'
  if (s.includes('DPS-3') || s === 'DP3') return 'DPS-3'
  return null
}

function mapClassStatus(raw) {
  if (!raw || raw.startsWith('http')) return null
  const s = String(raw).toUpperCase()
  if (s.includes('SUSPEND')) return 'SUSPENDED'
  if (s.includes('WITHDRAW')) return 'WITHDRAWN'
  if (s.includes('NOT')) return 'NOT_CLASSED'
  if (s.includes('CLASS')) return 'CLASSED'
  return null
}

function parseVessel(json) {
  const meta = json.metadata || {}
  const shipinfo = meta.shipinfo || {}
  const dims = shipinfo.dimensions || {}
  const tonnage = shipinfo.tonnage || {}
  const exNames = shipinfo.ex_names || null

  return {
    imo_number: json.imo_number ? String(json.imo_number) : null,
    mmsi: json.mmsi ? String(json.mmsi) : null,
    call_sign: json.call_sign || null,
    vessel_name: json.name || 'UNKNOWN',
    vessel_name_prev: exNames || null,
    vessel_type: json.vessel_type || null,
    flag_country: json.flag || null,
    trade_area: json.trade_area || null,
    gross_tonnage: json.gross_tonnage || null,
    net_tonnage: tonnage.nrt || json.net_tonnage || null,
    deadweight: json.deadweight || null,
    length_overall: dims.length_overall || null,
    year_built: parseYear(json.year_built),
    engine_power_kw: json.engine_power_kw || null,
    engine_type: json.engine_type || null,
    dp_class: mapDpClass(json.dp_class),
    has_boiler: json.has_boiler ? 1 : 0,
    has_refrigeration: json.has_refrigeration ? 1 : 0,
    passenger_capacity: json.passenger_capacity || null,
    crew_capacity: json.crew_capacity || null,
    classification_society: json.class_society || null,
    class_status: mapClassStatus(json.class_status),
    lifecycle_status: mapLifecycle(json.lifecycle_status),
    technical_manager: json.manager_name || null,
    commercial_manager: json.owner_name || null,
  }
}

async function main() {
  const files = fs.readdirSync(VESSELS_DIR).filter((f) => f.endsWith('.json'))
  console.log(`Found ${files.length} JSON files`)

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'marineport',
    charset: 'utf8mb4',
  })

  const BATCH = 200
  let imported = 0,
    skipped = 0,
    errors = 0

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH)
    const rows = []

    for (const file of batch) {
      try {
        const raw = fs.readFileSync(path.join(VESSELS_DIR, file), 'utf8')
        const json = JSON.parse(raw)
        rows.push(parseVessel(json))
      } catch {
        errors++
      }
    }

    if (rows.length === 0) continue

    const cols = Object.keys(rows[0])
    const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')})`).join(',')
    const values = rows.flatMap((r) => cols.map((c) => r[c]))

    try {
      const [res] = await conn.query(
        `INSERT IGNORE INTO vessel (${cols.join(',')}) VALUES ${placeholders}`,
        values
      )
      imported += res.affectedRows
      skipped += rows.length - res.affectedRows
    } catch (e) {
      console.error(`Batch ${i}-${i + BATCH} error:`, e.message)
      errors += rows.length
    }

    if ((i / BATCH) % 10 === 0) {
      process.stdout.write(`\r${i + BATCH}/${files.length} files processed...`)
    }
  }

  await conn.end()
  console.log(`\nDone: ${imported} inserted, ${skipped} skipped (duplicate IMO), ${errors} errors`)
}

main().catch(console.error)
