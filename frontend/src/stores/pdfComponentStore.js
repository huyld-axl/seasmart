import { create } from 'zustand'

// Hộp "Cần cài thành phần xuất PDF" (app máy tính, docs/mcah-ke-hoach-desktop-gd1.md 3.4). client.js gọi ask() khi
// máy chủ báo thiếu LibreOffice; promise trả true khi đã cài xong để gửi lại yêu cầu xuất vừa bấm.
const usePdfComponentStore = create((set, get) => ({
  open: false,
  resolvers: [],
  ask: () => new Promise((resolve) => set({ open: true, resolvers: [...get().resolvers, resolve] })),
  finish: (installed) => {
    get().resolvers.forEach((resolve) => resolve(installed))
    set({ open: false, resolvers: [] })
  },
}))

export default usePdfComponentStore
