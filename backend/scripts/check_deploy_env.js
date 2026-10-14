// Deployment checks log no configuration values or query data.
const db = require('../src/config/db')
const config = require('../src/config')
async function check() {
  if (config.jwt.secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
  await db.query('SELECT 1')
  const [columns] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'export_pack'")
  if (['ship_owner_id', 'edits'].some((name) => !columns.some((column) => column.column_name === name))) {
    throw new Error('PostgreSQL export-pack migrations are missing')
  }
  console.log('Backend configuration and PostgreSQL connection: OK')
}
check().catch((error) => {
  console.error(error.code ? `Deployment preflight failed (${error.code})` : error.message)
  process.exitCode = 1
}).finally(() => db.end())
