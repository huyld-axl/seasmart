// Postgres cho máy dev của máy chủ dịch vụ: dùng bản Postgres nhúng có sẵn trong desktop/node_modules,
// dữ liệu ở cloud/.data/pg, cổng 5544, chỉ nghe 127.0.0.1. Máy chủ thật dùng Postgres riêng (CLOUD_DB_*).
//   node scripts/dev-db.js        chạy (giữ terminal), Ctrl+C để tắt
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync, spawn } = require('child_process')

const DATA = path.join(__dirname, '../.data')
const PGDATA = path.join(DATA, 'pg')
const PORT = '5544'
const pkg = process.platform === 'win32' ? 'windows-x64' : `${process.platform}-${process.arch}`
const BIN = path.join(__dirname, '../../desktop/node_modules/@embedded-postgres', pkg, 'native/bin')
const bin = (name) => path.join(BIN, name + (process.platform === 'win32' ? '.exe' : ''))

fs.mkdirSync(DATA, { recursive: true, mode: 0o700 })
const secretFile = path.join(DATA, 'db-secret')
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(18).toString('base64url'), { mode: 0o600 })

if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) {
  const pw = path.join(DATA, '.pw')
  fs.copyFileSync(secretFile, pw)
  execFileSync(bin('initdb'), ['-D', PGDATA, '-U', 'mcah_cloud', '--pwfile', pw, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C.UTF-8'], { stdio: 'inherit' })
  fs.rmSync(pw)
  execFileSync(bin('postgres'), ['--single', '-D', PGDATA, 'postgres'], { input: 'CREATE DATABASE mcah_cloud;\n' })
}
const pg = spawn(bin('postgres'), ['-D', PGDATA, '-p', PORT, '-c', 'listen_addresses=127.0.0.1'], { stdio: 'inherit' })
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => pg.kill('SIGINT'))
pg.on('exit', (code) => process.exit(code ?? 0))
