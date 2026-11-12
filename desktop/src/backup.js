// Sao lưu / khôi phục (giai đoạn 0, bước 0.8).
//
// Gói .ssbak = "SSBAK1\n" + u32 độ dài phần đầu + phần đầu (JSON) + nội dung mã hoá AES-256-GCM + thẻ GCM 16 byte.
//   Nội dung mã hoá bằng một khoá gói ngẫu nhiên. Phần đầu chứa khoá gói bọc hai cách, mỗi cách tự mở được cả gói:
//   bằng mật khẩu sao lưu, hoặc bằng mã khôi phục dữ liệu (24 ký tự). Phần đầu là AAD của GCM: sửa là hỏng gói.
//   Nội dung = các mục [u32 độ dài tên][tên][u64 cỡ][dữ liệu]: "db.json" rồi "files/<đường dẫn trong uploads>".
//
// Ảnh DB: gói Postgres nhúng không có pg_dump, nên đọc mọi bảng trong một giao dịch REPEATABLE READ (một ảnh nhất
// quán) ra JSON. Khôi phục: dựng cấu trúc bằng chính các migration của app rồi nạp dữ liệu, nên chỉ nạp được vào app
// có đúng bộ migration đó.
//
// Máy chính giữ hai khoá bọc đã dẫn xuất (backup-keys.json, quyền 0600; giai đoạn 4 chuyển vào két hệ điều hành) để
// sao lưu tự động không phải hỏi mật khẩu. Khôi phục trên máy mới thì cần mật khẩu hoặc mã khôi phục.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Client } = require('pg')

const MAGIC = Buffer.from('SSBAK1\n')
const KDF = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEYS_FILE = 'backup-keys.json'
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const b64 = (buf) => Buffer.from(buf).toString('base64')
const unb64 = (s) => Buffer.from(s, 'base64')
const kdf = (secret, salt) => crypto.scryptSync(secret.normalize('NFC'), salt, 32, KDF)
const normalizeRecovery = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

function newRecoveryCode() {
  const bytes = crypto.randomBytes(24)
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('')
  return chars.match(/.{4}/g).join('-')
}

// Khoá bọc đã dẫn xuất trên máy chính: bản mã hoá bằng két hệ điều hành (backup-keys.bin, giai đoạn 2 trở đi) hoặc
// bản JSON 0600 của giai đoạn 0. protect / unprotect: hàm mã hoá của safeStorage (chỉ truyền khi chạy trong Electron).
function writeKeys(userData, keys, protect) {
  if (protect) {
    fs.writeFileSync(path.join(userData, 'backup-keys.bin'), protect(JSON.stringify(keys)), { mode: 0o600 })
    fs.rmSync(path.join(userData, KEYS_FILE), { force: true })
  } else {
    fs.writeFileSync(path.join(userData, KEYS_FILE), JSON.stringify(keys), { mode: 0o600 })
  }
}

function readKeys(userData, unprotect) {
  const bin = path.join(userData, 'backup-keys.bin')
  if (fs.existsSync(bin)) {
    if (!unprotect) throw new Error('Khoá sao lưu nằm trong két hệ điều hành, chỉ đọc được trong app')
    return JSON.parse(unprotect(fs.readFileSync(bin)))
  }
  const json = path.join(userData, KEYS_FILE)
  if (!fs.existsSync(json)) throw new Error('Chưa đặt mật khẩu sao lưu')
  return JSON.parse(fs.readFileSync(json, 'utf8'))
}

// Đặt mật khẩu sao lưu, sinh mã khôi phục (chỉ hiện một lần). Lưu hai khoá bọc đã dẫn xuất trên máy chính.
// Trả thêm hai khoá bọc để người gọi bọc khoá dữ liệu (office.js).
function setupKeys(userData, password, protect = null) {
  if (!password || password.length < 10) throw new Error('Mật khẩu sao lưu cần ít nhất 10 ký tự')
  const recoveryCode = newRecoveryCode()
  const saltPassword = crypto.randomBytes(16)
  const saltRecovery = crypto.randomBytes(16)
  const keys = {
    password: { salt: b64(saltPassword), kek: b64(kdf(password, saltPassword)) },
    recovery: { salt: b64(saltRecovery), kek: b64(kdf(normalizeRecovery(recoveryCode), saltRecovery)) },
  }
  writeKeys(userData, keys, protect)
  return protect ? { recoveryCode, keys } : recoveryCode
}

function wrap(kek, key) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', kek, iv)
  const data = Buffer.concat([c.update(key), c.final()])
  return { iv: b64(iv), key: b64(data), tag: b64(c.getAuthTag()) }
}

function unwrap(kek, w) {
  const d = crypto.createDecipheriv('aes-256-gcm', kek, unb64(w.iv))
  d.setAuthTag(unb64(w.tag))
  return Buffer.concat([d.update(unb64(w.key)), d.final()])
}

// Mọi bảng của app (trừ schema_migration) đọc trong một ảnh nhất quán.
async function snapshotDb(dbEnv) {
  const client = new Client({ host: dbEnv.DB_HOST, port: +dbEnv.DB_PORT, user: dbEnv.DB_USER, password: dbEnv.DB_PASSWORD, database: dbEnv.DB_NAME })
  await client.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const { rows: tables } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migration' ORDER BY tablename"
    )
    const data = {}
    for (const { tablename } of tables) {
      const { rows } = await client.query(`SELECT coalesce(json_agg(t), '[]'::json) AS rows FROM "${tablename}" t`)
      data[tablename] = rows[0].rows
    }
    const { rows: migrations } = await client.query('SELECT name, checksum FROM schema_migration ORDER BY name')
    const { rows: sequences } = await client.query("SELECT sequencename AS name, last_value FROM pg_sequences WHERE schemaname = 'public'")
    await client.query('COMMIT')
    return { migrations, sequences, tables: data }
  } finally {
    await client.end()
  }
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return listFiles(full, base)
    return e.isFile() ? [path.relative(base, full).split(path.sep).join('/')] : []
  })
}

function entryHeader(name, size) {
  const nameBuf = Buffer.from(name)
  const head = Buffer.alloc(4 + nameBuf.length + 8)
  head.writeUInt32BE(nameBuf.length, 0)
  nameBuf.copy(head, 4)
  head.writeBigUInt64BE(BigInt(size), 4 + nameBuf.length)
  return head
}

// Tạo gói. Ghi ra tệp tạm, kiểm lại (giải mã đủ) rồi mới đổi tên: không bao giờ để lại gói dở dang mang tên thật.
async function createBackup({ userData, dbEnv, uploadDir, appVersion, outFile, unprotect = null }) {
  const keys = readKeys(userData, unprotect)
  const packageKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(12)
  const header = Buffer.from(JSON.stringify({
    format: 1,
    app_version: appVersion,
    created_at: new Date().toISOString(),
    upload_dir: uploadDir,
    kdf: { N: KDF.N, r: KDF.r, p: KDF.p },
    iv: b64(iv),
    wraps: {
      password: { salt: keys.password.salt, ...wrap(unb64(keys.password.kek), packageKey) },
      recovery: { salt: keys.recovery.salt, ...wrap(unb64(keys.recovery.kek), packageKey) },
    },
  }))

  const db = Buffer.from(JSON.stringify(await snapshotDb(dbEnv)))
  const files = listFiles(uploadDir)
  const tmp = `${outFile}.dang-ghi`
  const fd = fs.openSync(tmp, 'w', 0o600)
  try {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(header.length)
    fs.writeSync(fd, Buffer.concat([MAGIC, len, header]))
    const cipher = crypto.createCipheriv('aes-256-gcm', packageKey, iv)
    cipher.setAAD(header)
    const put = (buf) => fs.writeSync(fd, cipher.update(buf))
    put(entryHeader('db.json', db.length))
    put(db)
    for (const rel of files) {
      const data = fs.readFileSync(path.join(uploadDir, rel))
      put(entryHeader(`files/${rel}`, data.length))
      put(data)
    }
    fs.writeSync(fd, cipher.final())
    fs.writeSync(fd, cipher.getAuthTag())
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  // Kiểm toàn vẹn bằng chính khoá gói trước khi công nhận bản sao lưu.
  readBackup(tmp, { packageKey })
  fs.renameSync(tmp, outFile)
  return { files: files.length, bytes: fs.statSync(outFile).size }
}

// Mở gói bằng mật khẩu sao lưu hoặc mã khôi phục (hoặc khoá gói khi tự kiểm). Sai thì báo lỗi, không ghi gì.
function readBackup(file, { password, recoveryCode, packageKey }) {
  const buf = fs.readFileSync(file)
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Không phải tệp sao lưu MCAH')
  const headerLen = buf.readUInt32BE(MAGIC.length)
  const headerBuf = buf.subarray(MAGIC.length + 4, MAGIC.length + 4 + headerLen)
  const header = JSON.parse(headerBuf)
  let key = packageKey
  if (!key) {
    const [secret, w] = password ? [password, header.wraps.password] : [normalizeRecovery(recoveryCode || ''), header.wraps.recovery]
    try {
      key = unwrap(crypto.scryptSync(secret.normalize('NFC'), unb64(w.salt), 32, { ...header.kdf, maxmem: KDF.maxmem }), w)
    } catch {
      throw new Error(password ? 'Sai mật khẩu sao lưu' : 'Sai mã khôi phục dữ liệu')
    }
  }
  const body = buf.subarray(MAGIC.length + 4 + headerLen, buf.length - 16)
  const d = crypto.createDecipheriv('aes-256-gcm', key, unb64(header.iv))
  d.setAAD(headerBuf)
  d.setAuthTag(buf.subarray(buf.length - 16))
  let plain
  try {
    plain = Buffer.concat([d.update(body), d.final()])
  } catch {
    throw new Error('Tệp sao lưu bị hỏng hoặc bị sửa')
  }
  const entries = new Map()
  for (let at = 0; at < plain.length; ) {
    const nameLen = plain.readUInt32BE(at)
    const name = plain.subarray(at + 4, at + 4 + nameLen).toString()
    const size = Number(plain.readBigUInt64BE(at + 4 + nameLen))
    const start = at + 12 + nameLen
    entries.set(name, plain.subarray(start, start + size))
    at = start + size
  }
  return { header, entries }
}

// Nạp gói vào DB vừa chạy migration (trống) và kho tệp của máy này.
async function restoreBackup({ file, password, recoveryCode, dbEnv, uploadDir }) {
  const { header, entries } = readBackup(file, { password, recoveryCode })
  const db = JSON.parse(entries.get('db.json'))
  const client = new Client({ host: dbEnv.DB_HOST, port: +dbEnv.DB_PORT, user: dbEnv.DB_USER, password: dbEnv.DB_PASSWORD, database: dbEnv.DB_NAME })
  await client.connect()
  try {
    const { rows: here } = await client.query('SELECT name, checksum FROM schema_migration ORDER BY name')
    if (JSON.stringify(here) !== JSON.stringify(db.migrations)) {
      throw new Error(`Bản sao lưu từ app ${header.app_version} có cấu trúc dữ liệu khác bản đang cài; cài đúng phiên bản rồi khôi phục`)
    }
    await client.query('BEGIN')
    await client.query('SET LOCAL session_replication_role = replica')
    const tables = Object.keys(db.tables)
    if (tables.length) await client.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
    for (const table of tables) {
      if (!db.tables[table].length) continue
      // Bỏ cột sinh tự động (GENERATED ... STORED): Postgres tự tính lại.
      const { rows: cols } = await client.query(
        "SELECT attname FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped AND attgenerated = '' ORDER BY attnum",
        [`"${table}"`]
      )
      const list = cols.map((c) => `"${c.attname}"`).join(', ')
      await client.query(
        `INSERT INTO "${table}" (${list}) OVERRIDING SYSTEM VALUE SELECT ${list} FROM json_populate_recordset(NULL::"${table}", $1::json)`,
        [JSON.stringify(db.tables[table])]
      )
    }
    for (const { name, last_value: last } of db.sequences) {
      if (last !== null) await client.query('SELECT setval($1, $2)', [`"${name}"`, last])
    }
    // Giai đoạn 0: DB còn lưu đường dẫn tuyệt đối của kho tệp → đổi tiền tố sang kho tệp của máy này.
    // (Giai đoạn 4 chuyển sang mã tệp tương đối, bỏ bước này.)
    if (header.upload_dir !== uploadDir) {
      const { rows: textCols } = await client.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying') AND table_name <> 'schema_migration'"
      )
      for (const { table_name: t, column_name: c } of textCols) {
        await client.query(`UPDATE "${t}" SET "${c}" = $2 || substr("${c}", length($1) + 1) WHERE starts_with("${c}", $1)`, [header.upload_dir, uploadDir])
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    await client.end()
  }
  let files = 0
  for (const [name, data] of entries) {
    if (!name.startsWith('files/')) continue
    const target = path.join(uploadDir, ...name.slice(6).split('/'))
    if (!target.startsWith(uploadDir + path.sep)) throw new Error('Tệp sao lưu chứa đường dẫn lạ')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, data)
    files += 1
  }
  return { appVersion: header.app_version, createdAt: header.created_at, files }
}

module.exports = { setupKeys, createBackup, restoreBackup, readBackup, wrap, unwrap, readKeys }
