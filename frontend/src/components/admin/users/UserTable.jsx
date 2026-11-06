import { Button, Dropdown } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, MoreOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import RoleBadge from './RoleBadge'
import StatusBadge from '../../ds/StatusBadge'
import RowActions from '../../ds/RowActions'
import RowList from '../../ds/RowList'
import { actionColumn } from '../../ds/actionColumn'
import useAccountRights from '../../../hooks/useAccountRights'
import useViewport from '../../../hooks/useViewport'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

// Bảng tài khoản: họ tên là chữ chính (email dưới), vai trò là badge trung tính, tình trạng, cột Thao tác Xem / Sửa / Xoá.
// Tài khoản Chờ kích hoạt có nút Gửi lại lời mời; khoá / mở khoá nằm trong form sửa.
// Điện thoại (RowList): mỗi tài khoản một dòng, bấm dòng mở chi tiết, Xem / Sửa / Xoá gom vào menu ⋯.
export default function UserTable({
  data,
  loading,
  scroll = { x: 'max-content' },
  onEdit,
  onDelete,
  onResendInvite,
  resendingId,
}) {
  const navigate = useNavigate()
  const rights = useAccountRights()
  const { isPhone } = useViewport()

  const open = (user) => navigate(`/admin/users/${user.id}`)
  const moreMenu = (user) => ({
    items: [
      { key: 'view', icon: <EyeOutlined />, label: 'Xem' },
      ...(rights.canEdit(user) ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
      ...(rights.canRemove(user) ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true }] : []),
    ],
    onClick: ({ key }) => (key === 'view' ? open(user) : key === 'edit' ? onEdit(user) : onDelete(user)),
  })

  const columns = [
    {
      title: 'Tài khoản',
      key: 'email',
      mobile: 'title',
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
      mobile: 'meta',
      render: (role) => <RoleBadge role={role} />,
    },
    {
      title: 'Tình trạng',
      dataIndex: 'status',
      key: 'status',
      mobile: 'meta',
      render: (value, user) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <StatusBadge group="account" value={value} />
          {value === 'PENDING' && rights.canEdit(user) ? (
            <Button type="link" size="small" loading={resendingId === user.id} disabled={!!resendingId} onClick={(event) => { event.stopPropagation(); onResendInvite(user) }}>
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
          onView={() => open(user)}
          onEdit={rights.canEdit(user) ? () => onEdit(user) : undefined}
          onDelete={rights.canRemove(user) ? () => onDelete(user) : undefined}
        />
      ),
      { buttons: 3 }
    ),
    {
      key: 'more',
      hidden: true,
      mobile: 'actions',
      render: (_, user) => (
        <Dropdown menu={moreMenu(user)} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với ${user.email}`} />
        </Dropdown>
      ),
    },
  ]

  return (
    <RowList
      rowKey="id"
      loading={loading}
      dataSource={data}
      columns={columns}
      pagination={false}
      scroll={scroll}
      onRow={isPhone ? (user) => ({ onClick: () => open(user) }) : undefined}
    />
  )
}
