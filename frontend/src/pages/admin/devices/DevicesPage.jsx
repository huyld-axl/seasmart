import { useEffect, useState } from 'react'
import { App, Button } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import api from '../../../api/client'
import RowList from '../../../components/ds/RowList'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { useCan } from '../../../hooks/usePermission'
import { desktop } from '../../../lib/desktop'

// Máy trong văn phòng (wireframe docs/design/wireframes/desktop-gd3.html màn 2): máy nhân viên đã ghép với máy chính.
// Gỡ: mã thiết bị mất ngay, lệnh kế tiếp của máy đó bị từ chối. Máy đã bị Gỡ xin vào lại: Duyệt / Từ chối.
const errorText = (err) => err?.response?.data?.error || err?.response?.data?.message || 'Thử lại sau ít phút.'

export default function DevicesPage() {
  const can = useCan()
  const toast = useToast()
  const { modal } = App.useApp()
  const queryClient = useQueryClient()
  const [main, setMain] = useState(null)
  const { data = [], isLoading } = useQuery({ queryKey: ['lan-devices'], queryFn: () => api.get('/lan/devices').then((r) => r.data), refetchInterval: 30000 })

  useEffect(() => {
    desktop.lanStatus().then(setMain).catch(() => {})
  }, [])

  const act = useMutation({
    mutationFn: ({ id, action }) => api.post(`/lan/devices/${id}/${action}`),
    onSuccess: (_r, { action, name }) => {
      queryClient.invalidateQueries({ queryKey: ['lan-devices'] })
      toast.success({ remove: `Đã gỡ máy ${name}`, approve: `Đã duyệt máy ${name}`, reject: `Đã từ chối máy ${name}` }[action])
    },
    onError: (err) => toast.error('Không đổi được trạng thái máy', { description: errorText(err) }),
  })

  const remove = (row) =>
    modal.confirm({
      title: `Gỡ máy ${row.name}?`,
      content: `Máy ${row.name} sẽ không vào được nữa, phiên đang mở trên máy đó bị cắt ngay. Dữ liệu đã xuất ra máy đó không xoá được.`,
      okText: 'Gỡ',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      onOk: () => act.mutateAsync({ id: row.id, action: 'remove', name: row.name }),
    })

  const manage = can('account.update')
  const columns = [
    { title: 'Máy', dataIndex: 'name', mobile: 'title' },
    { title: 'Người dùng gần nhất', render: (_v, r) => r.last_user || r.requested_by || '—' },
    { title: 'Hệ điều hành · bản', render: (_v, r) => [r.os, r.app_version].filter(Boolean).join(' · ') || '—' },
    { title: 'Lần cuối nối', render: (_v, r) => (r.last_seen_at ? dayjs(r.last_seen_at).format('HH:mm DD/MM/YYYY') : '—') },
    { title: 'Trạng thái', render: (_v, r) => <StatusBadge group="device" value={r.status} /> },
    {
      title: '',
      align: 'right',
      render: (_v, r) => {
        if (!manage) return null
        if (r.status === 'pending') {
          return (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <Button type="primary" size="small" onClick={() => act.mutate({ id: r.id, action: 'approve', name: r.name })}>Duyệt</Button>
              <Button type="link" size="small" onClick={() => act.mutate({ id: r.id, action: 'reject', name: r.name })}>Từ chối</Button>
            </span>
          )
        }
        return r.status === 'active' ? <Button type="link" size="small" danger onClick={() => remove(r)}>Gỡ</Button> : null
      },
    },
  ]

  return (
    <div className="ds-page">
      <div className="ds-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 16, padding: 16 }}>
        <b>{main ? `Máy chính: ${main.name} · ${main.addresses.join(', ')}` : 'Máy chính'}</b>
        {main ? <span className="muted">Đang mở{main.keepAwake ? ' · không cho máy ngủ' : ''}</span> : null}
      </div>
      <RowList
        columns={columns}
        dataSource={data}
        loading={isLoading}
        locale={{ emptyText: <EmptyState title="Chưa có máy nhân viên nào" description="Nhân viên cài MCAH trên máy mình và đăng nhập, máy sẽ tự nối máy chính và hiện ở đây." /> }}
        pagination={false}
      />
    </div>
  )
}
