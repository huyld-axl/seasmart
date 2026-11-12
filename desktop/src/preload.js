// Cầu nối giữa giao diện và app (GĐ1 mục 3.1). Giao diện thấy window.mcah là biết đang chạy trong app máy tính.
// Chỉ lộ các hàm dưới đây; mọi dữ liệu vào được ipc.js kiểm lại ở tiến trình chính.
const { contextBridge, ipcRenderer } = require('electron')

const call = (channel) => (arg) => ipcRenderer.invoke(`mcah:${channel}`, arg)

contextBridge.exposeInMainWorld('mcah', {
  platform: process.platform,
  openMail: call('open-mail'),
  mailStatus: call('mail-status'),
  openMailFolder: call('open-mail-folder'),
  openExternal: call('open-external'),
  pdfComponent: call('pdf-component'),
  installPdfComponent: call('install-pdf-component'),
  onPdfInstallProgress: (fn) => {
    const listener = (_event, p) => fn(p)
    ipcRenderer.on('mcah:pdf-install-progress', listener)
    return () => ipcRenderer.removeListener('mcah:pdf-install-progress', listener)
  },
  session: call('session'),
  onSessionChanged: (fn) => {
    const listener = (_event, info) => fn(info)
    ipcRenderer.on('mcah:session-changed', listener)
    return () => ipcRenderer.removeListener('mcah:session-changed', listener)
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
  onLockChanged: (fn) => {
    const listener = (_event, locked) => fn(locked)
    ipcRenderer.on('mcah:lock-changed', listener)
    return () => ipcRenderer.removeListener('mcah:lock-changed', listener)
  },
  prepareOffice: call('prepare-office'),
  createOffice: call('create-office'),
  getSettings: call('get-settings'),
  saveSettings: call('save-settings'),
  checkUpdate: call('check-update'),
  // Màn lỗi khởi động
  startup: { retry: call('startup-retry'), openLogs: call('open-logs'), quit: call('quit') },
})
