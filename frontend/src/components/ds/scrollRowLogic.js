// Cờ của hàng cuộn ngang (ScrollRow): còn mục bên trái / phải không, có tràn không, và vị trí của vạch chỉ (tỉ lệ 0–1).
export function scrollFlags({ scrollLeft, scrollWidth, clientWidth }) {
  const overflow = scrollWidth > clientWidth + 1
  return {
    start: overflow && scrollLeft > 0,
    end: overflow && scrollLeft + clientWidth < scrollWidth - 1,
    overflow,
    ratio: overflow ? clientWidth / scrollWidth : 1,
    offset: overflow ? scrollLeft / scrollWidth : 0,
  }
}

// scrollLeft để đưa mục đang chọn vào giữa hàng, không vượt hai đầu.
export function centerLeft({ itemLeft, itemWidth, clientWidth, scrollWidth }) {
  const left = itemLeft - (clientWidth - itemWidth) / 2
  return Math.max(0, Math.min(left, scrollWidth - clientWidth))
}
