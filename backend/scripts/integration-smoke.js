// Live MariaDB + Fastify handlers + bcrypt/JWT + upload/files + XLSX. No mocked services.
require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const config = require('../src/config')
const pool = require('../src/config/db')
const { buildApp } = require('../server')
const XLSX = require('xlsx')
async function main() {
  assert.equal(process.env.MCAH_TEST_CONFIRM, config.db.database, 'Explicit test DB confirmation required')
  assert.match(config.db.database, /^mcah_.*(test|clean)$/)
  assert.ok(!process.env.ANTHROPIC_API_KEY, 'This missing-provider smoke must not consume AI quota')
  const app = buildApp({ logger: false })
  const stamp = Date.now()
  let checks = 0
  const check = (condition, label) => { assert.ok(condition, label); checks++; console.log(`PASS ${label}`) }
  async function api(method, url, token, payload) {
    return app.inject({ method, url: '/api/v1' + url, remoteAddress: method === 'POST' && url === '/auth/login' ? `127.0.1.${checks + 1}` : '127.0.0.1', headers: token ? { authorization: `Bearer ${token}` } : {}, payload })
  }
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    check((await fetch(address + '/health')).status === 200, 'real HTTP listener health')
    check((await app.inject('/health')).statusCode === 200, 'health')
    const readiness = await app.inject('/ready')
    check(readiness.statusCode === 200 && readiness.json().checks.ai === 'not_configured', 'ready: real DB/storage; AI missing is explicit')
    check((await api('GET', '/seafarers')).statusCode === 401, 'anonymous list 401')
    check((await api('GET', '/seafarers', 'invalid')).statusCode === 401, 'invalid token 401')
    const login = await api('POST', '/auth/login', null, { email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
    check(login.statusCode === 200, 'bootstrap admin bcrypt login')
    const [[originalAdmin]] = await pool.query('SELECT password_hash FROM `user` WHERE email = ?', [process.env.BOOTSTRAP_ADMIN_EMAIL])
    const bootstrap = spawnSync(process.execPath, ['scripts/bootstrap-admin.js'], { env: process.env, encoding: 'utf8' })
    check(bootstrap.status === 0, 'bootstrap rerun succeeds without password reset')
    const [[sameAdmin]] = await pool.query('SELECT password_hash FROM `user` WHERE email = ?', [process.env.BOOTSTRAP_ADMIN_EMAIL])
    check(originalAdmin.password_hash === sameAdmin.password_hash, 'bootstrap preserves stored bcrypt hash')
    const admin = login.json().token
    const tokens = { admin }
    const ids = {}
    for (const role of ['operator', 'reviewer', 'training_center', 'manning_agent', 'seafarer']) {
      const email = `${role}-${stamp}@mcah.test`
      const created = await api('POST', '/users', admin, { email, password: 'integration-only-pass123', role })
      check(created.statusCode === 201, `admin creates ${role}`)
      ids[role] = created.json().data.id
      const response = await api('POST', '/auth/login', null, { email, password: 'integration-only-pass123' })
      check(response.statusCode === 200, `${role} real login`)
      tokens[role] = response.json().token
    }
    const operator = tokens.operator, reviewer = tokens.reviewer
    for (const role of ['training_center', 'manning_agent', 'seafarer']) {
      for (const route of ['/seafarers', '/seafarers/export', '/documents/1/file', '/exports']) {
        check((await api('GET', route, tokens[role])).statusCode === 403, `${role} denied ${route}`)
      }
    }
    check((await api('GET', '/users', reviewer)).statusCode === 403, 'reviewer cannot administer')
    check((await api('POST', '/seafarers', reviewer, {})).statusCode === 403, 'reviewer cannot create profile')
    const [[country]] = await pool.query('SELECT id FROM country LIMIT 1')
    const profile = await api('POST', '/seafarers', operator, { full_name: `Synthetic MCAH ${stamp}`, date_of_birth: '1990-01-01', nationality_id: country.id })
    check(profile.statusCode === 201, 'operator creates real profile')
    const profileId = profile.json().id
    for (const route of ['/seafarers', `/seafarers/${profileId}`, `/seafarers/${profileId}/revisions`, '/documents/status', `/documents/seafarer/${profileId}`, '/exports/templates', '/exports', '/seafarers/forms', '/lookup/countries']) {
      const response = await api('GET', route, reviewer)
      check(response.statusCode === 200, `reviewer reads ${route}: ${response.statusCode}`)
    }
    const exported = await api('GET', '/seafarers/export', reviewer)
    check(exported.statusCode === 200 && XLSX.read(exported.rawPayload).SheetNames.length > 0, 'reviewer downloads real XLSX list')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0xkAAAAASUVORK5CYII=', 'base64')
    const boundary = 'mcah00boundary'
    const uploaded = await app.inject({ method: 'POST', url: `/api/v1/documents/seafarer/${profileId}`, headers: { authorization: `Bearer ${operator}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${boundary}--\r\n`)]) })
    check(uploaded.statusCode === 201, 'real upload PNG to private storage')
    const documentId = uploaded.json().id
    let document
    for (let n = 0; n < 30; n++) {
      document = await api('GET', `/documents/${documentId}`, reviewer)
      if (document.json().status !== 'READING') break
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    check(document.json().status === 'FAILED' && document.json().error.includes('cấu hình'), 'missing AI becomes real FAILED, no fabricated extraction')
    const source = await api('GET', `/documents/${documentId}/file`, reviewer)
    check(source.statusCode === 200 && source.rawPayload.equals(png), 'reviewer downloads exact original source bytes')
    const [[savedSource]] = await pool.query('SELECT storage_path FROM seafarer_document WHERE id = ?', [documentId])
    await pool.query('UPDATE seafarer_document SET storage_path = ? WHERE id = ?', [require('path').resolve(__dirname, '../package.json'), documentId])
    check((await api('GET', `/documents/${documentId}/file`, reviewer)).statusCode === 403, 'inherited path outside private storage rejected')
    await pool.query('UPDATE seafarer_document SET storage_path = ? WHERE id = ?', [savedSource.storage_path, documentId])
    check((await api('GET', `/documents/${documentId}/file`)).statusCode === 401, 'source unauthenticated 401')
    check((await api('GET', '/documents/2147483647/file', reviewer)).statusCode === 404, 'missing source 404')
    check((await api('POST', `/documents/${documentId}/retry`, reviewer)).statusCode === 403, 'reviewer cannot retry upload')
    const pack = await api('POST', '/exports', operator, { seafarer_id: profileId, docs: ['cv'] })
    check(pack.statusCode === 201, 'operator creates real export pack')
    const packId = pack.json().id
    check((await api('GET', `/exports/${packId}`, reviewer)).statusCode === 200, 'reviewer pack detail')
    check((await api('POST', `/exports/${packId}/approve`, operator)).statusCode === 403, 'operator approval denied')
    check((await api('POST', `/exports/${packId}/reject`, reviewer, { reason: 'Synthetic smoke rejection' })).statusCode === 200, 'reviewer returns pack')
    const selfPack = await api('POST', '/exports', admin, { seafarer_id: profileId, docs: ['cv'] })
    check((await api('POST', `/exports/${selfPack.json().id}/approve`, admin)).statusCode === 403, 'admin maker self approval denied')
    const approvedPack = await api('POST', '/exports', operator, { seafarer_id: profileId, docs: ['cv'] })
    check((await api('POST', `/exports/${approvedPack.json().id}/approve`, reviewer)).statusCode === 200, 'reviewer approves another maker')
    const download = await api('GET', `/exports/${approvedPack.json().id}/download`, reviewer)
    console.log(`BASELINE owner/internal pack download: HTTP ${download.statusCode}; ${download.statusCode === 200 ? 'artifact returned' : download.body}`)
    await pool.query('UPDATE `user` SET is_active = 0 WHERE id = ?', [ids.reviewer])
    check((await api('GET', '/seafarers', reviewer)).statusCode === 401, 'disabled account invalidates existing JWT')
    check((await api('POST', '/auth/register', null, { email: 'blocked@mcah.test', password: '123456' })).statusCode === 403, 'public legacy signup disabled')
    const [before] = await pool.query('SELECT * FROM mcah_migration_history ORDER BY name')
    const rerun = spawnSync(process.execPath, ['scripts/migrate.js'], { cwd: require('path').resolve(__dirname, '..'), env: process.env, encoding: 'utf8' })
    check(rerun.status === 0, 'migrate rerun succeeds')
    const [after] = await pool.query('SELECT * FROM mcah_migration_history ORDER BY name')
    check(JSON.stringify(before) === JSON.stringify(after), 'migrate rerun leaves history unchanged')
    await pool.query('UPDATE mcah_migration_history SET state = \'RUNNING\' WHERE name = \'021_mcah_instance.sql\'')
    check((await app.inject('/ready')).statusCode === 503, 'readiness rejects incomplete migrations')
    await pool.query('UPDATE mcah_migration_history SET state = \'APPLIED\' WHERE name = \'021_mcah_instance.sql\'')
    console.log(`PASS ${checks} live assertions; no provider request claimed`)
  } finally { await app.close(); await pool.end() }
}
main().catch(err => { console.error(err); process.exitCode = 1 })
