// Biến môi trường riêng của sản phẩm: tên CATORO_X, còn nhận tên cũ MCAH_X (trước khi đổi tên MCAH → Catoro, 0.9.14)
// để .env trên server cũ vẫn chạy (docs/catoro-ke-hoach-doi-ten.md 3.3). Không đặt gì thì trả undefined, đặt rỗng thì trả ''.
const warned = new Set()

function productEnv(name) {
  const value = process.env[`CATORO_${name}`]
  if (value !== undefined) return value
  const legacy = process.env[`MCAH_${name}`]
  if (legacy !== undefined && !warned.has(name)) {
    warned.add(name)
    console.warn(`Đang dùng tên biến cũ MCAH_${name}; đổi thành CATORO_${name}.`)
  }
  return legacy
}

module.exports = { productEnv }
