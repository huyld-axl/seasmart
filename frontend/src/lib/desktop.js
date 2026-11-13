// App máy tính (docs/mcah-ke-hoach-desktop-gd1.md 3.1): preload của app đặt window.mcah. Không có thì là bản web.
// Mọi chỗ cần việc của máy (mở thư, cài thành phần, cài đặt máy) gọi qua đây, không dùng window.mcah trực tiếp.
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'

const bridge = () => (typeof window !== 'undefined' ? window.mcah : undefined)

export const isDesktop = () => Boolean(bridge())

export const desktop = {
  openMail: (mail) => bridge().openMail(mail),
  openMailFolder: () => bridge().openMailFolder(),
  openExternal: (kind) => bridge().openExternal(kind),
  pdfComponent: () => bridge().pdfComponent(),
  installPdfComponent: () => bridge().installPdfComponent(),
  onPdfInstallProgress: (fn) => bridge().onPdfInstallProgress(fn),
  getSettings: () => bridge().getSettings(),
  saveSettings: (settings) => bridge().saveSettings(settings),
  checkUpdate: () => bridge().checkUpdate(),
  // Phiên (docs/mcah-ke-hoach-desktop-gd2.md 4.1): giao diện không giữ token; app gắn token khi chuyển tiếp /api.
  session: () => bridge().session(),
  onSessionChanged: (fn) => bridge().onSessionChanged(fn),
  login: (opts) => bridge().login(opts),
  loginWithCode: (code) => bridge().loginWithCode(code),
  cancelLogin: () => bridge().cancelLogin(),
  reopenBrowser: () => bridge().reopenBrowser(),
  logout: () => bridge().logout(),
  refreshSession: () => bridge().refreshSession(),
  lockState: () => bridge().lockState(),
  setPin: (value) => bridge().setPin(value),
  unlock: (value) => bridge().unlock(value),
  onLockChanged: (fn) => bridge().onLockChanged(fn),
  createOffice: (name) => bridge().createOffice(name),
  // Giai đoạn 3: máy chính / máy nhân viên (docs/mcah-ke-hoach-desktop-gd3.md).
  lanStatus: () => bridge().lanStatus(),
  lanFind: () => bridge().lanFind(),
  lanPair: (host) => bridge().lanPair(host),
  lanPairStatus: () => bridge().lanPairStatus(),
  lanInfo: () => bridge().lanInfo(),
  lanRetry: () => bridge().lanRetry(),
  onLanOnline: (fn) => bridge().onLanOnline(fn),
  // Giai đoạn 4: thư mục hồ sơ.
  openFolder: (seafarerId) => bridge().openFolder(seafarerId),
  exportFolder: (opts) => bridge().exportFolder(opts),
  onExportProgress: (fn) => bridge().onExportProgress(fn),
}

// Lỗi từ app (ipcRenderer.invoke) kèm tiền tố kỹ thuật; bỏ đi cho người dùng đọc.
export const bridgeError = (error) => String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

// Giá trị đánh dấu "đã đăng nhập" trong authStore của app máy tính (token thật ở tiến trình chính).
export const DESKTOP_TOKEN = 'desktop'

// Cài đặt trên máy này: { mailMode, mailApp, smtp, smtpPasswordSaved, secretStore }. Bản web: null.
export function useDeviceSettings() {
  return useQuery({ queryKey: ['device-settings'], queryFn: desktop.getSettings, enabled: isDesktop(), staleTime: Infinity })
}

export function useSaveDeviceSettings() {
  const client = useQueryClient()
  return useMutation({ mutationFn: desktop.saveSettings, onSuccess: (data) => client.setQueryData(['device-settings'], data) })
}
