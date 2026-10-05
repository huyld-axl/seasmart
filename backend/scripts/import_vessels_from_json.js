require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DEFAULT_SOURCE_DIR = 'D:/app hàng hải/Document/vessels'

function normalizeText(value) {
  if (!value) return ''
  return String(value).trim().toLowerCase()
}

function asNullableString(value, maxLen) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return maxLen ? trimmed.slice(0, maxLen) : trimmed
}

function asNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseYear(value) {
  if (value === undefined || value === null || value === '') return null

  const asNum = Number(value)
  if (Number.isFinite(asNum) && asNum >= 1800 && asNum <= 2100) {
    return Math.trunc(asNum)
  }

  const str = String(value)
  const m = str.match(/\b(18|19|20)\d{2}\b/)
  if (!m) return null
  return Number(m[0])
}

function mapLifecycleStatus(value) {
  const key = normalizeText(value)
  if (!key) return 'IN_SERVICE'
  if (key.includes('laid')) return 'LAID_UP'
  if (key.includes('scrap') || key.includes('demol') || key.includes('broken')) return 'SCRAPPED'
  if (key.includes('construct') || key.includes('building')) return 'UNDER_CONSTRUCTION'
  if (key.includes('service') || key.includes('commission')) return 'IN_SERVICE'
  return 'IN_SERVICE'
}

function mapClassStatus(value) {
  const key = normalizeText(value)
  if (!key) return null
  if (key.includes('classed') || key.includes('in class')) return 'CLASSED'
  if (key.includes('suspend')) return 'SUSPENDED'
  if (key.includes('withdraw')) return 'WITHDRAWN'
  if (key.includes('not class')) return 'NOT_CLASSED'
  return null
}

function mapDpClass(value) {
  const str = asNullableString(value, 10)
  if (!str) return null
  if (str === 'DPS-1' || str === 'DPS-2' || str === 'DPS-3') return str
  return null
}

async function main() {
  const sourceDir = process.argv[2] || DEFAULT_SOURCE_DIR
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`)
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'marineport',
  })

  try {
    const files = fs
      .readdirSync(sourceDir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .sort()

    let imported = 0
    let skipped = 0
    let failed = 0

    const sql = `
      INSERT INTO vessel (
        imo_number, mmsi, call_sign, vessel_name, vessel_name_prev,
        vessel_type, flag_country, gross_tonnage, net_tonnage, deadweight,
        engine_power_kw, engine_type, engine_maker, engine_model, engine_rpm,
        dp_class, has_boiler, has_refrigeration, passenger_capacity, crew_capacity,
        length_overall, breadth, depth, draft_design, year_built,
        classification_society, class_status, lifecycle_status,
        ship_owner_name, ship_owner_code, technical_manager, commercial_manager,
        status, notes, photo_url, inmarsat_number, deleted_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, NULL
      )
      ON DUPLICATE KEY UPDATE
        mmsi = VALUES(mmsi),
        call_sign = VALUES(call_sign),
        vessel_name = VALUES(vessel_name),
        vessel_name_prev = VALUES(vessel_name_prev),
        vessel_type = VALUES(vessel_type),
        flag_country = VALUES(flag_country),
        gross_tonnage = VALUES(gross_tonnage),
        net_tonnage = VALUES(net_tonnage),
        deadweight = VALUES(deadweight),
        engine_power_kw = VALUES(engine_power_kw),
        engine_type = VALUES(engine_type),
        engine_maker = VALUES(engine_maker),
        engine_model = VALUES(engine_model),
        engine_rpm = VALUES(engine_rpm),
        dp_class = VALUES(dp_class),
        has_boiler = VALUES(has_boiler),
        has_refrigeration = VALUES(has_refrigeration),
        passenger_capacity = VALUES(passenger_capacity),
        crew_capacity = VALUES(crew_capacity),
        length_overall = VALUES(length_overall),
        breadth = VALUES(breadth),
        depth = VALUES(depth),
        draft_design = VALUES(draft_design),
        year_built = VALUES(year_built),
        classification_society = VALUES(classification_society),
        class_status = VALUES(class_status),
        lifecycle_status = VALUES(lifecycle_status),
        ship_owner_name = VALUES(ship_owner_name),
        ship_owner_code = VALUES(ship_owner_code),
        technical_manager = VALUES(technical_manager),
        commercial_manager = VALUES(commercial_manager),
        status = VALUES(status),
        notes = VALUES(notes),
        photo_url = VALUES(photo_url),
        inmarsat_number = VALUES(inmarsat_number),
        deleted_at = NULL
    `

    for (const file of files) {
      const fullPath = path.join(sourceDir, file)
      try {
        const raw = fs.readFileSync(fullPath, 'utf8')
        const data = JSON.parse(raw)

        const vesselName = asNullableString(data.name, 150)
        if (!vesselName) {
          skipped += 1
          continue
        }

        const imo = asNullableString(data.imo_number, 10)
        if (!imo) {
          skipped += 1
          continue
        }

        const dims = data?.metadata?.shipinfo?.dimensions || {}
        const tonnage = data?.metadata?.shipinfo?.tonnage || {}
        const picUrl = data?.metadata?.shipinfo?.pics?.[0]?.url

        const flagCountry = asNullableString(data.flag, 255)
        const vesselType = asNullableString(data.vessel_type, 255)

        const netTonnage = asNullableNumber(data.net_tonnage ?? tonnage.nrt)
        const classStatus = mapClassStatus(data.class_status)
        const lifecycleStatus = mapLifecycleStatus(data.lifecycle_status)

        const params = [
          imo,
          asNullableString(data.mmsi, 10),
          asNullableString(data.call_sign, 10),
          vesselName,
          asNullableString(data?.metadata?.shipinfo?.ex_names, 150),
          vesselType,
          flagCountry,
          asNullableNumber(data.gross_tonnage),
          netTonnage,
          asNullableNumber(data.deadweight),
          asNullableNumber(data.engine_power_kw),
          asNullableString(data.engine_type, 100),
          asNullableString(data.engine_maker, 200),
          asNullableString(data.engine_model, 200),
          asNullableNumber(data.engine_rpm),
          mapDpClass(data.dp_class),
          data.has_boiler ? 1 : 0,
          data.has_refrigeration ? 1 : 0,
          asNullableNumber(data.passenger_capacity),
          asNullableNumber(data.crew_capacity),
          asNullableNumber(data.length_overall ?? dims.length_overall),
          asNullableNumber(data.breadth ?? dims.breadth),
          asNullableNumber(data.depth ?? dims.depth),
          asNullableNumber(data.draft_design ?? dims.draft),
          parseYear(data.year_built),
          asNullableString(data.class_society, 50),
          classStatus,
          lifecycleStatus,
          asNullableString(data.owner_name, 255),
          null,
          null,
          asNullableString(data.manager_name, 200),
          lifecycleStatus,
          null,
          asNullableString(picUrl, 500),
          asNullableString(data.inmarsat_number, 50),
        ]

        await conn.query(sql, params)
        imported += 1
      } catch (err) {
        failed += 1
        console.error(`Failed: ${file} -> ${err.message}`)
      }
    }

    console.log('Import completed')
    console.log(`- Source dir: ${sourceDir}`)
    console.log(`- Total files: ${files.length}`)
    console.log(`- Imported: ${imported}`)
    console.log(`- Skipped: ${skipped}`)
    console.log(`- Failed: ${failed}`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error(`Import aborted: ${err.message}`)
  process.exit(1)
})
