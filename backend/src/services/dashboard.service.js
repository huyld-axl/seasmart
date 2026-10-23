const pool = require('../config/db')
const { EXPIRING_DAYS } = require('../utils/crew_overview')

const MAX_ROWS = 200

const dashboardService = {
  // Chứng chỉ của mọi thuyền viên đã quá hạn hoặc sắp hết hạn (trong EXPIRING_DAYS ngày), gần hạn nhất lên trước.
  // Bỏ chứng chỉ bị thu hồi, không thời hạn, và chứng chỉ đã có bản mới thay (cùng loại, bản kia không thời hạn hoặc hết hạn muộn hơn).
  // ownerId: chỉ thuyền viên do người này tạo (phạm vi "own"), null là tất cả.
  async certificateAlerts({ ownerId = null } = {}) {
    const [rows] = await pool.query(
      `SELECT sc.id, sc.seafarer_id, s.full_name AS seafarer_name, s.seafarer_code,
              COALESCE(r.name_vi, s.rank_name_vi) AS rank_name,
              COALESCE(ct.name_vi, sc.certificate_name_raw, 'Chứng chỉ chưa rõ loại') AS certificate_name,
              ct.category AS certificate_category, sc.certificate_number,
              TO_CHAR(sc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              (sc.expiry_date - CURRENT_DATE) AS days_left
       FROM seafarer_certificate sc
       JOIN seafarer s ON s.id = sc.seafarer_id AND s.deleted_at IS NULL
       LEFT JOIN certificate_type ct ON ct.id = sc.certificate_type_id
       LEFT JOIN "rank" r ON r.id = s.current_rank_id
       WHERE sc.deleted_at IS NULL AND sc.status <> 'REVOKED'
         AND sc.no_expiry = 0 AND sc.expiry_date IS NOT NULL
         AND sc.expiry_date <= CURRENT_DATE + (${EXPIRING_DAYS} * INTERVAL '1 day')
         AND NOT EXISTS (
           SELECT 1 FROM seafarer_certificate nx
           WHERE nx.seafarer_id = sc.seafarer_id AND nx.certificate_type_id = sc.certificate_type_id
             AND nx.id <> sc.id AND nx.deleted_at IS NULL AND nx.status <> 'REVOKED'
             AND (nx.no_expiry = 1 OR nx.expiry_date IS NULL OR nx.expiry_date > sc.expiry_date)
         )
         ${ownerId ? 'AND s.created_by = ?' : ''}
       ORDER BY sc.expiry_date ASC, s.full_name ASC
       LIMIT ${MAX_ROWS}`,
      ownerId ? [ownerId] : []
    )
    return rows.map((row) => ({ ...row, days_left: Number(row.days_left), state: Number(row.days_left) < 0 ? 'EXPIRED' : 'EXPIRING' }))
  },
}

module.exports = dashboardService
