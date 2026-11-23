import { cloneElement, isValidElement } from 'react'

// Tooltip một kiểu cho cả app: chú thích gốc của trình duyệt (thuộc tính title), như ô chữ bị cắt ở bảng Báo cáo.
// Cùng cách gọi với Tooltip của antd (title, children); các tham số khác của antd (placement, mouseEnterDelay…) bỏ qua.

function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) {
    const inner = textOf(node.props.children)
    return node.type === 'div' || node.type === 'p' || node.type === 'li' ? `${inner}\n` : inner
  }
  return ''
}

export default function Tooltip({ title, children }) {
  const text = textOf(title).replace(/\n+$/, '').trim()
  if (!text) return children ?? null
  if (isValidElement(children) && children.props.title == null) return cloneElement(children, { title: text })
  return <span title={text}>{children}</span>
}
