// Nhận báo lỗi từ màn lỗi khởi động của app: không cần đăng nhập, giới hạn kích thước và tốc độ, lưu nguyên gói.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
import zlib from 'zlib'

const require = createRequire(import.meta.url)
const { resetDb } = require('./helpers')
const { build } = require('../server')
let app
const pool = () => require('../src/db')
const bundle = (meta, files = { 'main.log': 'dòng log' }) => zlib.gzipSync(JSON.stringify({ meta, files }))
const send = (payload, ip = '10.3.0.1') => app.inject({ method: 'POST', url: '/api/bug-report', remoteAddress: ip, headers: { 'content-type': 'application/gzip' }, payload })

beforeAll(async () => {
  await resetDb()
  app = build({ logger: false })
  await app.ready()
})
afterAll(() => app.close())

describe('POST /api/bug-report', () => {
  it('lưu báo lỗi không cần đăng nhập', async () => {
    const res = await send(bundle({ errorCode: 'DB_MIGRATE', appVersion: '0.9.5', platform: 'win32', note: 'mở không được' }))
    expect(res.statusCode).toBe(201)
    const { rows } = await pool().query('SELECT error_code, app_version, platform, note, ip FROM bug_report WHERE id = $1', [res.json().id])
    expect(rows[0]).toMatchObject({ error_code: 'DB_MIGRATE', app_version: '0.9.5', platform: 'win32', note: 'mở không được', ip: '10.3.0.1' })
  })

  it('từ chối gói không phải gzip JSON hợp lệ', async () => {
    expect((await send(Buffer.from('không phải gzip'))).statusCode).toBe(400)
    expect((await send(zlib.gzipSync('{"files":{}}'))).statusCode).toBe(400)
  })

  it('từ chối gói quá lớn', async () => {
    const big = zlib.gzipSync(JSON.stringify({ meta: { errorCode: 'X' }, files: { a: 'x'.repeat(9 * 1024 * 1024) } }))
    expect((await send(big, '10.3.0.2')).statusCode).toBe(400)
  })

  it('giới hạn 5 báo lỗi mỗi giờ mỗi IP', async () => {
    const codes = []
    for (let i = 0; i < 6; i++) codes.push((await send(bundle({ errorCode: 'X' }), '10.3.0.9')).statusCode)
    expect(codes).toEqual([201, 201, 201, 201, 201, 429])
  })
})
