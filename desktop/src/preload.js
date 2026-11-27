// Cầu nối giữa giao diện và app (GĐ1 mục 3.1). Giao diện thấy window.catoro là biết đang chạy trong app máy tính.
// Chỉ lộ các hàm dưới đây; mọi dữ liệu vào được ipc.js kiểm lại ở tiến trình chính.
const { contextBridge, ipcRenderer } = require('electron')

const call = (channel) => (arg) => ipcRenderer.invoke(`catoro:${channel}`, arg)

contextBridge.exposeInMainWorld('catoro', {
  platform: process.platform,
  openMail: call('open-mail'),
  mailStatus: call('mail-status'),
  openMailFolder: call('open-mail-folder'),
  openExternal: call('open-external'),
  session: call('session'),
  onSessionChanged: (fn) => {
    const listener = (_event, info) => fn(info)
    ipcRenderer.on('catoro:session-changed', listener)
    return () => ipcRenderer.removeListener('catoro:session-changed', listener)
  },
  login: call('login'),
  loginWithCode: call('login-code'),
  cancelLogin: call('cancel-login'),
  reopenBrowser: call('reopen-browser'),
  logout: call('logout'),
  refreshSession: call('refresh-session'),
  lockState: call('lock-state'),
  setPin: call('set-pin'),
  unlock: call('unlock'),
  changePin: call('change-pin'),
  onLockChanged: (fn) => {
    const listener = (_event, locked) => fn(locked)
    ipcRenderer.on('catoro:lock-changed', listener)
    return () => ipcRenderer.removeListener('catoro:lock-changed', listener)
  },
  setupMainMachine: call('setup-main-machine'),
  recheckOffice: call('recheck-office'),
  getSettings: call('get-settings'),
  saveSettings: call('save-settings'),
  checkUpdate: call('check-update'),
  lanStatus: call('lan-status'),
  whatsNew: call('whats-new'),
  whatsNewSeen: call('whats-new-seen'),
  lanFind: call('lan-find'),
  lanPair: call('lan-pair'),
  lanPairStatus: call('lan-pair-status'),
  lanInfo: call('lan-info'),
  lanRetry: call('lan-retry'),
  openFolder: call('open-folder'),
  exportFolder: call('export-folder'),
  onExportProgress: (fn) => {
    const listener = (_event, p) => fn(p)
    ipcRenderer.on('catoro:export-progress', listener)
    return () => ipcRenderer.removeListener('catoro:export-progress', listener)
  },
  onLanOnline: (fn) => {
    const listener = (_event, online) => fn(online)
    ipcRenderer.on('catoro:lan-online', listener)
    return () => ipcRenderer.removeListener('catoro:lan-online', listener)
  },
  // Màn lỗi khởi động
  startup: { retry: call('startup-retry'), openLogs: call('open-logs'), quit: call('quit'), sendReport: call('report-send'), revealReport: call('report-reveal') },
})
