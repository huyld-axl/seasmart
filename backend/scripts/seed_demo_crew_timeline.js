// Dữ liệu mẫu để xem biểu đồ Đội ngũ của một tàu: 5 chuyến mã DEMO-TL-1…5, ngày tính theo hôm nay.
//   node scripts/seed_demo_crew_timeline.js [vessel_id]   thêm (mặc định: tàu đầu tiên đã có chủ tàu)
//   node scripts/seed_demo_crew_timeline.js --clean       xoá các chuyến DEMO-TL-*
// Dùng thuyền viên đang rảnh (chưa có chuyến đang trên tàu); không đổi trạng thái thuyền viên.
const db = require('../src/config/db')

// [mã, lên (ngày so với hôm nay), rời dự kiến, rời dự kiến ban đầu, rời thực tế, mô tả]
const CASES = [
  ['DEMO-TL-1', -40, 120, 120, null, 'đúng hạn'],
  ['DEMO-TL-2', -200, -3, -3, null, 'quá ngày rời dự kiến 3 ngày'],
  ['DEMO-TL-3', -60, 150, 90, null, 'đã dời ngày rời'],
  ['DEMO-TL-4', -120, 30, 30, -10, 'đã rời tàu'],
  ['DEMO-TL-5', -100, 9, 9, null, 'sắp rời, chưa có người thay'],
]

async function clean() {
  const [result] = await db.query('DELETE FROM seafarer_voyage WHERE code LIKE \'DEMO-TL-%\'')
  console.log(`Đã xoá ${result?.affectedRows ?? 0} chuyến mẫu`)
}

async function seed(vesselArg) {
  const [[exists]] = await db.query('SELECT COUNT(*) AS n FROM seafarer_voyage WHERE code LIKE \'DEMO-TL-%\'')
  if (Number(exists.n)) throw new Error('Đã có chuyến mẫu DEMO-TL-*: chạy --clean trước')
  const [[vessel]] = await db.query(
    `SELECT id, vessel_name, ship_owner_id FROM vessel WHERE deleted_at IS NULL AND ship_owner_id IS NOT NULL${vesselArg ? ' AND id = ?' : ''} ORDER BY id LIMIT 1`,
    vesselArg ? [vesselArg] : []
  )
  if (!vessel) throw new Error('Không tìm thấy tàu có chủ tàu')
  const [people] = await db.query(
    `SELECT s.id FROM seafarer s WHERE s.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM seafarer_voyage v WHERE v.seafarer_id = s.id AND v.leave_date IS NULL AND v.deleted_at IS NULL)
     ORDER BY s.id LIMIT ?`, [CASES.length])
  if (people.length < CASES.length) throw new Error(`Cần ${CASES.length} thuyền viên đang rảnh, chỉ có ${people.length}`)
  const [ranks] = await db.query('SELECT id FROM rank ORDER BY id LIMIT ?', [CASES.length])
  const [[port]] = await db.query('SELECT id FROM port ORDER BY id LIMIT 1')
  if (ranks.length < CASES.length || !port) throw new Error('Thiếu chức danh hoặc cảng trong danh mục')

  for (const [index, [code, join, planned, original, left, note]] of CASES.entries()) {
    await db.query(
      `INSERT INTO seafarer_voyage (code, seafarer_id, rank_id, vessel_id, ship_owner_id, source, manual_reason, join_date, join_port_id,
         planned_leave_date, original_leave_date, leave_date, leave_port_id, notes)
       VALUES (?, ?, ?, ?, ?, 'MANUAL', 'OTHER', CURRENT_DATE + CAST(? AS int), ?, CURRENT_DATE + CAST(? AS int), CURRENT_DATE + CAST(? AS int),
         CASE WHEN CAST(? AS int) IS NULL THEN NULL ELSE CURRENT_DATE + CAST(? AS int) END, ?, ?)`,
      [code, people[index].id, ranks[index].id, vessel.id, vessel.ship_owner_id, join, port.id, planned, original, left, left, left === null ? null : port.id, `Dữ liệu mẫu: ${note}`]
    )
    console.log(`${code}: ${note}`)
  }
  console.log(`Xong. Mở tàu "${vessel.vessel_name}" (/vessels/${vessel.id}) → tab Đội ngũ.`)
}

const arg = process.argv[2]
;(arg === '--clean' ? clean() : seed(arg ? Number(arg) : null))
  .catch((error) => { console.error(error.code ? `Lỗi (${error.code}): ${error.message}` : error.message); process.exitCode = 1 })
  .finally(() => db.end())
