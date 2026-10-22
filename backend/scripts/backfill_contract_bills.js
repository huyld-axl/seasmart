// Sinh yêu cầu thanh toán (bên phải thu) cho hợp đồng đã Hiệu lực / Hết hạn trước khi có tính năng bill.
// Chạy lại nhiều lần không sinh trùng: hợp đồng đã có bill thì bỏ qua.
//   node scripts/backfill_contract_bills.js
const db = require('../src/config/db')
const { withTransaction } = require('../src/utils/transaction')
const { contractBillService } = require('../src/services/contract_bill.service')

async function main() {
  const [contracts] = await db.query(
    `SELECT c.id, c.contract_number FROM seafarer_contract c
     WHERE c.status IN ('ACTIVE', 'ENDED') AND c.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM contract_bill b WHERE b.contract_id = c.id AND b.side = 'RECEIVABLE')
     ORDER BY c.id`
  )
  let bills = 0
  for (const contract of contracts) {
    const made = await withTransaction(db, (conn) => contractBillService.generateForContract(conn, contract.id, 'RECEIVABLE'))
    bills += made
    console.log(`${contract.contract_number}: ${made} bill`)
  }
  console.log(`Xong: ${contracts.length} hợp đồng, ${bills} bill`)
}

main()
  .catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
  })
  .finally(() => db.end())
