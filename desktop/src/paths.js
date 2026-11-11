// Đường dẫn tới các phần chạy kèm app. Bản đóng gói: nằm trong resources/ cạnh app.asar.
// Chạy dev (npm start): lấy thẳng từ repo.
const path = require('path')
const { app } = require('electron')

const ROOT = path.join(__dirname, '../..')
const EXE = process.platform === 'win32' ? '.exe' : ''
const res = (...p) => path.join(process.resourcesPath, ...p)

function pgPlatformDir() {
  const pkg = process.platform === 'win32' ? 'windows-x64' : `${process.platform}-${process.arch}`
  return path.join(__dirname, '../node_modules/@embedded-postgres', pkg, 'native')
}

const packaged = app.isPackaged

module.exports = {
  frontendDist: path.join(__dirname, '../dist/frontend'),
  backendDir: packaged ? res('backend') : path.join(ROOT, 'backend'),
  formsDir: packaged ? res('forms') : path.join(ROOT, 'forms'),
  postgresBin: path.join(packaged ? res('postgres') : pgPlatformDir(), 'bin'),
  // Node chạy backend: bản đóng gói kèm file Node riêng; dev dùng `node` trên PATH (hoặc MCAH_NODE).
  nodeBin: packaged ? res('node', `node${EXE}`) : process.env.MCAH_NODE || 'node',
  // Khoá công khai của máy chủ dịch vụ gói sẵn khi build (scripts/stage.js); dev lấy từ cloud/.data nếu có.
  cloudPublicKeyFile: packaged ? res('cloud-public-key.pem') : path.join(__dirname, '../dist/stage/cloud-public-key.pem'),
  // Khoá công khai kiểm chữ ký bản phát hành và địa chỉ phát hành, gói kèm lúc build (scripts/stage.js).
  releasePublicKeyFile: packaged ? res('release-public-key.pem') : path.join(__dirname, '../dist/stage/release-public-key.pem'),
  updateUrlFile: packaged ? res('update-url.txt') : path.join(__dirname, '../dist/stage/update-url.txt'),
  EXE,
}
