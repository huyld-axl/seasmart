import { afterEach, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require('sharp')
const { fleetService } = require('../fleet.service')
const folders = []
afterEach(() => { for (const dir of folders.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
it('tạo thumbnail logo cũ, giữ nền trong suốt và không thay ảnh gốc', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-logo-test-')); folders.push(dir)
  const original = path.join(dir, 'logo.png')
  await sharp({ create: { width: 600, height: 300, channels: 4, background: { r: 0, g: 80, b: 200, alpha: 0.5 } } }).png().toFile(original)
  const pool = { query: async () => [[{ logo_path: original, logo_mime: 'image/png' }]] }
  const before = fs.readFileSync(original)
  const [first, concurrent] = await Promise.all([fleetService.getOwnerLogo(pool, 1, 'thumb'), fleetService.getOwnerLogo(pool, 1, 'thumb')])
  expect(first).toEqual(concurrent)
  expect(first.mime).toBe('image/webp')
  const meta = await sharp(first.path).metadata()
  expect([meta.width, meta.height, meta.hasAlpha]).toEqual([96, 48, true])
  const mtime = fs.statSync(first.path).mtimeMs
  expect((await fleetService.getOwnerLogo(pool, 1, 'thumb')).path).toBe(first.path)
  expect(fs.statSync(first.path).mtimeMs).toBe(mtime)
  expect(fs.readFileSync(original)).toEqual(before)
  expect(await fleetService.getOwnerLogo(pool, 1)).toEqual({ path: original, mime: 'image/png' })
})
it('gỡ logo: logo và thumbnail vào thùng rác (chưa xoá khỏi ổ đĩa), cập nhật phiên bản ảnh', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-logo-test-')); folders.push(dir)
  const original = path.join(dir, 'logo.png')
  await sharp({ create: { width: 20, height: 20, channels: 4, background: 'transparent' } }).png().toFile(original)
  const calls = []
  const pool = { query: async (sql) => { calls.push(sql); return sql.includes('FROM ship_owner o') ? [[{ id: 1 }]] : [[{ logo_path: original, logo_mime: 'image/png' }]] } }
  const thumb = await fleetService.getOwnerLogo(pool, 1, 'thumb')
  await fleetService.removeOwnerLogo(pool, 1)
  expect(fs.existsSync(original)).toBe(true)
  expect(fs.existsSync(thumb.path)).toBe(true)
  expect(calls.filter((sql) => sql.includes('INSERT INTO file_trash'))).toHaveLength(2)
  expect(calls.some((sql) => sql.includes('logo_updated_at = NOW()'))).toBe(true)
})
