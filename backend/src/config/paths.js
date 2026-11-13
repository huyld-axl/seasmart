// Thư mục gốc của backend và các thư mục con đọc lúc chạy. App máy tính gom backend thành một khối (bytecode,
// docs/mcah-ke-hoach-desktop-gd5.md 3.2) nên __dirname của từng module không còn đúng: app đặt MCAH_BACKEND_ROOT.
// Bản web / chạy dev: tính từ vị trí tệp này.
const path = require('path')

const BACKEND_ROOT = process.env.MCAH_BACKEND_ROOT || path.resolve(__dirname, '../..')

module.exports = {
  BACKEND_ROOT,
  PUBLIC_DIR: path.join(BACKEND_ROOT, 'public'),
  TEMPLATES_DIR: path.join(BACKEND_ROOT, 'src/templates'),
  MIGRATIONS_DIR: path.join(BACKEND_ROOT, 'migrations/postgres'),
  FORMS_DIR: process.env.FORMS_DIR || path.resolve(BACKEND_ROOT, '../forms'),
}
