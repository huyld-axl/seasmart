// Gom code backend của MCAH thành một khối rồi dịch sang bytecode V8 (docs/mcah-ke-hoach-desktop-gd5.md 3.1).
//   node scripts/build-backend.js <thư mục backend đã chép> <tệp Node đi kèm bộ cài | -> [--no-bytecode]
// Chỉ gom code trong backend/ (src, server.js, scripts/migrate.js); thư viện trong node_modules để ngoài khối (không phải
// code của mình, nhiều module nạp động / có phần biên dịch sẵn). Bytecode phải dịch bằng đúng bản Node chạy nó.
// Xong thì xoá mã nguồn: thư mục chỉ còn server.js / scripts/migrate.js (tệp nạp vài dòng), *.jsc, migrations, templates.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const esbuild = require('esbuild')

const [dir, nodeBin, flag] = process.argv.slice(2)
if (!dir) throw new Error('Dùng: node scripts/build-backend.js <thư mục backend> <node> [--no-bytecode]')
const bytecode = flag !== '--no-bytecode'

const ENTRIES = [
  { src: 'server.js', out: 'server' },
  { src: 'scripts/migrate.js', out: 'scripts/migrate' },
]

for (const { src, out } of ENTRIES) {
  esbuild.buildSync({
    entryPoints: [path.join(dir, src)],
    outfile: path.join(dir, `${out}.bundle.js`),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    packages: 'external',
    minify: true,
    keepNames: true,
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'error',
  })
}

if (bytecode) {
  // bytenode dịch bằng chính bản Node đi kèm; module bytenode cũng phải có trong node_modules của bộ cài.
  const bytenodeDir = path.dirname(require.resolve('bytenode/package.json'))
  fs.cpSync(bytenodeDir, path.join(dir, 'node_modules/bytenode'), { recursive: true })
  for (const { out } of ENTRIES) {
    const bundle = path.join(dir, `${out}.bundle.js`)
    execFileSync(nodeBin, ['-e', `require(${JSON.stringify(path.join(dir, 'node_modules/bytenode'))}).compileFile({ filename: ${JSON.stringify(bundle)}, output: ${JSON.stringify(path.join(dir, `${out}.jsc`))} })`], { stdio: 'inherit' })
    fs.rmSync(bundle)
  }
}

// Tệp nạp thay cho mã nguồn (giữ tên cũ để app và script không phải đổi đường dẫn).
for (const { out } of ENTRIES) {
  const file = path.join(dir, `${out}.js`)
  const rel = bytecode ? `./${path.basename(out)}.jsc` : `./${path.basename(out)}.bundle.js`
  fs.writeFileSync(file, `'use strict'\n${bytecode ? "require('bytenode')\n" : ''}require(${JSON.stringify(rel)})\n`)
}

// Bỏ mã nguồn; giữ mẫu thư (src/templates) vì đọc lúc chạy.
const templates = path.join(dir, 'src/templates')
const keep = path.join(dir, '.templates-tmp')
if (fs.existsSync(templates)) fs.renameSync(templates, keep)
fs.rmSync(path.join(dir, 'src'), { recursive: true, force: true })
if (fs.existsSync(keep)) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.renameSync(keep, templates)
}
for (const name of fs.readdirSync(path.join(dir, 'scripts'))) {
  if (!/^migrate\.(js|jsc|bundle\.js)$/.test(name)) fs.rmSync(path.join(dir, 'scripts', name), { force: true })
}
console.log(`Backend đã gom${bytecode ? ' và dịch bytecode' : ''}: ${dir}`)
