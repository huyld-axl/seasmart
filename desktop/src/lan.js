// Hằng số dùng chung giữa máy chính và máy nhân viên (docs/catoro-ke-hoach-desktop-gd3.md 3.5).
// PROTOCOL tăng khi API giữa hai máy đổi kiểu không tương thích: khác số thì máy nhân viên phải cập nhật theo máy chính.
const { productEnv } = require('./env')

module.exports = {
  PROTOCOL: 1,
  LAN_PORT: Number(productEnv('LAN_PORT')) || 7443,
  SERVICE: 'mcah', // giữ khi đổi tên Catoro: máy bản cũ tìm máy chính theo tên này
}
