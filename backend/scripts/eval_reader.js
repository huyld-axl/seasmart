// Vòng đo thử: chạy bộ mẫu qua đúng code của ứng dụng (cắt trang → tách → đọc theo loại) rồi so với bản đọc chuẩn.
// Không nằm trong đường chạy của ứng dụng. Mỗi lần chạy GỌI AI THẬT: tốn tiền và gửi ảnh mẫu tới nhà cung cấp đang cấu hình.
//
// Chạy (từ thư mục backend):
//   DB_NAME=marineport_g15 node scripts/eval_reader.js --truth ../docs/samples/ban_doc_chuan.json --out /tmp/eval.json
// Tuỳ chọn:
//   --samples <thư mục>   mặc định: thư mục chứa --truth
//   --only <chuỗi>        chỉ chạy các tệp có đường dẫn chứa chuỗi này (cách nhau bằng dấu phẩy)
//   --out <tệp>           ghi kết quả thô (có nội dung giấy: giữ ngoài repo)
//   --rescore <tệp>       không gọi AI: chấm lại kết quả thô đã lưu bằng --out
// Model và nhà cung cấp lấy từ .env như ứng dụng. Cần JWT_SECRET trong môi trường (như khi chạy máy chủ).
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

const TRUTH = opt('truth')
if (!TRUTH) {
  console.log('Thiếu --truth <tệp bản đọc chuẩn .json>')
  process.exit(1)
}
const SAMPLES = opt('samples', path.dirname(path.resolve(TRUTH)))
const OUT = opt('out')
const RESCORE = opt('rescore')
const ONLY = (opt('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean)

const pool = require('../src/config/db')
const documentPages = require('../src/services/document_pages.service')
const splitter = require('../src/services/document_splitter.service')
const reader = require('../src/services/document_reader.service')
const { createLimiter } = require('../src/services/ai/limiter')
const { normalizeRank, stripAccents } = require('../src/utils/normalize')

const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }
const key = (text) => stripAccents(text).replace(/[^A-Z0-9]+/g, '')

// exact: giống sau khi bỏ dấu, hoa thường, dấu câu. near: một bên chứa bên kia (thiếu hoặc thừa chữ).
function compare(field, expected, actual, ranks) {
  const got = actual ?? ''
  if (expected === '') return got === '' ? 'exact' : 'invented'
  if (got === '') return 'missing'
  if (key(expected) === key(got)) return 'exact'
  if (field === 'rank') {
    const a = normalizeRank(expected, ranks)
    const b = normalizeRank(got, ranks)
    if (a && b && a.id === b.id) return 'exact'
  }
  const e = key(expected)
  const g = key(got)
  if (g.includes(e) || e.includes(g)) return 'near'
  return 'wrong'
}

async function main() {
  const truth = JSON.parse(fs.readFileSync(TRUTH, 'utf8'))
  const [types] = await pool.query('SELECT code, name_vi FROM certificate_type ORDER BY id')
  const [ranks] = await pool.query('SELECT id, code, name_vi, name_en FROM `rank`')
  const names = Object.keys(truth.files).filter((name) => !ONLY.length || ONLY.some((s) => name.includes(s)))
  const limiter = createLimiter(Number(process.env.AI_CONCURRENCY) || 3)
  const results = RESCORE ? JSON.parse(fs.readFileSync(RESCORE, 'utf8')) : {}
  const started = Date.now()

  if (!RESCORE) await Promise.all(names.map((name) => limiter.run(async () => {
    const entry = { papers: [] }
    const t0 = Date.now()
    try {
      const buffer = fs.readFileSync(path.join(SAMPLES, name))
      const pages = await documentPages.cut(buffer, MIME[path.extname(name).toLowerCase()])
      const { papers } = await splitter.split({ pages: pages.map((p) => ({ page_no: p.pageNo, thumbBuffer: p.thumb })) })
      for (const paper of papers) {
        const item = { type: paper.type, pageFrom: paper.pageFrom, pageTo: paper.pageTo }
        if (paper.type !== 'other') {
          const images = pages.filter((p) => p.pageNo >= paper.pageFrom && p.pageNo <= paper.pageTo).map((p) => ({ buffer: p.image, mimeType: 'image/jpeg' }))
          const read = await reader.read(images, types, {}, paper.type)
          item.fields = Object.fromEntries(read.fields.map((f) => [f.key, { value: f.value, state: f.state }]))
        }
        entry.papers.push(item)
      }
    } catch (err) {
      entry.error = err?.message || String(err)
    }
    entry.ms = Date.now() - t0
    results[name] = entry
  })))

  // So với bản đọc chuẩn.
  const tally = { files: 0, splitOk: 0, fields: 0, exact: 0, near: 0, wrong: 0, missing: 0, invented: 0, critical: 0, criticalExact: 0 }
  const byKey = {}
  console.log('\n== Từng tệp ==')
  for (const name of names) {
    const want = truth.files[name].papers
    const got = results[name]
    tally.files += 1
    if (got.error) {
      console.log(`LỖI   ${name}: ${got.error}`)
      continue
    }
    const wantTypes = want.map((p) => p.type).join(',')
    const gotTypes = got.papers.map((p) => p.type).join(',')
    const splitOk = wantTypes === gotTypes
    if (splitOk) tally.splitOk += 1
    const issues = []
    if (!splitOk) issues.push(`loại: mong ${wantTypes}, ra ${gotTypes}`)
    let exact = 0
    let total = 0
    if (splitOk) {
      want.forEach((paper, i) => {
        const read = got.papers[i].fields || {}
        for (const [field, expected] of Object.entries(paper.fields)) {
          if (expected === null) continue
          const actual = read[field]?.value
          const verdict = compare(field, expected, actual, ranks)
          const isCritical = paper.critical.includes(field)
          total += 1
          tally.fields += 1
          tally[verdict] += 1
          byKey[field] = byKey[field] || { exact: 0, total: 0 }
          byKey[field].total += 1
          if (verdict === 'exact') {
            exact += 1
            byKey[field].exact += 1
          } else {
            issues.push(`${field}: mong "${expected}", ra "${actual ?? ''}" (${verdict})`)
          }
          if (isCritical) {
            tally.critical += 1
            if (verdict === 'exact') tally.criticalExact += 1
          }
        }
      })
    }
    console.log(`${splitOk ? 'OK  ' : 'SAI '}  ${name}: ${splitOk ? `${exact}/${total} ô đúng` : 'tách sai'} (${Math.round(got.ms / 1000)}s)`)
    for (const line of issues) console.log(`        - ${line}`)
  }

  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-')
  console.log('\n== Tổng hợp ==')
  console.log(`Tách đúng loại: ${tally.splitOk}/${tally.files} tệp (${pct(tally.splitOk, tally.files)})`)
  console.log(`Ô đúng hoàn toàn: ${tally.exact}/${tally.fields} (${pct(tally.exact, tally.fields)}); gần đúng ${tally.near}, sai ${tally.wrong}, bỏ sót ${tally.missing}, bịa vào ô trống ${tally.invented}`)
  console.log(`Ô trọng yếu đúng: ${tally.criticalExact}/${tally.critical} (${pct(tally.criticalExact, tally.critical)})`)
  console.log('Theo ô:', Object.entries(byKey).map(([k, v]) => `${k} ${v.exact}/${v.total}`).join(', '))
  console.log(`Thời gian: ${Math.round((Date.now() - started) / 1000)}s`)

  const [usage] = RESCORE ? [[]] : await pool.query(
    'SELECT task, model, COUNT(*) AS calls, SUM(input_tokens) AS tin, SUM(output_tokens) AS tout, SUM(status = \'ERROR\') AS errors FROM ai_call WHERE created_at >= ? GROUP BY task, model',
    [new Date(started - 1000)]
  ).catch(() => [[]])
  if (usage.length) {
    console.log('\n== Gọi AI (token) ==')
    for (const row of usage) console.log(`${row.task} ${row.model}: ${row.calls} lần, vào ${row.tin}, ra ${row.tout}, lỗi ${row.errors}`)
  }
  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1))
    console.log(`\nKết quả thô: ${OUT} (có nội dung giấy tờ, không đưa vào repo)`)
  }
  await pool.end()
}

main().catch((err) => {
  console.log('LỖI:', err?.message || err)
  process.exit(1)
})
