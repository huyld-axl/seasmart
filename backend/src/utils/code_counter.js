// Lấy số kế tiếp của (kind, year) trong cùng transaction với câu INSERT dùng nó.
async function nextCode(conn, kind, year, prefix, width) {
  const [res] = await conn.query(
    `INSERT INTO "code_counter" ("kind", "year", "last_value") VALUES (?, ?, 1)
     ON CONFLICT ("kind", "year") DO UPDATE SET "last_value" = "code_counter"."last_value" + 1
     RETURNING "last_value"`,
    [kind, year]
  )
  return `${prefix}-${year}-${String(res.rows[0].last_value).padStart(width, '0')}`
}

module.exports = { nextCode }
