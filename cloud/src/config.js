// Cấu hình máy chủ dịch vụ, đọc từ biến môi trường. Máy dev: không đặt gì thì dùng Postgres của scripts/dev-db.js,
// khoá ký ở .data/signing-key.pem, thư in ra log.
const fs = require('fs')
const path = require('path')

// Máy dev: đọc cloud/.env (không commit). Máy chủ thật đặt biến môi trường / secret của Docker, không cần tệp này.
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true })

const DATA = path.join(__dirname, '../.data')
const devSecret = () => {
  const file = path.join(DATA, 'db-secret')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : ''
}

const DEV_COOKIE_SECRET = 'chi-dung-tren-may-dev-khong-dung-that-0123456789'
// Chạy thật (https) mà chưa đặt CLOUD_COOKIE_SECRET thì dừng: khoá mặc định của máy dev ai cũng đọc được trong repo.
if ((process.env.CLOUD_PUBLIC_URL || '').startsWith('https://') && (!process.env.CLOUD_COOKIE_SECRET || process.env.CLOUD_COOKIE_SECRET === DEV_COOKIE_SECRET || process.env.CLOUD_COOKIE_SECRET.length < 32)) {
  throw new Error('Thiếu CLOUD_COOKIE_SECRET (ít nhất 32 ký tự ngẫu nhiên) cho máy chủ chạy thật')
}

const DEV_TOTP_KEY = Buffer.alloc(32, 7).toString('base64')
// Chạy thật mà thiếu khoá / dùng khoá dev thì dừng, như CLOUD_COOKIE_SECRET.
function adminTotpKey() {
  const raw = process.env.CLOUD_ADMIN_TOTP_KEY || ''
  if (!(process.env.CLOUD_PUBLIC_URL || '').startsWith('https://')) return Buffer.from(raw || DEV_TOTP_KEY, 'base64')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32 || raw === DEV_TOTP_KEY) throw new Error('Thiếu CLOUD_ADMIN_TOTP_KEY (openssl rand -base64 32) cho máy chủ chạy thật')
  return key
}

module.exports = {
  port: parseInt(process.env.PORT) || 4100,
  host: process.env.HOST || '127.0.0.1',
  // Địa chỉ công khai của trang web (liên kết trong thư, chuyển hướng Google).
  publicUrl: (process.env.CLOUD_PUBLIC_URL || 'http://localhost:4100').replace(/\/+$/, ''),
  // Đường dẫn con khi chạy sau proxy (vd. https://mcah.axalize.vn/account → '/account'); proxy bỏ tiền tố trước khi
  // chuyển vào, nên route vẫn là /dang-nhap, còn liên kết / chuyển hướng / cookie phải thêm tiền tố này.
  basePath: new URL(process.env.CLOUD_PUBLIC_URL || 'http://localhost:4100').pathname.replace(/\/+$/, ''),
  secureCookies: (process.env.CLOUD_PUBLIC_URL || '').startsWith('https://'),
  db: {
    host: process.env.CLOUD_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.CLOUD_DB_PORT) || 5544,
    // Trên server: docker/cloud-postgres.env (POSTGRES_*) dùng chung cho Postgres và máy chủ dịch vụ.
    user: process.env.CLOUD_DB_USER || process.env.POSTGRES_USER || 'mcah_cloud',
    password: process.env.CLOUD_DB_PASSWORD || process.env.POSTGRES_PASSWORD || devSecret(),
    database: process.env.CLOUD_DB_NAME || process.env.POSTGRES_DB || 'mcah_cloud',
  },
  signingKeyFile: process.env.CLOUD_SIGNING_KEY_FILE || path.join(DATA, 'signing-key.pem'),
  // Khoá ký cookie phiên trang web.
  cookieSecret: process.env.CLOUD_COOKIE_SECRET || DEV_COOKIE_SECRET,
  offlineDays: 7,
  // Hạn cứng: quá số ngày này từ lần đăng nhập thật qua trình duyệt thì phải đăng nhập lại, dù có mạng.
  sessionMaxDays: 30,
  // Thư hệ thống: cùng tên biến với backend/.env (SMTP_*), chép nguyên sang được. Thiếu SMTP_HOST thì in thư ra log.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT) || 587,
    username: process.env.SMTP_USERNAME || '',
    password: process.env.SMTP_PASSWORD || '',
    useSsl: process.env.SMTP_USE_SSL === 'true',
    useTls: process.env.SMTP_USE_TLS === 'true',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'no-reply@mcah.vn',
    fromName: process.env.SMTP_FROM_NAME || 'Catoro',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  // Admin duy nhất của khu nội bộ /internal (docs/catoro-ke-hoach-khu-noi-bo.md 5.2). Server cũ còn CLOUD_ADMIN_EMAILS (danh
  // sách) thì tạm lấy email đầu để deploy không gãy.
  adminEmail: (process.env.CLOUD_ADMIN_EMAIL || (process.env.CLOUD_ADMIN_EMAILS || '').split(',')[0] || '').trim().toLowerCase(),
  // Khu nội bộ: trang quản trị, đăng nhập quản trị, design system. nginx giữ nguyên tiền tố khi chuyển vào (khác /account).
  internalBase: (process.env.CLOUD_INTERNAL_PATH || '/internal').replace(/\/+$/, ''),
  // Khoá AES-256-GCM mã hoá bí mật TOTP của admin (32 byte, base64).
  adminTotpKey: adminTotpKey(),
}
