import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Dropdown, Spin } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '../../api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'

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
    case 'ENROLLMENT_RESULT':
      return `/courses/${item.ref_id}`
    default:
      return `/seafarers/${item.ref_id}`
  }
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

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
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
    },
  })

  function handleItemClick(item) {
    const path = getNavigatePath(item)
    if (!item.is_read) markReadMutation.mutate(item.id)
    setOpen(false)
    if (path) navigate(path)
  }

  const dropdownContent = (
    <div style={{ width: 360, maxHeight: 400, overflow: 'auto' }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
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
        <div style={{ padding: 24, color: '#8c8c8c', textAlign: 'center' }}>Không có thông báo</div>
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
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                background: item.is_read ? '#fff' : '#fafafa',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>{TYPE_ICON[item.type] || '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: item.is_read ? 400 : 500 }}>{item.title}</div>
                  {item.body && (
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{item.body}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
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

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <span
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginRight: 16 }}
      >
        <Badge count={count} size="small" offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 18 }} />
        </Badge>
      </span>
    </Dropdown>
  )
}
