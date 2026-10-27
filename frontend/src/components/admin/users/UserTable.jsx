import { Button, Table } from 'antd'
import { useNavigate } from 'react-router-dom'
import RoleBadge from './RoleBadge'
import StatusBadge from '../../ds/StatusBadge'
import RowActions from '../../ds/RowActions'
import { actionColumn } from '../../ds/actionColumn'
import useAccountRights from '../../../hooks/useAccountRights'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

// Bảng tài khoản: họ tên là chữ chính (email dưới), vai trò là badge trung tính, tình trạng, cột Thao tác Xem / Sửa / Xoá.
// Tài khoản Chờ kích hoạt có nút Gửi lại lời mời; khoá / mở khoá nằm trong form sửa.
export default function UserTable({
  data,
  loading,
  scroll = { x: 'max-content' },
  onEdit,
  onDelete,
  onResendInvite,
}) {
  const navigate = useNavigate()
  const rights = useAccountRights()

  const columns = [
    {
      title: 'Tài khoản',
      key: 'email',
      render: (_, user) => (
        <span className="ds-cell2" style={{ maxWidth: 320 }}>
          <span className="ds-cell2__main">{user.full_name || user.email}</span>
          <span className="ds-cell2__sub">{user.full_name ? user.email : `Tạo ngày ${formatDate(user.created_at)}`}</span>
        </span>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <RoleBadge role={role} />,
    },
    {
      title: 'Tình trạng',
      dataIndex: 'status',
      key: 'status',
      render: (value, user) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <StatusBadge group="account" value={value} />
          {value === 'PENDING' && rights.canEdit(user) ? (
            <Button type="link" size="small" onClick={() => onResendInvite(user)}>
              Gửi lại lời mời
            </Button>
          ) : null}
        </span>
      ),
    },
    {
      title: 'Đăng nhập gần nhất',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      render: (value) => formatDate(value),
    },
    actionColumn(
      (user) => (
        <RowActions
          name={user.email}
          onView={() => navigate(`/admin/users/${user.id}`)}
          onEdit={rights.canEdit(user) ? () => onEdit(user) : undefined}
          onDelete={rights.canRemove(user) ? () => onDelete(user) : undefined}
        />
      ),
      { buttons: 3 }
    ),
  ]

  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={data}
      columns={columns}
      pagination={false}
      scroll={scroll}
    />
  )
}
