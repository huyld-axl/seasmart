// Tìm máy chính trong mạng văn phòng bằng mDNS (docs/mcah-ke-hoach-desktop-gd3.md 3.1, 3.2): dịch vụ _mcah._tcp,
// TXT chỉ có office (mã văn phòng) và proto. Tìm thấy chưa đủ tin: máy nhân viên luôn kiểm dấu vân tay chứng chỉ.
const { Bonjour } = require('bonjour-service')
const { PROTOCOL, SERVICE } = require('./lan')

let bonjour = null
const instance = () => (bonjour ||= new Bonjour())

function advertise({ name, port, officeId }) {
  instance().unpublishAll()
  instance().publish({ name: `MCAH ${name}`, type: SERVICE, port, txt: { office: officeId, proto: String(PROTOCOL), host: name } })
}

// → [{ name, host, addresses, port }] của máy chính văn phòng officeId, chờ tối đa ms.
function find(officeId, ms = 5000) {
  return new Promise((resolve) => {
    const found = new Map()
    const browser = instance().find({ type: SERVICE }, (svc) => {
      if (svc.txt?.office !== officeId) return
      const addresses = (svc.addresses || []).filter((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a))
      found.set(svc.fqdn, { name: svc.txt.host || svc.host, host: svc.host, addresses, port: svc.port })
    })
    setTimeout(() => {
      browser.stop()
      resolve([...found.values()])
    }, ms)
  })
}

function stop() {
  if (!bonjour) return
  bonjour.unpublishAll()
  bonjour.destroy()
  bonjour = null
}

module.exports = { advertise, find, stop }
