#!/usr/bin/env node
/**
 * import_vessels.js
 * Parse JSON từ drop folder → upsert vào bảng vessel (Crew Manning)
 *
 * Usage:
 *   node scripts/import_vessels.js --dir <path> [--limit <n>] [--dry-run] [--overwrite]
 *
 * Cấu hình:
 *   .env: VESSEL_IMPORT_DIR=/data/vessels-import
 *         DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

'use strict'

const fs       = require('fs')
const path     = require('path')

const backendModules = path.join(__dirname, '../backend/node_modules')
const mysql  = require(path.join(backendModules, 'mysql2/promise'))
const dotenv = require(path.join(backendModules, 'dotenv'))

dotenv.config({ path: path.join(__dirname, '../backend/.env') })
if (!process.env.DB_HOST) {
  dotenv.config({ path: path.join(__dirname, '../.env') })
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KNOWN_ENGINE_TYPES = ['Diesel', 'Steam', 'Gas Turbine', 'Electric', 'Hybrid', 'LNG']

const LIFECYCLE_MAP = {
  'in service': 'IN_SERVICE',
  commission:   'IN_SERVICE',
  'laid up':    'LAID_UP',
  broken:       'SCRAPPED',
  scrap:        'SCRAPPED',
  construction: 'UNDER_CONSTRUCTION',
}

const BATCH_SIZE = 30

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { dir: null, limit: null, dryRun: false, overwrite: false }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':       opts.dir       = args[++i]; break
      case '--limit':     opts.limit     = parseInt(args[++i]); break
      case '--dry-run':   opts.dryRun    = true; break
      case '--overwrite': opts.overwrite = true; break
      case '--help':
        console.log([
          'Usage: node scripts/import_vessels.js [options]',
          '',
          'Options:',
          '  --dir <path>    Drop folder chứa file JSON [default: $VESSEL_IMPORT_DIR]',
          '  --limit <n>     Chỉ xử lý n file đầu (test)',
          '  --dry-run       Parse và validate, không ghi vào DB',
          '  --overwrite     Ghi đè tất cả field, kể cả field đã có data',
          '  --help          Hiển thị help này',
        ].join('\n'))
        process.exit(0)
    }
  }

  opts.dir = opts.dir || process.env.VESSEL_IMPORT_DIR
  if (!opts.dir) {
    console.error('ERROR: Chưa có thư mục input. Dùng --dir <path> hoặc set VESSEL_IMPORT_DIR trong .env')
    process.exit(1)
  }

  return opts
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(val) {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function parseYear(val) {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{4}$/.test(s)) return parseInt(s)
  const d = parseDate(s)
  return d ? parseInt(d.slice(0, 4)) : null
}

function toInt(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseInt(String(val).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

function toFloat(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

function toStr(val, maxLen = null) {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (s === '' || s === '******') return null
  return maxLen ? s.slice(0, maxLen) : s
}

function toBool(val) {
  if (typeof val === 'boolean') return val
  return String(val).toLowerCase() === 'true'
}

function parseEngineType(val) {
  if (!val) return null
  const s = String(val).trim()
  for (const t of KNOWN_ENGINE_TYPES) {
    if (s.toLowerCase().includes(t.toLowerCase())) return t
  }
  return s.length <= 100 ? s : s.slice(0, 100)
}

function mapLifecycleStatus(val) {
  if (!val) return 'IN_SERVICE'
  const s = String(val).toLowerCase()
  for (const [key, status] of Object.entries(LIFECYCLE_MAP)) {
    if (s.includes(key)) return status
  }
  return 'IN_SERVICE'
}

function mapClassStatus(val) {
  if (!val) return 'NOT_CLASSED'
  const s = String(val).toLowerCase()
  if (s.includes('withdrawn')) return 'WITHDRAWN'
  if (s.includes('suspended')) return 'SUSPENDED'
  return 'CLASSED'
}

function parseDpClass(val) {
  if (!val) return null
  const s = String(val).trim().toUpperCase()
  if (['DPS-1', 'DPS-2', 'DPS-3'].includes(s)) return s
  const m = s.match(/DP[S-]?(\d)/)
  return m ? `DPS-${m[1]}` : null
}

function parseInmarsat(comm, topLevel) {
  if (topLevel) return toStr(topLevel, 50)
  if (!Array.isArray(comm)) return null
  const found = comm.find(c => c.type && c.type.toLowerCase().includes('inmarsat'))
  return found ? toStr(found.no, 50) : null
}

// ─── Lookup cache ─────────────────────────────────────────────────────────────

async function buildCaches(db) {
  const [vesselTypes, countries, ports, owners] = await Promise.all([
    db.query('SELECT id, name_en, name_vi FROM vessel_type'),
    db.query('SELECT id, name_en, name_vi FROM country'),
    db.query('SELECT id, name FROM port'),
    db.query('SELECT id, company_name FROM ship_owner WHERE deleted_at IS NULL'),
  ])

  const vesselTypeCache = new Map()
  for (const r of vesselTypes[0]) {
    if (r.name_en) vesselTypeCache.set(r.name_en.toUpperCase(), r.id)
    if (r.name_vi) vesselTypeCache.set(r.name_vi.toUpperCase(), r.id)
  }

  const countryCache = new Map()
  for (const r of countries[0]) {
    if (r.name_en) countryCache.set(r.name_en.toUpperCase(), r.id)
    if (r.name_vi) countryCache.set(r.name_vi.toUpperCase(), r.id)
  }

  const portCache = new Map()
  for (const r of ports[0]) {
    if (r.name) portCache.set(r.name.toUpperCase(), r.id)
  }

  const ownerCache = new Map()
  for (const r of owners[0]) {
    ownerCache.set(r.company_name.trim(), r.id)
  }

  return { vesselTypeCache, countryCache, portCache, ownerCache }
}

function lookupFromCache(cache, val) {
  if (!val) return null
  return cache.get(val.toUpperCase()) ?? null
}

function lookupCountry(cache, val) {
  if (!val) return null
  const exact = cache.get(val.toUpperCase())
  if (exact) return exact
  const clean = val.replace(/\(.*\)/, '').trim().toUpperCase()
  return cache.get(clean) ?? null
}

async function lookupOrInsertOwner(db, ownerName, ownerCache) {
  if (!ownerName) return null
  const name = ownerName.trim()
  if (!name) return null

  const cached = ownerCache.get(name)
  if (cached) return cached

  const [rows] = await db.query(
    'SELECT id FROM ship_owner WHERE company_name = ? AND deleted_at IS NULL LIMIT 1',
    [name]
  )
  if (rows.length > 0) {
    ownerCache.set(name, rows[0].id)
    return rows[0].id
  }

  const prefix = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'OWN'
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  const code   = (prefix + suffix).slice(0, 30)

  const [result] = await db.query(
    'INSERT INTO ship_owner (code, company_name) VALUES (?, ?)',
    [code, name]
  )
  ownerCache.set(name, result.insertId)
  return result.insertId
}

// ─── SQL template (built once) ───────────────────────────────────────────────

const UPSERT_COLS = [
  'vessel_name', 'mmsi', 'call_sign', 'vessel_name_prev',
  'vessel_type', 'flag_country', 'port_of_registry_id',
  'gross_tonnage', 'net_tonnage', 'deadweight',
  'length_overall', 'breadth', 'depth', 'draft_design',
  'year_built', 'classification_society', 'ship_owner_id',
  'technical_manager', 'commercial_manager',
  'lifecycle_status', 'class_status',
  'engine_power_kw', 'engine_type', 'engine_maker', 'engine_model', 'engine_rpm',
  'dp_class', 'has_boiler', 'has_refrigeration',
  'passenger_capacity', 'crew_capacity',
  'photo_url', 'inmarsat_number',
]

function buildUpsertSql(overwrite) {
  const cols         = ['imo_number', ...UPSERT_COLS]
  const colList      = cols.map(c => `\`${c}\``).join(', ')
  const placeholders = cols.map(() => '?').join(', ')
  const updateParts  = overwrite
    ? UPSERT_COLS.map(c => `\`${c}\` = VALUES(\`${c}\`)`)
    : UPSERT_COLS.map(c => `\`${c}\` = IF(\`${c}\` IS NULL, VALUES(\`${c}\`), \`${c}\`)`)
  updateParts.push('`updated_at` = NOW()')

  return `INSERT INTO vessel (${colList}) VALUES (${placeholders})
          ON DUPLICATE KEY UPDATE ${updateParts.join(', ')}`
}

// ─── Parse 1 file JSON → record ───────────────────────────────────────────────

function parseRecord(raw, imoStr, vesselName, caches, ownerId) {
  const si  = raw?.metadata?.shipinfo ?? {}
  const dim = si?.dimensions ?? {}
  const hl  = raw?.metadata?.hifleet_list ?? {}

  return {
    imo_number:           imoStr ? imoStr.slice(0, 10) : null,
    vessel_name:          vesselName,
    mmsi:                 toStr(raw.mmsi, 10),
    call_sign:            toStr(raw.call_sign, 10),
    vessel_name_prev:     toStr(si.ex_names, 150),

    vessel_type:          toStr(raw.vessel_type, 255),
    flag_country:         toStr(raw.flag, 255),
    port_of_registry_id:  lookupFromCache(caches.portCache, si?.home_port),
    ship_owner_id:        ownerId,

    gross_tonnage:        toFloat(raw.gross_tonnage),
    net_tonnage:          toFloat(si?.tonnage?.nrt),
    deadweight:           toFloat(raw.deadweight) > 0 ? toFloat(raw.deadweight) : null,
    length_overall:       toFloat(dim.length_overall ?? hl.LENGTH),
    breadth:              toFloat(dim.breadth ?? hl.width),
    depth:                toFloat(dim.depth),
    draft_design:         toFloat(dim.draft),

    year_built:           parseYear(raw.year_built),
    classification_society: toStr(raw.classification_society, 50),
    technical_manager:    toStr(raw.manager_name, 200),
    commercial_manager:   toStr(hl.operator, 200),

    lifecycle_status:     mapLifecycleStatus(raw.lifecycle_status),
    class_status:         mapClassStatus(raw.class_status),

    engine_power_kw:      toInt(raw.engine_power_kw),
    engine_type:          parseEngineType(raw.engine_type),
    engine_maker:         toStr(raw.engine_maker, 200),
    engine_model:         toStr(raw.engine_model, 200),
    engine_rpm:           toInt(raw.engine_rpm),
    dp_class:             parseDpClass(raw.dp_class),
    has_boiler:           toBool(raw.has_boiler),
    has_refrigeration:    toBool(raw.has_refrigeration),
    passenger_capacity:   toInt(raw.passenger_capacity),
    crew_capacity:        toInt(raw.crew_capacity) > 0 ? toInt(raw.crew_capacity) : null,

    photo_url:            toStr(si?.pics?.[0]?.url, 500),
    inmarsat_number:      parseInmarsat(si?.comm, raw.inmarsat_number),
  }
}

// ─── Upsert 1 record ──────────────────────────────────────────────────────────

async function upsertVessel(db, sql, record) {
  const cols = ['imo_number', ...UPSERT_COLS]
  const vals = cols.map(c => record[c] ?? null)
  const [result] = await db.query(sql, vals)
  // MySQL affectedRows: 1 = inserted, 2 = updated (matched + changed), 0 = no-op
  if (result.affectedRows === 1) return 'inserted'
  if (result.affectedRows === 2) return 'updated'
  return 'noChange'
}

// ─── Process 1 file ───────────────────────────────────────────────────────────

async function processFile(db, filePath, sql, caches, opts) {
  let raw
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    raw = JSON.parse(content)
  } catch (e) {
    return { status: 'error', reason: e.message }
  }

  const imoStr     = raw.imo_number != null ? String(raw.imo_number).trim() : null
  const vesselName = toStr(raw.name, 150) ?? (imoStr ? `IMO-${imoStr}` : null)

  if (!imoStr && !vesselName) {
    return { status: 'skipped', reason: 'no imo_number and no name' }
  }

  if (opts.dryRun) {
    const record = parseRecord(raw, imoStr, vesselName, caches, null)
    return { status: 'dryRun', label: vesselName, record }
  }

  let ownerId = null
  try {
    ownerId = await lookupOrInsertOwner(db, raw.owner_name, caches.ownerCache)
  } catch (e) {
    return { status: 'error', reason: `owner: ${e.message}`, label: vesselName }
  }

  const record = parseRecord(raw, imoStr, vesselName, caches, ownerId)

  try {
    const status = await upsertVessel(db, sql, record)
    return { status, label: vesselName }
  } catch (e) {
    return { status: 'error', reason: e.message, label: vesselName }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const opts = parseArgs()

  console.log('Crew Manning - Vessel Import')
  console.log(`Drop folder : ${opts.dir}`)
  console.log(`Mode        : ${opts.dryRun ? 'DRY RUN' : opts.overwrite ? 'upsert (overwrite)' : 'upsert (fill-empty)'}`)
  if (opts.limit) console.log(`Limit       : ${opts.limit} files`)
  console.log()

  let files
  try {
    files = fs.readdirSync(opts.dir)
      .filter(f => f.toLowerCase().endsWith('.json'))
      .map(f => path.join(opts.dir, f))
  } catch (e) {
    console.error(`ERROR: Không thể đọc thư mục: ${e.message}`)
    process.exit(1)
  }

  if (files.length === 0) {
    console.log('Không tìm thấy file JSON nào trong thư mục.')
    return
  }

  if (opts.limit) files = files.slice(0, opts.limit)
  console.log(`Tìm thấy ${files.length} file JSON\n`)

  let db
  const sql = buildUpsertSql(opts.overwrite)

  if (!opts.dryRun) {
    try {
      db = await mysql.createPool({
        host:             process.env.DB_HOST     || 'localhost',
        port:             parseInt(process.env.DB_PORT) || 3306,
        user:             process.env.DB_USER     || 'root',
        password:         process.env.DB_PASSWORD || '',
        database:         process.env.DB_NAME     || 'marineport',
        charset:          'utf8mb4',
        connectionLimit:  BATCH_SIZE,
        waitForConnections: true,
      })
    } catch (e) {
      console.error(`ERROR: Không thể kết nối DB: ${e.message}`)
      process.exit(1)
    }
  }

  const emptyCaches = {
    vesselTypeCache: new Map(), countryCache: new Map(),
    portCache: new Map(),       ownerCache:  new Map(),
  }
  const caches = opts.dryRun ? emptyCaches : await buildCaches(db)

  const counts = { inserted: 0, updated: 0, noChange: 0, dryRun: 0, skipped: 0, error: 0 }
  const ICONS  = { inserted: '[✓]', updated: '[~]', noChange: '[-]', dryRun: '[?]', skipped: '[!]', error: '[✗]' }
  const start  = Date.now()

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch   = files.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(fp => processFile(db, fp, sql, caches, opts))
    )

    for (let j = 0; j < batch.length; j++) {
      const fname  = path.basename(batch[j])
      const result = results[j]
      counts[result.status] = (counts[result.status] || 0) + 1

      const icon   = ICONS[result.status] ?? '[?]'
      const label  = result.label ?? ''
      const suffix = result.status === 'error'   ? `  ← ${result.reason}` :
                     result.status === 'skipped'  ? `  ← ${result.reason}` :
                     result.status === 'dryRun'   ? '  (dry run)' : ''

      console.log(`${icon} ${fname.padEnd(20)} → ${result.status.padEnd(10)} ${label}${suffix}`)
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n' + '─'.repeat(50))
  console.log(`Processed : ${files.length}`)
  console.log(`Inserted  : ${counts.inserted  || 0}`)
  console.log(`Updated   : ${counts.updated   || 0}`)
  console.log(`No-change : ${counts.noChange  || 0}`)
  if (opts.dryRun)
  console.log(`Dry-run   : ${counts.dryRun    || 0}`)
  console.log(`Skipped   : ${counts.skipped   || 0}`)
  console.log(`Errors    : ${counts.error     || 0}`)
  console.log(`Elapsed   : ${elapsed}s`)

  if (db) await db.end()
}

run().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
