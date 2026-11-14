import { useEffect, useRef } from 'react'

const OVERLAY = '.ant-modal-content, .ant-drawer-content'
const POPUP = '.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden), [role="listbox"]'
const FIELD = 'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select'
const visible = (node) => Boolean(node?.getClientRects().length) && !node.closest('[aria-hidden="true"]')
const rootOf = (ref) => ref.current?.nativeElement || ref.current

// Chỉ gắn vào form thêm/sửa; không dùng cho xác nhận xoá, duyệt hoặc đổi trạng thái.
export default function useFormShortcuts({ enabled = true, autoFocus = false, focusKey, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!enabled || !autoFocus || !window.matchMedia('(min-width: 768px)').matches) return undefined
    const focusFirst = () => {
      const root = rootOf(ref)
      if (!visible(root)) return
      const scope = root.closest(OVERLAY) || root
      if ([...document.querySelectorAll(OVERLAY)].filter(visible).some((node) => node !== scope && !node.contains(scope))) return
      if (scope.contains(document.activeElement) && document.activeElement.matches(FIELD)) return
      const field = [...root.querySelectorAll(FIELD)].find((node) => visible(node) && !node.disabled && !node.readOnly)
      field?.focus({ preventScroll: true })
    }
    // Drawer/Modal lấy focus sau khi mở; chạy lại sau chuyển động nhưng không giành focus của ô khác.
    const first = setTimeout(focusFirst, 0)
    const opened = setTimeout(focusFirst, 300)
    // resetFields remount các ô sau Lưu & thêm khác: trả con trỏ về thông tin đầu tiên.
    const observer = new MutationObserver((records) => {
      if (document.activeElement !== document.body) return
      const removedField = records.some((record) => [...record.removedNodes].some((node) => node instanceof Element && (node.matches(FIELD) || node.querySelector(FIELD))))
      if (removedField) focusFirst()
    })
    const root = rootOf(ref)
    if (root) observer.observe(root, { childList: true, subtree: true })
    return () => { clearTimeout(first); clearTimeout(opened); observer.disconnect() }
  }, [enabled, autoFocus, focusKey])

  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (event) => {
      if (!window.matchMedia('(min-width: 768px)').matches || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      const root = rootOf(ref)
      if (!visible(root)) return
      const scope = root.closest(OVERLAY) || root
      // Không tác động form nền khi đang chọn dữ liệu hoặc mở hộp thoại khác.
      const overlays = [...document.querySelectorAll(OVERLAY)].filter(visible)
      if (overlays.some((node) => node !== scope && !node.contains(scope))) return
      if ([...document.querySelectorAll(POPUP)].some(visible)) return
      if (scope.querySelector('.ant-btn-loading')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel?.()
        return
      }
      const target = event.target
      if (!root.contains(target) || !target.matches('input') || target.closest('.ant-select, .ant-picker') || ['checkbox', 'radio', 'file', 'button', 'submit'].includes(target.type)) return
      const submit = scope.querySelector('[data-form-submit], button[type="submit"]')
      if (!submit) return
      event.preventDefault()
      event.stopPropagation()
      if (!submit.disabled && submit.getAttribute('aria-disabled') !== 'true') submit.click()
    }
    // Capture trước native implicit submit và Esc mặc định của Drawer/Modal.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [enabled, onCancel])

  return ref
}
