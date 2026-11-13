// Vỏ app (tiến trình chính Electron) thành bytecode (docs/mcah-ke-hoach-desktop-gd5.md 3.3).
//   node scripts/build-main.js [--no-bytecode]
// Ra app-build/ (cùng cấp src/ nên mọi đường dẫn tương đối ../dist/frontend, ../build/icon.png giữ nguyên):
//   main.js (tệp nạp) + main.jsc, preload.js đã nén (preload chạy trong sandbox, không nạp được bytecode),
//   backend-guard.js (chạy bằng Node riêng của backend, để nguyên), pages/.
// Bytecode dịch bằng chính Electron của bộ cài (ELECTRON_RUN_AS_NODE chỉ dùng lúc build; cầu chì tắt nó ở bản phát hành).
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const esbuild = require('esbuild')

const DESKTOP = path.join(__dirname, '..')
const SRC = path.join(DESKTOP, 'src')
const OUT = path.join(DESKTOP, 'app-build')
const bytecode = !process.argv.includes('--no-bytecode')

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

// Thư viện trong node_modules để ngoài khối (electron, pg, bonjour… không phải code của mình).
esbuild.buildSync({
  entryPoints: [path.join(SRC, 'main.js')],
  outfile: path.join(OUT, 'main.bundle.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
  external: ['electron'],
  minify: true,
  keepNames: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'error',
})
esbuild.buildSync({ entryPoints: [path.join(SRC, 'preload.js')], outfile: path.join(OUT, 'preload.js'), bundle: false, platform: 'node', format: 'cjs', minify: true, legalComments: 'none', logLevel: 'error' })
fs.copyFileSync(path.join(SRC, 'backend-guard.js'), path.join(OUT, 'backend-guard.js'))
fs.cpSync(path.join(SRC, 'pages'), path.join(OUT, 'pages'), { recursive: true })

if (bytecode) {
  const electron = require('electron') // đường dẫn tệp chạy Electron (gói npm electron trả về chuỗi)
  const script = `require('bytenode').compileFile({ filename: ${JSON.stringify(path.join(OUT, 'main.bundle.js'))}, output: ${JSON.stringify(path.join(OUT, 'main.jsc'))}, electron: false })`
  execFileSync(electron, ['-e', script], { cwd: DESKTOP, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
  fs.rmSync(path.join(OUT, 'main.bundle.js'))
  fs.writeFileSync(path.join(OUT, 'main.js'), "'use strict'\nrequire('bytenode')\nrequire('./main.jsc')\n")
} else {
  fs.writeFileSync(path.join(OUT, 'main.js'), "'use strict'\nrequire('./main.bundle.js')\n")
}
console.log(`Vỏ app đã gom${bytecode ? ' và dịch bytecode' : ''}: app-build/`)
