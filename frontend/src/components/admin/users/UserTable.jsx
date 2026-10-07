import { Button, Dropdown, Switch, Table } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, MoreOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import RoleBadge from './RoleBadge'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

// Bảng tài khoản: email là chữ chính, vai trò là badge trung tính, công tắc cho phép đăng nhập, menu ⋯.
export default function UserTable({ data, loading, onEdit, onDelete, onToggleActive }) {
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
    {
      title: <span className="ds-sr-only">Thao tác</span>,
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, user) => (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' },
              { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá tài khoản', danger: true },
            ],
            onClick: ({ key }) => {
              if (key === 'view') navigate(`/admin/users/${user.id}`)
              if (key === 'edit') onEdit(user)
              if (key === 'delete') onDelete(user)
            },
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với ${user.email}`} />
        </Dropdown>
      ),
    },
  ]

  return <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} scroll={{ x: 'max-content' }} />
}
