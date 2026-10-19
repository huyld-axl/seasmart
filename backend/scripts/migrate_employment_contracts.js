// Chuyển hợp đồng cũ (employment_contract) sang chuyến tàu + vị trí + hợp đồng mới.
// Chạy: node scripts/migrate_employment_contracts.js [--apply]. Không có --apply thì chỉ đọc và in báo cáo (dry run).
// Mỗi dòng cũ một transaction; dòng đã chuyển (notes có "chuyển từ hợp đồng {số cũ}") bị bỏ qua nên chạy lại không tạo trùng.
const { withTransaction } = require('../src/utils/transaction')
const { nextCode } = require('../src/utils/code_counter')
const { parseDate, addMonths } = require('../src/utils/voyage_math')
const { DEFAULT_ITEMS, DEFAULT_TERMS } = require('../src/constants/voyage_contract')

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
const num = (v) => (v == null ? null : Number(v))

// Kế hoạch chuyển cho một dòng cũ: { skip: lý do } hoặc { voyageStatus, start, end, ... }.
function plan(row, today) {
  if (!row.start_date) return { skip: 'Thiếu ngày bắt đầu' }
  let end = row.end_date
  if (!end && row.duration_months) end = iso(addMonths(parseDate(row.start_date), Number(row.duration_months)))
  if (!end) return { skip: 'Thiếu ngày kết thúc và số tháng' }
  if (end < row.start_date) return { skip: 'Ngày kết thúc trước ngày bắt đầu' }
  const actualEnd = row.actual_end_date || null
  const ended = Boolean(actualEnd) || end < today
  const voyageStatus = ended ? 'ENDED' : row.start_date <= today ? 'ONBOARD' : 'PLANNING'
  if (voyageStatus !== 'PLANNING' && !row.sign_on_port_id) return { skip: 'Thiếu cảng xuống tàu (chuyến đã bắt đầu cần có)' }
  if (voyageStatus === 'ENDED' && !row.sign_off_port_id) return { skip: 'Thiếu cảng rời tàu (chuyến đã kết thúc cần có)' }
  const actualDisembark = ended ? actualEnd || end : null
  if (actualDisembark && actualDisembark < row.start_date) return { skip: 'Ngày kết thúc thực tế trước ngày bắt đầu' }
  return { voyageStatus, start: row.start_date, end, actualDisembark }
}

function moneyItems(row) {
  const amounts = {
    BASIC_WAGE: { payable_usd: num(row.basic_wage_usd) },
    LEAVE_PAY: { payable_usd: num(row.leave_pay_usd) },
    SERVICE_FEE: { receivable_usd: num(row.agency_fee_usd) },
    VISA_FEE: { receivable_usd: num(row.visa_fee_usd) },
    MEDICAL: { receivable_usd: num(row.medical_fee_usd) },
    TRAINING: { receivable_usd: num(row.training_fee_usd) },
  }
  return DEFAULT_ITEMS.map((item, index) => ({
    kind: item.kind,
    item_code: item.code,
    receivable_usd: amounts[item.code]?.receivable_usd ?? null,
    payable_usd: amounts[item.code]?.payable_usd ?? null,
    sort_order: index,
  }))
}

async function insertOne(conn, row, p, today) {
  const year = Number(today.slice(0, 4))
  const code = await nextCode(conn, 'VOYAGE', year, 'CT', 3)
  const voyageRow = {
    code,
    vessel_id: row.vessel_id,
    ship_owner_id: row.ship_owner_id,
    embark_port_id: row.sign_on_port_id || null,
    disembark_port_id: row.sign_off_port_id || null,
    planned_embark_date: p.start,
    planned_disembark_date: p.end,
    actual_embark_date: p.voyageStatus === 'PLANNING' ? null : p.start,
    actual_disembark_date: p.actualDisembark,
    status: p.voyageStatus,
  }
  const [voyage] = await conn.query('INSERT INTO voyage SET ?', [voyageRow])
  const [position] = await conn.query('INSERT INTO voyage_position SET ?', [{ voyage_id: voyage.insertId, rank_id: row.rank_id, budget_total_usd: 0, budget_monthly_usd: 0, sort_order: 0 }])
  const contractNumber = await nextCode(conn, 'CONTRACT', year, 'HĐ', 4)
  const notes = [row.notes, row.overtime_rate_usd != null ? `Đơn giá làm thêm cũ ${row.overtime_rate_usd} USD/giờ` : null, `(chuyển từ hợp đồng ${row.contract_number})`].filter(Boolean).join(' ')
  const [contract] = await conn.query('INSERT INTO seafarer_contract SET ?', [{
    contract_number: contractNumber,
    voyage_position_id: position.insertId,
    seafarer_id: row.seafarer_id,
    start_date: p.start,
    end_date: p.end,
    notes,
    status: p.voyageStatus === 'ENDED' ? 'ENDED' : 'DRAFT',
  }])
  for (const item of moneyItems(row)) await conn.query('INSERT INTO contract_item SET ?', [{ ...item, contract_id: contract.insertId }])
  for (const side of ['RECEIVABLE', 'PAYABLE']) await conn.query('INSERT INTO contract_payment_term SET ?', [{ ...DEFAULT_TERMS[side], contract_id: contract.insertId, side }])
  await conn.query('INSERT INTO contract_approval_log SET ?', [{ contract_id: contract.insertId, action: 'CREATE', actor_id: null }])
  return { voyageCode: code, contractNumber }
}

// Trả báo cáo { total, byStatus, migrated, alreadyDone, skipped: [{ number, reason }] }.
async function migrateEmploymentContracts(db, { apply = false } = {}) {
  const [[{ today }]] = await db.query(`SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today`)
  const [rows] = await db.query('SELECT * FROM employment_contract WHERE deleted_at IS NULL ORDER BY id')
  const report = { total: rows.length, byStatus: { PLANNING: 0, ONBOARD: 0, ENDED: 0 }, migrated: 0, alreadyDone: 0, skipped: [] }
  for (const row of rows) {
    const marker = `%chuyển từ hợp đồng ${row.contract_number})%`
    const [done] = await db.query('SELECT 1 FROM seafarer_contract WHERE notes LIKE ? LIMIT 1', [marker])
    if (done.length) {
      report.alreadyDone += 1
      continue
    }
    const p = plan(row, today)
    if (p.skip) {
      report.skipped.push({ number: row.contract_number, reason: p.skip })
      continue
    }
    report.byStatus[p.voyageStatus] += 1
    if (!apply) continue
    try {
      await withTransaction(db, (conn) => insertOne(conn, row, p, today))
      report.migrated += 1
    } catch (error) {
      report.skipped.push({ number: row.contract_number, reason: `Lỗi khi ghi: ${error.message}` })
      report.byStatus[p.voyageStatus] -= 1
    }
  }
  return report
}

function printReport(report, apply) {
  console.log(apply ? 'CHẠY THẬT (--apply)' : 'DRY RUN (không ghi gì)')
  console.log(`Số dòng hợp đồng cũ chưa xoá: ${report.total}`)
  console.log(`Đã chuyển từ trước (bỏ qua): ${report.alreadyDone}`)
  console.log(`Sẽ chuyển${apply ? ' (đã chuyển ' + report.migrated + ')' : ''} theo trạng thái chuyến: Đang chuẩn bị ${report.byStatus.PLANNING} · Đang trên tàu ${report.byStatus.ONBOARD} · Đã kết thúc ${report.byStatus.ENDED}`)
  console.log(`Bỏ qua: ${report.skipped.length}`)
  for (const item of report.skipped) console.log(`  - ${item.number}: ${item.reason}`)
}

module.exports = { migrateEmploymentContracts, plan }

if (require.main === module) {
  const db = require('../src/config/db')
  const apply = process.argv.includes('--apply')
  migrateEmploymentContracts(db, { apply })
    .then((report) => printReport(report, apply))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
    .finally(() => db.end())
}
