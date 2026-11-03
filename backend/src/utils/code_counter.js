// Lấy số kế tiếp của (kind, year) trong cùng transaction với câu INSERT dùng nó.
// shortYear: mã dạng CH26001 thay vì CH-2026-001.
async function nextCode(conn, kind, year, prefix, width, shortYear = false) {
  const [res] = await conn.query(
    `INSERT INTO "code_counter" ("kind", "year", "last_value") VALUES (?, ?, 1)
     ON CONFLICT ("kind", "year") DO UPDATE SET "last_value" = "code_counter"."last_value" + 1
     RETURNING "last_value"`,
    [kind, year]
  )
  const number = String(res.rows[0].last_value).padStart(width, '0')
  return shortYear ? `${prefix}${String(year).slice(-2)}${number}` : `${prefix}-${year}-${number}`
}

// Mã con nối từ mã cha. Bản ghi đã xoá mềm vẫn giữ mã, nên trùng thì thêm đuôi .2, .3.
async function uniqueCode(conn, table, column, base) {
  const [[{ taken }]] = await conn.query(
    `SELECT COUNT(*)::int AS taken FROM "${table}" WHERE "${column}" = ? OR "${column}" LIKE ?`,
    [base, `${base}.%`]
  )
  return taken ? `${base}.${taken + 1}` : base
}

// Mã chuyến từ cơ hội: {mã cơ hội}-{nn}, nn = số lớn nhất đã dùng + 1. Gọi khi đã khoá dòng cơ hội.
async function nextVoyageCode(conn, opportunityCode) {
  const [rows] = await conn.query('SELECT code FROM "seafarer_voyage" WHERE code LIKE ?', [`${opportunityCode}-%`])
  const used = rows.map((row) => Number.parseInt(row.code.slice(opportunityCode.length + 1), 10)).filter(Number.isFinite)
  return `${opportunityCode}-${String(Math.max(0, ...used) + 1).padStart(2, '0')}`
}

module.exports = { nextCode, uniqueCode, nextVoyageCode }
