import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Badge, Dropdown, Spin } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '../../api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import { toast } from '../ds/useToast'
import useViewport from '../../hooks/useViewport'

dayjs.extend(relativeTime)
dayjs.locale('vi')

const TYPE_ICON = {
  CERT_EXPIRY: '📜',
  CONTRACT_END: '📄',
  PASSPORT_EXPIRY: '🛂',
  SEAMAN_BOOK_EXPIRY: '📘',
  MEDICAL_EXPIRY: '🏥',
  ENROLLMENT_RESULT: '✅',
}

function getNavigatePath(item) {
  if (!item.type || !item.ref_id) return null
  switch (item.type) {
    case 'CERT_EXPIRY':
    case 'PASSPORT_EXPIRY':
    case 'SEAMAN_BOOK_EXPIRY':
    case 'MEDICAL_EXPIRY':
    case 'CONTRACT_END':
      return `/seafarers/${item.ref_id}`
    default:
      return `/seafarers/${item.ref_id}`
  }
}

export default function NotificationBell() {
  const { isCompact: isMobile } = useViewport()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const bellRef = useRef(null)
  const popupRef = useRef(null)
  const [popupTop, setPopupTop] = useState(64)
  const toggleMobile = () => {
    setPopupTop((bellRef.current?.getBoundingClientRect().bottom || 56) + 8)
    setOpen((value) => !value)
  }
  useEffect(() => {
    if (!open || !isMobile) return
    // Không đổi position/overflow của body: giữ nguyên thanh công cụ sticky và dock.
    let touchX = 0
    let touchY = 0
    const scrollBox = () => popupRef.current?.firstElementChild
    const canScroll = (target, deltaY, deltaX) => {
      const box = scrollBox()
      if (!box?.contains(target) || Math.abs(deltaX) > Math.abs(deltaY)) return false
      return deltaY > 0
        ? box.scrollTop + box.clientHeight < box.scrollHeight - 1
        : deltaY < 0 && box.scrollTop > 0
    }
    const onWheel = (event) => {
      if (!canScroll(event.target, event.deltaY, event.deltaX)) event.preventDefault()
    }
    const onTouchStart = (event) => {
      touchX = event.touches[0]?.clientX ?? 0
      touchY = event.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (event) => {
      const point = event.touches[0]
      if (!point) return
      if (!canScroll(event.target, touchY - point.clientY, touchX - point.clientX)) event.preventDefault()
      touchX = point.clientX
      touchY = point.clientY
    }
    const onOutside = (event) => {
      if (!popupRef.current?.contains(event.target) && !bellRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)
        && !popupRef.current?.contains(event.target)) event.preventDefault()
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 60 * 1000,
    enabled: false,
  })

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['notifications-list', open],
    queryFn: () => notificationApi.getNotifications({ limit: 10 }),
    enabled: open,
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
    },
    onError: () => toast.error('Không đánh dấu đã đọc được', { description: 'Thử lại sau ít phút.' }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
    },
    onError: () => toast.error('Không đánh dấu đã đọc hết được', { description: 'Thử lại sau ít phút.' }),
  })

  function handleItemClick(item) {
    const path = getNavigatePath(item)
    if (!item.is_read) markReadMutation.mutate(item.id)
    setOpen(false)
    if (path) navigate(path)
  }

  const dropdownContent = (
    <div
      style={{
        width: isMobile ? 'min(360px, calc(100vw - 32px))' : 360,
        maxWidth: '100%',
        maxHeight: isMobile ? `min(400px, calc(100dvh - ${popupTop + 96}px))` : 400,
        overflowY: 'auto',
        touchAction: 'pan-y',
        overflowX: 'hidden',
        overscrollBehaviorY: 'contain',
        overflowWrap: 'anywhere',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12)',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-strong)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 600 }}>Thông báo</span>
        {list.length > 0 && (
          <a onClick={() => markAllReadMutation.mutate()} style={{ fontSize: 12 }}>
            Đánh dấu tất cả đã đọc
          </a>
        )}
      </div>
      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>Không có thông báo</div>
      ) : (
        <div>
          {list.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleItemClick(item)}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-strong)',
                cursor: 'pointer',
                background: item.is_read ? 'var(--surface)' : 'var(--background)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>{TYPE_ICON[item.type] || '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: item.is_read ? 400 : 500 }}>{item.title}</div>
                  {item.body && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.body}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--border-strong)', marginTop: 4 }}>
                    {dayjs(item.created_at).fromNow()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const bell = (
    <button ref={bellRef} type="button" className="app-shell__icon-btn" aria-label="Thông báo" aria-expanded={open} onClick={isMobile ? toggleMobile : undefined}>
      <Badge count={count} size="small" offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 18 }} />
      </Badge>
    </button>
  )

  if (isMobile) return <>
    {bell}
    {open && createPortal(
      <section ref={popupRef} aria-label="Danh sách thông báo" style={{ position: 'fixed', top: popupTop, right: 16, zIndex: 1050, maxWidth: 'calc(100vw - 32px)' }}>
        {dropdownContent}
      </section>, document.body,
    )}
  </>

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      {bell}
    </Dropdown>
  )
}
