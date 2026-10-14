const { Pool, types } = require('pg')
const config = require('../config')
const { wrapPool } = require('../utils/postgres_query')

types.setTypeParser(1082, (value) => value)
types.setTypeParser(20, (value) => {
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new RangeError('Database integer exceeds JavaScript safe range')
  return number
})

const nativePool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10,
  connectionTimeoutMillis: 10000,
  options: '-c timezone=UTC',
})
nativePool.on('error', (error) => console.error('PostgreSQL connection error:', error.code || 'UNKNOWN'))

module.exports = wrapPool(nativePool)
