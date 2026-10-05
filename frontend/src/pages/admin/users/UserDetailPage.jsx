import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Descriptions, Space, Spin, Typography, Tag, Modal } from 'antd'
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useUser, useUpdateUser, useToggleActive, useDeleteUser } from '../../../hooks/useUsers'
import RoleBadge from '../../../components/admin/users/RoleBadge'
import UserForm from '../../../components/admin/users/UserForm'

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: user, isLoading } = useUser(id)
  const updateUser = useUpdateUser()
  const toggleActive = useToggleActive()
  const deleteUser = useDeleteUser()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isProtectedUser = user && String(user.id) === '1'

  function handleDeleteClick() {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa user "${user?.email}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteUser.mutate(id, { onSuccess: () => navigate('/admin/users') }),
    })
  }

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!user) return <Typography.Text type="danger">Không tìm thấy user</Typography.Text>

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/users')}>
          Quay lại
        </Button>
        <Button icon={<EditOutlined />} type="primary" onClick={() => setDrawerOpen(true)}>
          Sửa
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleDeleteClick}
          loading={deleteUser.isPending}
          disabled={isProtectedUser}
        >
          Xóa user
        </Button>
      </Space>

      <Typography.Title level={4}>Chi tiết User</Typography.Title>

      <Descriptions bordered column={1}>
        <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
        <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
        <Descriptions.Item label="Role">
          <RoleBadge role={user.role} />
        </Descriptions.Item>
        <Descriptions.Item label="Kích hoạt">
          <Tag color={user.is_active ? 'green' : 'red'}>
            {user.is_active ? 'Đang hoạt động' : 'Đã khóa'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {new Date(user.created_at).toLocaleString('vi-VN')}
        </Descriptions.Item>
        <Descriptions.Item label="Cập nhật lần cuối">
          {new Date(user.updated_at).toLocaleString('vi-VN')}
        </Descriptions.Item>
      </Descriptions>

      <Button
        style={{ marginTop: 16 }}
        onClick={() => toggleActive.mutate(id)}
        loading={toggleActive.isPending}
        disabled={isProtectedUser}
      >
        {user.is_active ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
      </Button>

      <UserForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={(values) =>
          updateUser.mutate({ id, data: values }, { onSuccess: () => setDrawerOpen(false) })
        }
        initialValues={user}
        loading={updateUser.isPending}
      />
    </div>
  )
}
