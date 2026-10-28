require('dotenv').config({ quiet: true })
const fs = require('fs')

const INSECURE_JWT_DEFAULTS = ['dev_secret', 'change_this_to_a_long_random_string', 'secret', '']
const jwtSecret = process.env.JWT_SECRET || (process.env.JWT_SECRET_FILE ? fs.readFileSync(process.env.JWT_SECRET_FILE, 'utf8').trim() : '')
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
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'seasmart',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '',
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'seasmart',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
  // AI đọc giấy tờ. Mã model lấy từ môi trường, không ghi cứng trong code.
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || '',
    openaiModelSmall: process.env.OPENAI_MODEL_SMALL || '',
    openaiModelStrong: process.env.OPENAI_MODEL_STRONG || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.DOC_READER_MODEL || '',
    concurrency: parseInt(process.env.AI_CONCURRENCY) || 3,
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS) || 120000,
  },
  // Lấy thông tin thông minh (tra tàu theo IMO ở nguồn ngoài). provider rỗng = tắt tính năng.
  vesselLookup: {
    provider: process.env.VESSEL_LOOKUP_PROVIDER || '',
    baseUrl: process.env.VESSEL_API_BASE_URL || '',
    encKey: process.env.VESSEL_API_ENC_KEY || '',
    cooldownSeconds: parseInt(process.env.VESSEL_LOOKUP_COOLDOWN_SECONDS) || 120,
    globalCooldownSeconds: parseInt(process.env.VESSEL_LOOKUP_GLOBAL_COOLDOWN_SECONDS) || 120,
    timeoutMs: parseInt(process.env.VESSEL_LOOKUP_TIMEOUT_MS) || 60000,
  },
  // Mail server công ty (SMTP). Thiếu host thì không gửi, chỉ ghi log.
  // useSsl: TLS ngay khi kết nối (thường cổng 465). useTls: nâng cấp bằng STARTTLS (thường cổng 587).
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT) || 587,
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    useSsl: process.env.SMTP_USE_SSL === 'true',
    useTls: process.env.SMTP_USE_TLS === 'true',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@marineport.vn',
    fromName: process.env.SMTP_FROM_NAME || 'MarinePort',
  },
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
}
