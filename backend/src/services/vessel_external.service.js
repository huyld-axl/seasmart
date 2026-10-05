const crypto = require('crypto')
const pool = require('../config/db')

const DEFAULT_BASE_URL = 'http://157.180.60.155:8888'

function isDecryptDebugEnabled() {
  const flag = String(process.env.VESSEL_DECRYPT_DEBUG || '').toLowerCase()
  return flag === '1' || flag === 'true' || process.env.NODE_ENV !== 'production'
}

function keyFingerprint(key) {
  return crypto
    .createHash('sha256')
    .update(String(key || ''))
    .digest('hex')
    .slice(0, 12)
}

function getEncryptionKeyBuffer() {
  const key = process.env.ENC_KEY
  if (!key) {
    throw {
      statusCode: 500,
      message: 'Thiếu ENC_KEY trong môi trường server',
      details: isDecryptDebugEnabled() ? { hint: 'Set ENC_KEY in backend/.env' } : null,
    }
  }
  return crypto.createHash('sha256').update(key).digest()
}

function decryptPayload(base64Payload) {
  try {
    if (!base64Payload || typeof base64Payload !== 'string') {
      throw new Error('Encrypted payload must be a non-empty base64 string')
    }

    const keyBuffer = getEncryptionKeyBuffer()
    const buf = Buffer.from(base64Payload, 'base64')
    if (!buf || buf.length < 29) {
      throw new Error(`Encrypted payload is too short (${buf?.length || 0} bytes)`)
    }
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const ciphertext = buf.subarray(28)
    if (ciphertext.length === 0) {
      throw new Error('Encrypted payload has empty ciphertext')
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  } catch (error) {
    const details = isDecryptDebugEnabled()
      ? {
          reason: error?.message || 'Unknown decrypt error',
          payload_length: base64Payload?.length || 0,
          key_fingerprint: keyFingerprint(process.env.ENC_KEY),
          hint: 'Check ENC_KEY exact match with external API encrypt key and payload format iv(12)+tag(16)+ciphertext',
        }
      : null
    throw {
      statusCode: 502,
      message: 'Không thể giải mã dữ liệu tàu từ nguồn ngoài',
      details,
    }
  }
}

function normalizeImo(imo) {
  return String(imo || '').trim()
}

function mapLifecycleStatus(value) {
  if (!value) return 'IN_SERVICE'
  const text = String(value).toLowerCase()
  if (text.includes('construction')) return 'UNDER_CONSTRUCTION'
  if (text.includes('scrap')) return 'SCRAPPED'
  if (text.includes('laid')) return 'LAID_UP'
  return 'IN_SERVICE'
}

function mapClassStatus(value) {
  if (!value) return null
  const text = String(value).toLowerCase()
  if (text.includes('classed')) return 'CLASSED'
  if (text.includes('suspend')) return 'SUSPENDED'
  if (text.includes('withdraw')) return 'WITHDRAWN'
  if (text.includes('not class')) return 'NOT_CLASSED'
  return null
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') return value
  }
  return null
}

function textOrNull(value) {
  if (value === null || value === undefined) return null
  const t = String(value).trim()
  return t === '' ? null : t
}

async function fetchDecryptedVesselByImo(imo, refresh = false) {
  const baseUrl = (process.env.VESSEL_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const query = refresh ? '?refresh=1' : ''
  const url = `${baseUrl}/api/vessel/${imo}${query}`
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text()
    throw {
      statusCode: 502,
      message: `API tàu bên ngoài lỗi (${response.status})`,
      details: body,
    }
  }
  const json = await response.json()
  if (json?.e) {
    return decryptPayload(json.e)
  }
  if (json?.data) {
    return json
  }
  throw {
    statusCode: 502,
    message: 'Dữ liệu tàu trả về không hợp lệ (thiếu trường e hoặc data)',
  }
}

async function upsertVesselFromExternal(payload, requestedImo) {
  const vessel = payload?.data || {}
  const imoNumber = normalizeImo(vessel.imo_number || requestedImo)
  if (!/^\d{7}$/.test(imoNumber)) {
    throw { statusCode: 400, message: 'IMO không hợp lệ (phải gồm đúng 7 chữ số)' }
  }

  const vesselName = vessel.name ? String(vessel.name).trim() : null
  if (!vesselName) {
    throw { statusCode: 502, message: 'Dữ liệu tàu thiếu tên tàu' }
  }

  const rawVesselType = pickFirst(vessel.vessel_type, vessel.type, vessel.ship_type)
  const rawFlagCountry = pickFirst(
    vessel.flag,
    vessel.flag_country,
    vessel.flag_country_name,
    vessel.flag_state
  )

  const mapped = {
    vessel_name: vesselName,
    imo_number: imoNumber,
    vessel_type: textOrNull(rawVesselType),
    flag_country: textOrNull(rawFlagCountry),
    mmsi: vessel.mmsi ? String(vessel.mmsi) : null,
    call_sign: vessel.call_sign ? String(vessel.call_sign) : null,
    trade_area: vessel.trade_area ? String(vessel.trade_area) : null,
    gross_tonnage: toNumberOrNull(vessel.gross_tonnage),
    deadweight: toNumberOrNull(vessel.deadweight),
    engine_power_kw: toNumberOrNull(vessel.engine_power_kw),
    engine_type: vessel.engine_type ? String(vessel.engine_type) : null,
    dp_class:
      vessel.dp_class === 'DPS-1' || vessel.dp_class === 'DPS-2' || vessel.dp_class === 'DPS-3'
        ? vessel.dp_class
        : null,
    has_boiler: vessel.has_boiler ? 1 : 0,
    has_refrigeration: vessel.has_refrigeration ? 1 : 0,
    passenger_capacity: toNumberOrNull(vessel.passenger_capacity),
    crew_capacity: toNumberOrNull(vessel.crew_capacity),
    year_built: toNumberOrNull(String(vessel.year_built || '').match(/\d{4}/)?.[0]),
    classification_society: vessel.class_society ? String(vessel.class_society) : null,
    class_status: mapClassStatus(vessel.class_status),
    lifecycle_status: mapLifecycleStatus(vessel.lifecycle_status),
    technical_manager: vessel.manager_name ? String(vessel.manager_name) : null,
    notes: JSON.stringify({
      trade_area: vessel.trade_area || null,
      owner_name: vessel.owner_name || null,
      class_number: vessel.class_number || null,
      class_notation: vessel.class_notation || null,
      engine_maker: vessel.engine_maker || null,
      source: payload?.source || 'live',
      synced_at: new Date().toISOString(),
    }),
  }

  const [existingRows] = await pool.query(
    'SELECT id, deleted_at FROM vessel WHERE imo_number = ? LIMIT 1',
    [imoNumber]
  )
  let vesselId = null
  if (existingRows[0]) {
    vesselId = existingRows[0].id
    await pool.query(
      `UPDATE vessel
       SET vessel_name = ?, vessel_type = ?, flag_country = ?, mmsi = ?, call_sign = ?, trade_area = ?, gross_tonnage = ?, deadweight = ?,
           engine_power_kw = ?, engine_type = ?, dp_class = ?, has_boiler = ?, has_refrigeration = ?,
           passenger_capacity = ?, crew_capacity = ?, year_built = ?, classification_society = ?,
           class_status = ?, lifecycle_status = ?, technical_manager = ?, notes = ?, deleted_at = NULL, updated_at = NOW()
       WHERE id = ?`,
      [
        mapped.vessel_name,
        mapped.vessel_type,
        mapped.flag_country,
        mapped.mmsi,
        mapped.call_sign,
        mapped.trade_area,
        mapped.gross_tonnage,
        mapped.deadweight,
        mapped.engine_power_kw,
        mapped.engine_type,
        mapped.dp_class,
        mapped.has_boiler,
        mapped.has_refrigeration,
        mapped.passenger_capacity,
        mapped.crew_capacity,
        mapped.year_built,
        mapped.classification_society,
        mapped.class_status,
        mapped.lifecycle_status,
        mapped.technical_manager,
        mapped.notes,
        vesselId,
      ]
    )
  } else {
    const [result] = await pool.query(
      `INSERT INTO vessel (
         vessel_name, imo_number, vessel_type, flag_country, mmsi, call_sign, trade_area, gross_tonnage, deadweight,
         engine_power_kw, engine_type, dp_class, has_boiler, has_refrigeration,
         passenger_capacity, crew_capacity, year_built, classification_society,
         class_status, lifecycle_status, technical_manager, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mapped.vessel_name,
        mapped.imo_number,
        mapped.vessel_type,
        mapped.flag_country,
        mapped.mmsi,
        mapped.call_sign,
        mapped.trade_area,
        mapped.gross_tonnage,
        mapped.deadweight,
        mapped.engine_power_kw,
        mapped.engine_type,
        mapped.dp_class,
        mapped.has_boiler,
        mapped.has_refrigeration,
        mapped.passenger_capacity,
        mapped.crew_capacity,
        mapped.year_built,
        mapped.classification_society,
        mapped.class_status,
        mapped.lifecycle_status,
        mapped.technical_manager,
        mapped.notes,
      ]
    )
    vesselId = result.insertId
  }

  const [[saved]] = await pool.query(
    `SELECT id, vessel_name, imo_number, mmsi, call_sign, gross_tonnage, deadweight, engine_power_kw,
            vessel_type, flag_country, trade_area,
            engine_type, dp_class, has_boiler, has_refrigeration, passenger_capacity, crew_capacity,
            year_built, classification_society, class_status, lifecycle_status, technical_manager,
            notes, updated_at
     FROM vessel
     WHERE id = ?`,
    [vesselId]
  )

  return {
    vessel: saved,
    external: payload,
  }
}

const vesselExternalService = {
  async fetchAndUpsertByImo(rawImo, refresh = false) {
    const imo = normalizeImo(rawImo)
    if (!/^\d{7}$/.test(imo)) {
      throw { statusCode: 400, message: 'IMO không hợp lệ (phải gồm đúng 7 chữ số)' }
    }
    const payload = await fetchDecryptedVesselByImo(imo, !!refresh)
    return upsertVesselFromExternal(payload, imo)
  },
}

module.exports = vesselExternalService
