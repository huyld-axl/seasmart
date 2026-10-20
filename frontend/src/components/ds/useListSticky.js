import { useEffect, useState } from 'react'

const BOTTOM = 24 // lề dưới của vùng nội dung (padding 24 trong AdminLayout.css)
const TOP_MIN = 76 // topbar 64 + khe 12, khớp `top` dính của khung trong ds.css
const GAP = 12 // khe giữa toolbar, bảng, dòng chân
const MIN_BODY = 160

// Khung danh sách đứng yên: toolbar, đầu bảng, dòng chân cố định, chỉ thân bảng cuộn.
// Trả `scroll` cho antd Table; thân bảng cao vừa đủ để cả khung (tính từ vị trí thật, dưới tiêu đề trang) nằm gọn trong màn hình,
// nên trang không phải cuộn và dòng chân luôn thấy được.
// Trang dùng hook phải gắn class `ds-card ds-card--fixed` cho khung danh sách.
export default function useListSticky() {
  // Giá trị đầu ước lượng để antd dựng ngay kiểu có scroll.y, tránh nháy lệch cột khi đổi từ không có sang có.
  const [y, setY] = useState(() => Math.max(MIN_BODY, window.innerHeight - 300))
  useEffect(() => {
    const card = document.querySelector('.ds-card--fixed')
    if (!card || typeof ResizeObserver === 'undefined') return undefined
    const height = (selector) => Math.ceil(card.querySelector(selector)?.getBoundingClientRect().height || 0)
    const update = () => {
      const foot = height(':scope > .ds-table-foot')
      const top = Math.max(TOP_MIN, Math.round(card.getBoundingClientRect().top + window.scrollY))
      const used = top + BOTTOM + height(':scope > .ds-toolbar') + GAP + (foot ? foot + GAP : 0) + height('.ant-table-header') + 2
      const next = Math.max(MIN_BODY, window.innerHeight - used)
      setY((current) => (current === next ? current : next))
    }
    update()
    const observer = new ResizeObserver(update)
    const watch = () => { for (const child of card.children) observer.observe(child) }
    watch()
    const mutations = new MutationObserver(() => { watch(); update() })
    mutations.observe(card, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])
  return { x: 'max-content', y }
}
