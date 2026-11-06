import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { App } from 'antd'

const DEFAULT_CONTENT = 'Thông tin đang nhập chưa được lưu. Rời trang sẽ mất các thay đổi này.'

// Hỏi lại khi rời trang lúc còn thay đổi chưa lưu: chuyển trang trong app (Huỷ, link, menu, nút quay lại) thì hiện hộp
// "Rời trang này?"; tải lại / đóng tab thì trình duyệt tự hỏi (beforeunload). Đổi query trên cùng đường dẫn không tính.
// Lưu xong rồi chuyển trang thì gọi `allow()` trước `navigate` để không bị hỏi.
export default function useLeaveGuard(dirty, { content = DEFAULT_CONTENT } = {}) {
  const { modal } = App.useApp()
  const allowed = useRef(false)
  const asking = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      asking.current = false
      return
    }
    if (asking.current) return
    asking.current = true
    modal.confirm({
      title: 'Rời trang này?',
      content,
      okText: 'Rời trang',
      cancelText: 'Ở lại',
      okButtonProps: { danger: true },
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
  }, [blocker, modal, content])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return {
    allow: () => {
      allowed.current = true
    },
  }
}
