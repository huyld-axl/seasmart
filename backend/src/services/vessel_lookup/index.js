const config = require('../../config')
const { isValidImo } = require('../../utils/imo')
const { createLegacyProxy } = require('./legacy_proxy')
const { mapProposal } = require('./map')
const { loadRefs } = require('./refs')

// Mỗi nguồn xuất { name, fetchByImo(imo) }. Thêm nguồn mới = thêm một dòng ở đây.
const PROVIDERS = {
  legacy_proxy: (cfg) => (cfg.baseUrl && cfg.encKey ? createLegacyProxy(cfg) : null),
}

// Cấu hình có thể thiếu (test dựng config giả), khi đó coi như tắt.
const settings = config.vesselLookup || {}

function buildProvider(cfg = settings) {
  const factory = PROVIDERS[cfg.provider]
  return factory ? factory(cfg) : null
}

// Lấy thông tin thông minh: tra tàu theo IMO ở nguồn ngoài, trả BẢN ĐỀ XUẤT, không ghi vào bảng vessel.
// Hai lớp chặn:
//  1. Mỗi IMO: trong `cooldownSeconds` kể từ lần tra, gọi lại cùng IMO trả bản đã lưu (không tốn lượt, không gọi nguồn ngoài).
//  2. Trần chung: cả hệ thống chỉ gọi nguồn ngoài 1 lần mỗi `globalCooldownSeconds`. Lượt được giành bằng UPDATE có điều kiện
//     trong DB (nguyên tử), nên gọi song song, nhiều tài khoản hay nhiều bản backend đều chỉ một yêu cầu qua được.
//     Lượt đã giành thì tính luôn cả khi nguồn lỗi, để nguồn đang hỏng không bị gõ liên tục.
function createVesselLookup({ provider, cooldownSeconds, globalCooldownSeconds = cooldownSeconds }) {
  async function claimGate(db) {
    const [result] = await db.query(
      `UPDATE vessel_lookup_gate SET last_call_at = CURRENT_TIMESTAMP
       WHERE id = 1 AND last_call_at <= CURRENT_TIMESTAMP - (?::int * INTERVAL '1 second')`,
      [globalCooldownSeconds]
    )
    return result.affectedRows === 1
  }

  // Số giây còn lại trước khi hệ thống được gọi nguồn ngoài lần nữa (0 = gọi được ngay).
  async function waitSeconds(db) {
    const [[row]] = await db.query(
      'SELECT GREATEST(0, CEIL(?::int - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_call_at)))) AS wait FROM vessel_lookup_gate WHERE id = 1',
      [globalCooldownSeconds]
    )
    return row ? Number(row.wait) : 0
  }

  return {
    cooldownSeconds,
    globalCooldownSeconds,
    enabled: () => !!provider,
    waitSeconds,

    async lookup(db, imo, userId) {
      if (!provider) throw { statusCode: 503, message: 'Chưa cấu hình Lấy thông tin thông minh' }
      if (!isValidImo(imo)) throw { statusCode: 400, message: 'IMO sai số kiểm tra' }

      // Tuổi bản lưu tính ngay trong SQL để không phụ thuộc múi giờ của tiến trình Node.
      const [[cached]] = await db.query(
        `SELECT status, raw, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fetched_at)) AS age,
                to_char(fetched_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fetched_at
         FROM vessel_lookup WHERE imo_number = ? AND provider = ?`,
        [imo, provider.name]
      )
      let status
      let raw
      let fetchedAt
      let imoWait
      let gateWait
      const fromCache = !!cached && Number(cached.age) < cooldownSeconds
      if (fromCache) {
        status = cached.status
        raw = cached.raw
        fetchedAt = cached.fetched_at
        imoWait = Math.max(0, Math.ceil(cooldownSeconds - Number(cached.age)))
        gateWait = await waitSeconds(db)
      } else {
        if (!(await claimGate(db))) {
          const wait = Math.max(1, await waitSeconds(db))
          throw { statusCode: 429, message: `Hệ thống chỉ gọi nguồn ngoài 1 lần mỗi ${Math.round(globalCooldownSeconds / 60 * 10) / 10} phút. Thử lại sau ${wait} giây.`, retry_after: wait }
        }
        let result
        try {
          result = await provider.fetchByImo(imo)
        } catch (error) {
          // Lượt gọi đã bị tính; báo số giây phải chờ để giao diện đếm ngược.
          throw { ...error, retry_after: globalCooldownSeconds }
        }
        status = result.found ? 'FOUND' : 'NOT_FOUND'
        raw = result.found ? result.raw : null
        fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
        imoWait = cooldownSeconds
        gateWait = globalCooldownSeconds
        await db.query(
          `INSERT INTO vessel_lookup (imo_number, provider, status, raw, fetched_by)
           VALUES (?, ?, ?, ?::jsonb, ?)
           ON CONFLICT (imo_number, provider)
           DO UPDATE SET status = EXCLUDED.status, raw = EXCLUDED.raw, fetched_by = EXCLUDED.fetched_by, fetched_at = CURRENT_TIMESTAMP`,
          [imo, provider.name, status, raw ? JSON.stringify(raw) : null, userId ?? null]
        )
      }

      const [[existing]] = await db.query('SELECT id, vessel_name, deleted_at FROM vessel WHERE imo_number = ? LIMIT 1', [imo])
      const found = status === 'FOUND'
      const mapped = found ? mapProposal(raw, await loadRefs(db)) : { proposal: {}, unmatched: {}, extra: {} }
      if (found && !mapped.proposal.imo_number) mapped.proposal.imo_number = imo
      return {
        imo_number: imo,
        found,
        fetched_at: fetchedAt,
        from_cache: fromCache,
        // Giao diện đếm ngược theo các số này: gate_wait là trần chung (áp cho mọi tàu), retry_after là lúc tàu này gọi lại được (lớn nhất của hai lớp).
        gate_wait: gateWait,
        retry_after: Math.max(imoWait, gateWait),
        existing_vessel: existing ? { id: existing.id, vessel_name: existing.vessel_name, deleted: !!existing.deleted_at } : null,
        ...mapped,
      }
    },
  }
}

const vesselLookup = createVesselLookup({ provider: buildProvider(), cooldownSeconds: settings.cooldownSeconds || 120, globalCooldownSeconds: settings.globalCooldownSeconds || 120 })

module.exports = { createVesselLookup, buildProvider, vesselLookup }
