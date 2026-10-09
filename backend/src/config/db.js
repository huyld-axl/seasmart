const mysql = require('mysql2/promise')
const config = require('../config')

const pool = mysql.createPool({
  socketPath: config.db.socketPath,
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

module.exports = pool
