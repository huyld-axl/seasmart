import { create } from 'zustand'

// Hộp "Gửi ảnh cho AI đọc?" (docs/design/wireframes/desktop-gd4.html màn 7). client.js gọi ask() khi máy chủ báo
// AI_CONSENT_REQUIRED; promise trả true khi người dùng đồng ý (đã ghi lên máy chủ) để gửi lại yêu cầu quét vừa bấm.
const useAiConsentStore = create((set, get) => ({
  open: false,
  resolvers: [],
  ask: () => new Promise((resolve) => set({ open: true, resolvers: [...get().resolvers, resolve] })),
  finish: (agreed) => {
    get().resolvers.forEach((resolve) => resolve(agreed))
    set({ open: false, resolvers: [] })
  },
}))

export default useAiConsentStore
