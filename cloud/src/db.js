const { Pool, types } = require('pg')
const config = require('./config')

// DATE trả chuỗi yyyy-mm-dd, không đổi múi giờ.
types.setTypeParser(1082, (value) => value)

const pool = new Pool({ ...config.db, max: 10 })
pool.on('error', (error) => console.error('PostgreSQL:', error.code || error.message))

module.exports = pool
