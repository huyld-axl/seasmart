const path = require('path')
const fs = require('fs')

function loadEnvironment(env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || ['change_this_to_a_long_random_string'].includes(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a random secret of at least 32 characters')
  }
  if (!/^mcah_[a-zA-Z0-9_]+$/.test(env.DB_NAME || '')) {
    throw new Error('DB_NAME must start with mcah_; legacy databases are forbidden')
  }
  if (env.MCAH_INSTANCE !== env.DB_NAME) throw new Error('MCAH_INSTANCE must equal DB_NAME to confirm the target')
  if (!env.DB_USER || !env.DB_HOST) throw new Error('DB_HOST and DB_USER are required')
  const base = path.resolve(__dirname, '../..')
  if (!env.UPLOAD_DIR) throw new Error('UPLOAD_DIR is required')
  const uploadDir = path.resolve(base, env.UPLOAD_DIR)
  // Resolve existing ancestors too: a symlink must never point to legacy storage.
  let ancestor = uploadDir
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
  const realDir = path.join(fs.realpathSync(ancestor), path.relative(ancestor, uploadDir))
  if (realDir.toLowerCase().includes('crew-manning') || !realDir.startsWith(path.join(base, 'storage') + path.sep)) {
    throw new Error('UPLOAD_DIR must be private storage under seasmart/backend/storage, outside Crew-Manning')
  }
  function integer(key, fallback, max) {
    const value = Number(env[key] || fallback)
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${key} is invalid`)
    return value
  }
  return {
    port: integer('PORT', 3000, 65535), host: env.HOST || '127.0.0.1',
    db: { host: env.DB_HOST, port: integer('DB_PORT', 3306, 65535), user: env.DB_USER,
      password: env.DB_PASSWORD || '', database: env.DB_NAME, socketPath: env.DB_SOCKET || undefined },
    jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN || '7d' },
    upload: { dir: realDir, maxFileSize: integer('MAX_FILE_SIZE', 25 * 1024 * 1024, 25 * 1024 * 1024) },
    sendgrid: { apiKey: env.SENDGRID_API_KEY || '', fromEmail: env.SENDGRID_FROM_EMAIL || '', fromName: env.SENDGRID_FROM_NAME || 'MCAH' },
  }
}
module.exports = { loadEnvironment }
