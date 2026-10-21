import ToastContent from './ToastContent'

// Toast duy nhất của MCAH (thiết kế đã duyệt 21/10/2026, minh hoạ ở /design-system mục Toast).
// Bốn loại: xong việc, thông tin, cảnh báo, lỗi. Góc dưới phải, dưới giữa ở màn hẹp, luôn nằm trên thanh lưu
// (App.jsx đặt bottom và tối đa 3 toast). Thứ tự [icon] [chữ, mô tả] [hành động] [✕].
// Chữ: xong việc "Đã + việc + tên", lỗi "Không + việc + được + tên"; câu một dòng không chấm cuối,
// lý do và cách sửa để ở `description`.

// Giây tự tắt; 0 = không tự tắt (lỗi chờ người dùng đóng).
const DURATION = { success: 4, info: 6, warning: 8, error: 0 }
const CLOSABLE = { success: false, info: false, warning: true, error: true }

// Cầu nối để gọi toast ở ngoài component (api/client.js). ToastHost gắn notification và vị trí vào đây.
const host = { notification: null, placement: 'bottomRight', offlineAt: 0 }

function show(kind, title, { description, actionLabel, onAction, duration } = {}) {
  const { notification, placement } = host
  if (!notification) return
  // Vừa báo mất kết nối thì bỏ các toast lỗi kéo theo của trang: cùng một nguyên nhân, chỉ một toast.
  if (kind === 'error' && Date.now() - host.offlineAt < 2000) return
  // Cùng một câu thì thay toast cũ, không chồng thêm.
  const key = `${kind}:${title}:${description || ''}`
  const close = () => notification.destroy(key)
  const seconds = duration ?? (kind === 'success' && onAction ? 8 : DURATION[kind])
  notification.open({
    key,
    placement,
    duration: seconds,
    role: kind === 'error' ? 'alert' : 'status',
    className: `ds-toast ds-toast--${kind}`,
    closable: false,
    icon: null,
    title: (
      <ToastContent
        kind={kind}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={
          onAction
            ? () => {
                close()
                onAction()
              }
            : undefined
        }
        onClose={CLOSABLE[kind] ? close : undefined}
      />
    ),
  })
}

export const toast = {
  success: (title, options) => show('success', title, options),
  info: (title, options) => show('info', title, options),
  warning: (title, options) => show('warning', title, options),
  error: (title, options) => show('error', title, options),
  // Mất kết nối tới máy chủ (api/client.js gọi khi request không có phản hồi).
  offline: () => {
    host.offlineAt = 0
    show('error', 'Mất kết nối tới máy chủ', { description: 'Kiểm tra mạng rồi thử lại.' })
    host.offlineAt = Date.now()
  },
}

// ToastHost (App.jsx) gắn notification của antd và vị trí theo bề rộng màn vào cầu nối.
export function bindToastHost(notification, placement) {
  host.notification = notification
  host.placement = placement
}

export default function useToast() {
  return toast
}
