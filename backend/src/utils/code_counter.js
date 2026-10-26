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

module.exports = { nextCode }
