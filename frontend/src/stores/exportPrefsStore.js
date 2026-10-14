import { create } from 'zustand'

// Tuỳ chọn xem và tải giấy tờ xuất, nhớ theo trình duyệt.
// gridlines: hiện đường lưới ô như trong Excel, áp dụng cho cả bản xem trước lẫn file tải về.
const useExportPrefsStore = create((set) => ({
  gridlines: localStorage.getItem('export.gridlines') === '1',
  setGridlines: (on) => {
    localStorage.setItem('export.gridlines', on ? '1' : '0')
    set({ gridlines: on })
  },
}))

export default useExportPrefsStore
