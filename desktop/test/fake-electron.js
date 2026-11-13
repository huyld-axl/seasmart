// Bản giả module electron cho test chạy bằng `node --test` (không mở Electron).
const Module = require('module')
const fake = {
  app: { getPath: () => require('os').tmpdir(), getVersion: () => '0.0.0', quit() {} },
  ipcMain: { handle() {} },
  shell: { openPath: async () => '', openExternal: async () => {} },
  safeStorage: { isEncryptionAvailable: () => false, getSelectedStorageBackend: () => 'basic_text' },
}
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return 'fake-electron'
  return resolve.call(this, request, ...rest)
}
require.cache['fake-electron'] = { id: 'fake-electron', filename: 'fake-electron', loaded: true, exports: fake }
