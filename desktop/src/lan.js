// Hằng số dùng chung giữa máy chính và máy nhân viên (docs/mcah-ke-hoach-desktop-gd3.md 3.5).
// PROTOCOL tăng khi API giữa hai máy đổi kiểu không tương thích: khác số thì máy nhân viên phải cập nhật theo máy chính.
module.exports = {
  PROTOCOL: 1,
  LAN_PORT: Number(process.env.MCAH_LAN_PORT) || 7443,
  SERVICE: 'mcah',
}
