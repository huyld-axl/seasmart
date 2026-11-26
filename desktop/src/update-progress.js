// Cửa sổ tiến độ cập nhật (pages/updating.html): bấm "Cập nhật ngay" xong là hiện ngay, để người dùng biết app đang
// tải / đang cài thay vì tưởng không có gì xảy ra. Kèm thanh tiến độ trên biểu tượng app ở thanh tác vụ.
const path = require('path')
const { BrowserWindow } = require('electron')

function open(parent) {
  const owner = parent && !parent.isDestroyed() ? parent : null
  const win = new BrowserWindow({
    parent: owner || undefined,
    modal: Boolean(owner),
    width: 440,
    height: 184,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'Cập nhật Catoro',
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  let state = null
  let loaded = false
  let shownKey = ''
  // Chỉ vẽ lại khi trang đã tải và chữ / phần trăm đổi (tải về báo hàng trăm lần mỗi giây).
  const apply = () => {
    if (!state || !loaded || win.isDestroyed()) return
    const key = `${state.title}|${state.hint}|${state.total ? Math.floor((state.done / state.total) * 100) : '-'}`
    if (key === shownKey) return
    shownKey = key
    win.webContents.executeJavaScript(`window.show(${JSON.stringify(state)})`).catch(() => {})
  }
  win.webContents.on('did-finish-load', async () => {
    loaded = true
    apply()
    // Ubuntu tính cả khung cửa sổ vào kích thước (kể cả useContentSize): đo nội dung rồi nới cho vừa.
    const height = await win.webContents.executeJavaScript('document.body.scrollHeight').catch(() => 0)
    const [width, now] = win.getContentSize()
    if (height > now && !win.isDestroyed()) win.setContentSize(Math.max(width, 440), height + 24)
  })
  win.loadFile(path.join(__dirname, 'pages', 'updating.html'))

  return {
    // { title, hint?, done?, total? }: có done/total thì hiện phần trăm.
    set(next) {
      state = { ...state, ...next }
      if (!next.total) delete state.total
      apply()
      if (owner && !owner.isDestroyed()) owner.setProgressBar(state.total ? state.done / state.total : 2)
    },
    close() {
      if (owner && !owner.isDestroyed()) owner.setProgressBar(-1)
      if (!win.isDestroyed()) win.destroy()
    },
  }
}

module.exports = { open }
