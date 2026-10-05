const fs = require('fs')
const path = require('path')
const db = require('../config/db')

async function runSqlFile(filePath, checkQuery) {
  const sql = fs.readFileSync(filePath, 'utf8')
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    await db.execute(stmt)
  }

  if (checkQuery) {
    const [rows] = await db.execute(checkQuery)
    return rows
  }
  return []
}

const runMigration = async (req, res) => {
  try {
    const rows = await runSqlFile(
      path.join(__dirname, '../../migrations/018_training_center_course.sql'),
      'DESCRIBE training_center_course'
    )
    res.json({ success: true, message: 'Migration 018 completed', tableStructure: rows })
  } catch (error) {
    console.error('Migration 018 failed:', error)
    res.status(500).json({ success: false, message: 'Migration failed', error: error.message })
  }
}

const runMigration020 = async (req, res) => {
  try {
    await runSqlFile(
      path.join(__dirname, '../../migrations/020_drop_training_center_course_tables.sql'),
      null
    )
    res.json({ success: true, message: 'Migration 020 completed - training tables dropped' })
  } catch (error) {
    console.error('Migration 020 failed:', error)
    res.status(500).json({ success: false, message: 'Migration failed', error: error.message })
  }
}

const runMigration019 = async (req, res) => {
  try {
    await runSqlFile(
      path.join(__dirname, '../../migrations/019_employment_contract_nullable.sql'),
      null
    )
    const [rows] = await db.execute('DESCRIBE employment_contract')
    res.json({
      success: true,
      message: 'Migration 019 completed - employment_contract columns now nullable',
      tableStructure: rows,
    })
  } catch (error) {
    console.error('Migration 019 failed:', error)
    res.status(500).json({ success: false, message: 'Migration failed', error: error.message })
  }
}

module.exports = { runMigration, runMigration019, runMigration020 }
