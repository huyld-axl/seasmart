import useMediaQuery from './useMediaQuery'

// Ba mốc màn của MCAH (docs/mcah-ke-hoach-responsive-mobile.md, mục 4.1). CSS chỉ dùng đúng ba mốc này
// (max-width: 639 / 767 / 1023px, min-width: 640 / 768 / 1024px); test __tests__/breakpoints.test.js chặn mốc lạ.
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024 }

// isPhone: dưới 640px (điện thoại dọc). isCompact: dưới 768px (sidebar thành ngăn kéo, bảng danh sách thành dòng).
// isWide: từ 1024px. Trang dùng hook này, không gọi Grid.useBreakpoint() của antd (mốc khác, lần render đầu trả rỗng).
export default function useViewport() {
  const isPhone = useMediaQuery(`(max-width: ${BREAKPOINTS.sm - 1}px)`)
  const isCompact = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`)
  const isWide = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`)
  return { isPhone, isCompact, isWide }
}
