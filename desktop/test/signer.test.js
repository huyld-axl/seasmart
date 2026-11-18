// Cổng ký: ký đúng chuỗi mà máy chủ dịch vụ kiểm (cloud/src/routes/api.js signingInput); sai mã cổng bị từ chối;
// đường dẫn ngoài danh sách cho phép bị từ chối.
require('./fake-electron')
const test = require('node:test')
const assert = require('node:assert')
const http = require('http')
const crypto = require('crypto')
const signer = require('../src/signer')
const { signingInput } = require('../../cloud/src/routes/api')

test('ký đúng như máy chủ dịch vụ kiểm', async () => {
  const keys = crypto.generateKeyPairSync('ed25519')
  let seen = null
  const cloud = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const ok = crypto.verify(null, Buffer.from(signingInput(req.method, req.url.split('?')[0], Number(req.headers['x-mcah-time']), body)), keys.publicKey, Buffer.from(req.headers['x-mcah-signature'], 'base64'))
      seen = { ok, office: req.headers['x-mcah-office'], body }
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"id":"loi-moi"}')
    })
  })
  await new Promise((r) => cloud.listen(0, '127.0.0.1', r))
  const s = await signer.start({ cloudUrl: () => `http://127.0.0.1:${cloud.address().port}`, machineKey: () => ({ privateKey: keys.privateKey }) })
  const office = '75b195c4-8c26-411d-92fc-7c208a0f6edf'
  const call = (token, path) => fetch(`${s.url}/call`, { method: 'POST', headers: { 'x-signer-token': token }, body: JSON.stringify({ office_id: office, path, body: { email: 'nv@thu.vn' } }) })
  const r = await (await call(s.token, '/api/office/members')).json()
  assert.deepStrictEqual(r, { status: 200, body: { id: 'loi-moi' } })
  assert.strictEqual(seen.ok, true)
  assert.strictEqual(seen.office, office)
  assert.strictEqual((await call('sai-ma', '/api/office/members')).status, 401)
  assert.strictEqual((await call(s.token, '/api/offices')).status, 400)
  s.close()
  cloud.close()
})

// Mỗi đường máy chủ dịch vụ kiểm bằng chữ ký máy chính phải qua được cổng ký, nếu không backend gọi là lỗi 502
// (lỗi 0.9.5: thêm tài khoản gọi /api/office/members mà cổng ký vẫn chỉ cho /api/office/invites).
test('cổng ký cho qua mọi đường byMachine của máy chủ dịch vụ', () => {
  const fs = require('fs')
  const path = require('path')
  const dir = path.join(__dirname, '../../cloud/src')
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js'))
  const routes = files.flatMap((f) => [...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/fastify\.(?:get|post)\('([^']+)',\s*\{[^}]*byMachine/g)].map((m) => m[1]))
  assert.ok(routes.includes('/api/office/members'))
  for (const route of routes) assert.ok(signer.ALLOWED.test(route.replace(':imo', '1234567')), `cổng ký chặn ${route}`)
})
