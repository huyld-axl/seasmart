// Bản chụp dữ liệu của máy chính (docs/mcah-ke-hoach-desktop-gd4.md 3.3). Không mã hoá (Q14), không có nút / lịch cho
// người dùng (Q15): chỉ dùng trước khi cập nhật có đổi dữ liệu và cho hỗ trợ MCAH chuyển máy (--backup / --restore).
// Tệp .zip thường (zip64, ghi theo luồng):
//   manifest.json   văn phòng, bản app, lúc chụp, danh sách tệp + sha256
//   db.json         mọi bảng, đọc trong một ảnh nhất quán (REPEATABLE READ)
//   Hồ sơ/…         thư mục hồ sơ dễ đọc (mã tệp "hs:"), mở zip ra là xem được
//   noi-bo/…        kho nội bộ UPLOAD_DIR (ảnh trang, bản tải lên, thùng rác…)
// Nhất quán: khoá tư vấn LOCK_KEY giữ suốt lúc chụp; job xoá tệp 180 ngày và job sắp thư mục hồ sơ của backend thấy khoá
// thì bỏ lượt. Danh sách tệp hồ sơ lấy từ chính ảnh DB vừa chụp.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const yazl = require('yazl')
const yauzl = require('yauzl')
const { Client } = require('pg')

const LOCK_KEY = 741930277
const TREE = 'Hồ sơ/'
const INNER = 'noi-bo/'
const connect = async (dbEnv) => {
  const client = new Client({ host: dbEnv.DB_HOST, port: +dbEnv.DB_PORT, user: dbEnv.DB_USER, password: dbEnv.DB_PASSWORD, database: dbEnv.DB_NAME })
  await client.connect()
  return client
}

// Mọi bảng của app (trừ schema_migration) đọc trong một ảnh nhất quán.
async function snapshotDb(client) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
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
    return { migrations, sequences, tables: data }
  } finally {
    await client.query('COMMIT')
  }
}

// Mã tệp "hs:" có trong ảnh DB (cột chữ bất kỳ).
function treeRefs(db) {
  const refs = new Set()
  for (const rows of Object.values(db.tables)) {
    for (const row of rows) for (const value of Object.values(row)) if (typeof value === 'string' && value.startsWith('hs:')) refs.add(value)
  }
  return [...refs]
}

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return listFiles(full, base)
    return e.isFile() && !e.name.endsWith('.part') ? [path.relative(base, full).split(path.sep).join('/')] : []
  })
}

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

// Đọc hết mọi mục của zip (yauzl kiểm CRC từng mục) → Map tên → Buffer cho manifest / db, kiểm sha256 tệp hồ sơ.
function readZip(file, { want = ['manifest.json', 'db.json'], onEntry = null } = {}) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (err, zip) => {
      if (err) return reject(new Error('Tệp bản chụp bị hỏng hoặc không phải tệp .zip của MCAH'))
      const out = new Map()
      zip.on('error', () => reject(new Error('Tệp bản chụp bị hỏng')))
      zip.on('end', () => resolve(out))
      zip.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) return zip.readEntry()
        zip.openReadStream(entry, (e, stream) => {
          if (e) return reject(new Error('Tệp bản chụp bị hỏng'))
          const chunks = []
          stream.on('data', (c) => chunks.push(c))
          stream.on('error', () => reject(new Error('Tệp bản chụp bị hỏng (sai CRC)')))
          stream.on('end', async () => {
            const buf = Buffer.concat(chunks)
            if (want.includes(entry.fileName)) out.set(entry.fileName, buf)
            try {
              if (onEntry) await onEntry(entry.fileName, buf)
            } catch (error) {
              return reject(error)
            }
            zip.readEntry()
          })
        })
      })
      zip.readEntry()
    })
  })
}

// Tạo bản chụp. Ghi ra .part, đọc lại kiểm toàn vẹn rồi mới đổi tên: không bao giờ để lại bản dở mang tên thật.
async function createBackup({ dbEnv, uploadDir, filesDir = null, appVersion, outFile }) {
  const client = await connect(dbEnv)
  const tmp = `${outFile}.part`
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])
    const db = await snapshotDb(client)
    const office = db.tables.office_info?.[0] || null
    const zip = new yazl.ZipFile()
    const files = []
    const missing = []
    if (filesDir) {
      for (const ref of treeRefs(db)) {
        const rel = ref.slice(3)
        const src = path.join(filesDir, ...rel.split('/'))
        if (!fs.existsSync(src)) {
          missing.push(rel)
          continue
        }
        files.push({ name: TREE + rel, sha256: sha256File(src) })
        zip.addFile(src, TREE + rel)
      }
      const readme = path.join(filesDir, 'Đọc tôi.txt')
      if (fs.existsSync(readme)) zip.addFile(readme, `${TREE}Đọc tôi.txt`)
    }
    for (const rel of listFiles(uploadDir)) {
      const src = path.join(uploadDir, ...rel.split('/'))
      files.push({ name: INNER + rel, sha256: sha256File(src) })
      zip.addFile(src, INNER + rel)
    }
    const manifest = { format: 2, app_version: appVersion, created_at: new Date().toISOString(), office: office && { id: office.office_id, name: office.name }, upload_dir: uploadDir, files, missing }
    zip.addBuffer(Buffer.from(JSON.stringify(db)), 'db.json')
    zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 1)), 'manifest.json')
    zip.end({ forceZip64Format: false })
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmp, { mode: 0o600 })
      zip.outputStream.pipe(out).on('close', resolve).on('error', reject)
      zip.outputStream.on('error', reject)
    })
    // Kiểm: đọc lại mọi mục (CRC) và so sha256 với manifest.
    const want = new Map(files.map((f) => [f.name, f.sha256]))
    await readZip(tmp, {
      onEntry: (name, buf) => {
        if (want.has(name) && crypto.createHash('sha256').update(buf).digest('hex') !== want.get(name)) throw new Error(`Bản chụp sai ở ${name}`)
      },
    })
    fs.renameSync(tmp, outFile)
    return { files: files.length, missing: missing.length, bytes: fs.statSync(outFile).size }
  } catch (error) {
    fs.rmSync(tmp, { force: true })
    throw /ENOSPC/.test(String(error.code || error.message)) ? new Error('Ổ đĩa đầy, không chụp được dữ liệu') : error
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    await client.end()
  }
}

// Đọc manifest (không nạp gì) để kiểm trước khi khôi phục.
async function readManifest(file) {
  const entries = await readZip(file, { want: ['manifest.json'] })
  if (!entries.has('manifest.json')) throw new Error('Không phải bản chụp dữ liệu của MCAH')
  return JSON.parse(entries.get('manifest.json'))
}

// Nạp bản chụp vào DB vừa chạy migration (trống), kho nội bộ và thư mục hồ sơ của máy này.
async function restoreBackup({ file, dbEnv, uploadDir, filesDir }) {
  const manifest = await readManifest(file)
  const sums = new Map(manifest.files.map((f) => [f.name, f.sha256]))
  const written = []
  const entries = await readZip(file, {
    onEntry: (name, buf) => {
      let target = null
      if (name.startsWith(TREE) && filesDir) target = path.join(filesDir, ...name.slice(TREE.length).split('/'))
      else if (name.startsWith(INNER)) target = path.join(uploadDir, ...name.slice(INNER.length).split('/'))
      if (!target) return
      const root = name.startsWith(TREE) ? filesDir : uploadDir
      if (!path.resolve(target).startsWith(path.resolve(root) + path.sep)) throw new Error('Bản chụp chứa đường dẫn lạ')
      if (sums.has(name) && crypto.createHash('sha256').update(buf).digest('hex') !== sums.get(name)) throw new Error(`Bản chụp sai ở ${name}`)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, buf)
      written.push(target)
    },
  })
  const db = JSON.parse(entries.get('db.json'))
  const client = await connect(dbEnv)
  try {
    const { rows: here } = await client.query('SELECT name, checksum FROM schema_migration ORDER BY name')
    if (JSON.stringify(here) !== JSON.stringify(db.migrations)) {
      throw new Error(`Bản chụp từ app ${manifest.app_version} có cấu trúc dữ liệu khác bản đang cài; cài đúng phiên bản rồi khôi phục`)
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
    // Dữ liệu trước giai đoạn 4 còn đường dẫn tuyệt đối của kho nội bộ: đổi tiền tố sang kho của máy này.
    if (manifest.upload_dir && manifest.upload_dir !== uploadDir) {
      const { rows: textCols } = await client.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('text', 'character varying') AND table_name <> 'schema_migration'"
      )
      for (const { table_name: t, column_name: c } of textCols) {
        await client.query(`UPDATE "${t}" SET "${c}" = $2 || substr("${c}", length($1) + 1) WHERE starts_with("${c}", $1)`, [manifest.upload_dir, uploadDir])
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    // Lỗi giữa chừng: bỏ tệp vừa chép để máy về trống, thử lại được.
    for (const f of written) fs.rmSync(f, { force: true })
    throw error
  } finally {
    await client.end()
  }
  return { appVersion: manifest.app_version, createdAt: manifest.created_at, files: written.length, office: manifest.office }
}

module.exports = { createBackup, restoreBackup, readManifest, LOCK_KEY }
