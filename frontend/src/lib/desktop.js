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
}

// Cài đặt trên máy này: { mailMode, mailApp, smtp, smtpPasswordSaved, secretStore }. Bản web: null.
export function useDeviceSettings() {
  return useQuery({ queryKey: ['device-settings'], queryFn: desktop.getSettings, enabled: isDesktop(), staleTime: Infinity })
}

export function useSaveDeviceSettings() {
  const client = useQueryClient()
  return useMutation({ mutationFn: desktop.saveSettings, onSuccess: (data) => client.setQueryData(['device-settings'], data) })
}
