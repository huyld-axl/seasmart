require('dotenv').config()

const INSECURE_JWT_DEFAULTS = ['dev_secret', 'change_this_to_a_long_random_string', 'secret', '']
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || INSECURE_JWT_DEFAULTS.includes(jwtSecret)) {
  throw new Error(
    'JWT_SECRET is not set or is using an insecure default value. ' +
      'Set a strong random secret in your .env file (min 32 chars).'
  )
}

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'marineport',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@marineport.vn',
    fromName: process.env.SENDGRID_FROM_NAME || 'MarinePort',
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'anthropic',
    apiKey: process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    model: process.env.LLM_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    baseURL: process.env.LLM_BASE_URL || process.env.ANTHROPIC_BASE_URL || '',
  },
}
