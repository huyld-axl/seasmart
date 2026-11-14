import { afterEach, expect, it } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require('sharp')
const { fleetService } = require('../fleet.service')
const folders = []
const readAll = async (stream) => { const chunks = []; for await (const c of stream) chunks.push(c); return Buffer.concat(chunks) }
afterEach(() => { for (const dir of folders.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
it('tạo thumbnail logo cũ, giữ nền trong suốt và không thay ảnh gốc', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-logo-test-')); folders.push(dir)
  const original = path.join(dir, 'logo.png')
  await sharp({ create: { width: 600, height: 300, channels: 4, background: { r: 0, g: 80, b: 200, alpha: 0.5 } } }).png().toFile(original)
  const pool = { query: async () => [[{ logo_path: original, logo_mime: 'image/png' }]] }
  const before = fs.readFileSync(original)
  // Hai lần gọi cùng lúc dùng chung một ảnh nhỏ (tệp phát sinh trong kho nội bộ), không tạo hai lần.
  const [first, concurrent] = await Promise.all([fleetService.getOwnerLogo(pool, 1, 'thumb'), fleetService.getOwnerLogo(pool, 1, 'thumb')])
  expect(first.mime).toBe('image/webp')
  expect(first.stream.path).toBe(concurrent.stream.path)
  const meta = await sharp(await readAll(first.stream)).metadata()
  expect([meta.width, meta.height, meta.hasAlpha]).toEqual([96, 48, true])
  const mtime = fs.statSync(first.stream.path).mtimeMs
  const again = await fleetService.getOwnerLogo(pool, 1, 'thumb')
  expect(again.stream.path).toBe(first.stream.path)
  await readAll(again.stream)
  await readAll(concurrent.stream)
  expect(fs.statSync(first.stream.path).mtimeMs).toBe(mtime)
  expect(fs.readFileSync(original)).toEqual(before)
  const full = await fleetService.getOwnerLogo(pool, 1)
  expect([full.stream.path, full.mime]).toEqual([original, 'image/png'])
  await readAll(full.stream)
})
it('gỡ logo: logo vào thùng rác (chưa xoá khỏi ổ đĩa), cập nhật phiên bản ảnh', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-logo-test-')); folders.push(dir)
  const original = path.join(dir, 'logo.png')
  await sharp({ create: { width: 20, height: 20, channels: 4, background: 'transparent' } }).png().toFile(original)
  const calls = []
  const pool = { query: async (sql) => { calls.push(sql); return sql.includes('FROM ship_owner o') ? [[{ id: 1 }]] : [[{ logo_path: original, logo_mime: 'image/png' }]] } }
  await fleetService.removeOwnerLogo(pool, 1)
  expect(fs.existsSync(original)).toBe(true)
  expect(calls.filter((sql) => sql.includes('INSERT INTO file_trash'))).toHaveLength(1)
  expect(calls.some((sql) => sql.includes('logo_updated_at = NOW()'))).toBe(true)
})
