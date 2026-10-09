require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), quiet: true })
module.exports = require('./environment').loadEnvironment(process.env)
