// Parameter builder for repository conventions: ? values, object assignments,
// IN arrays and bulk rows. All values are bound through node-postgres.
function identifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error('Invalid SQL identifier')
  return `"${value}"`
}

function prepareQuery(sql, params = []) {
  const values = []
  let paramIndex = 0
  const bind = (value) => {
    values.push(typeof value === 'boolean' ? Number(value) : value ?? null)
    return `$${values.length}`
  }
  const expand = (value, offset) => {
    if (Array.isArray(value)) {
      if (!value.length) return 'NULL'
      return value.map((item) => Array.isArray(item) ? `(${item.map(bind).join(', ')})` : bind(item)).join(', ')
    }
    if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value) && /\bSET\s*$/i.test(sql.slice(0, offset))) {
      const entries = Object.entries(value)
      if (!entries.length) throw new Error('Empty SQL assignment')
      return entries.map(([key, item]) => `${identifier(key)} = ${bind(item)}`).join(', ')
    }
    return bind(value)
  }

  const insertObject = /^\s*INSERT\s+INTO\s+([\w".]+)\s+SET\s+\?\s*;?\s*$/i.exec(sql)
  if (insertObject) {
    const data = params[0]
    if (!data || Array.isArray(data) || typeof data !== 'object' || params.length !== 1) throw new Error('Invalid insert data')
    const entries = Object.entries(data)
    if (!entries.length) throw new Error('Empty insert data')
    return {
      text: `INSERT INTO ${insertObject[1]} (${entries.map(([key]) => identifier(key)).join(', ')}) VALUES (${entries.map(([,value]) => bind(value)).join(', ')}) RETURNING *`,
      values,
    }
  }

  // Skip SQL strings, identifiers and comments; literal ? must not consume data.
  const token = /'(?:''|[^'])*'|"(?:""|[^"])*"|\$([a-zA-Z_][a-zA-Z0-9_]*)?\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\/|\?/g
  let text = sql.replace(token, (part, _tag, offset) => {
    if (part !== '?') return part
    if (paramIndex >= params.length) throw new Error('Missing SQL parameter')
    return expand(params[paramIndex++], offset)
  }).trim().replace(/;$/, '')
  if (paramIndex !== params.length) throw new Error('Unexpected SQL parameters')
  if (/^INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text)) text += ' RETURNING *'
  return { text, values }
}

function wrapConnection(connection, release) {
  return {
    async query(sql, params) {
      const result = await connection.query(prepareQuery(sql, params))
      if (['INSERT', 'UPDATE', 'DELETE'].includes(result.command)) {
        return [{ insertId: result.rows[0]?.id, affectedRows: result.rowCount, rows: result.rows }]
      }
      return [result.rows]
    },
    async beginTransaction() { await connection.query('BEGIN') },
    async commit() { await connection.query('COMMIT') },
    async rollback() { await connection.query('ROLLBACK') },
    release: release || (() => {}),
  }
}

function wrapPool(pool) {
  return {
    ...wrapConnection(pool),
    async getConnection() {
      const connection = await pool.connect()
      return wrapConnection(connection, () => connection.release())
    },
    end: () => pool.end(),
    native: pool,
  }
}

module.exports = { prepareQuery, wrapPool }
