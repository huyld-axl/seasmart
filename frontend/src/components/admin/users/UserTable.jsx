import { Switch, Table } from 'antd'
import { useNavigate } from 'react-router-dom'
import RoleBadge from './RoleBadge'
import RowActions from '../../ds/RowActions'
import { actionColumn } from '../../ds/actionColumn'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

// Bảng tài khoản: email là chữ chính, vai trò là badge trung tính, công tắc cho phép đăng nhập, cột Thao tác Xem / Sửa / Xoá.
export default function UserTable({ data, loading, scroll = { x: 'max-content' }, onEdit, onDelete, onToggleActive }) {
  const navigate = useNavigate()

  const columns = [
    {
      title: 'Tài khoản',
      key: 'email',
      render: (_, user) => (
        <span className="ds-cell2" style={{ maxWidth: 320 }}>
          <span className="ds-cell2__main">{user.email}</span>
          <span className="ds-cell2__sub">Tạo ngày {formatDate(user.created_at)}</span>
        </span>
      ),
    },
    { title: 'Vai trò', dataIndex: 'role', key: 'role', render: (role) => <RoleBadge role={role} /> },
    {
      title: 'Đăng nhập',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (value, user) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <Switch checked={!!value} onChange={() => onToggleActive(user)} aria-label={`Cho phép ${user.email} đăng nhập`} />
          <span style={{ color: value ? 'var(--foreground)' : 'var(--muted)' }}>{value ? 'Cho phép' : 'Đã khoá'}</span>
        </span>
      ),
    },
    actionColumn((user) => <RowActions name={user.email} onView={() => navigate(`/admin/users/${user.id}`)} onEdit={() => onEdit(user)} onDelete={() => onDelete(user)} />, { buttons: 3 }),
  ]

  return <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={scroll} />
}
