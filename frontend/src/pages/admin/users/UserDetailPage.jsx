import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { App, Button, Spin } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useUser, useUpdateUser, useToggleActive, useDeleteUser } from '../../../hooks/useUsers'
import RoleBadge from '../../../components/admin/users/RoleBadge'
import UserForm from '../../../components/admin/users/UserForm'
import DescriptionList from '../../../components/ds/DescriptionList'
import useToast from '../../../components/ds/useToast'
import { EmptyState } from '../../../components/ds/Controls'

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('vi-VN') : null)
const errorText = (error) => error?.response?.data?.message || error?.response?.data?.error || 'Có lỗi, thử lại sau.'

export default function UserDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const toast = useToast()
  const { data: user, isLoading } = useUser(id)
  const updateUser = useUpdateUser()
  const toggleActive = useToggleActive()
  const deleteUser = useDeleteUser()
  const [panelOpen, setPanelOpen] = useState(false)

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (!user) return <EmptyState title="Không tìm thấy tài khoản" action={<Button onClick={() => navigate('/admin/users')}>Về danh sách tài khoản</Button>} />

  const confirmDelete = () =>
    modal.confirm({
      title: `Xoá tài khoản ${user.email}?`,
      content: 'Người này không đăng nhập được nữa. Muốn tạm chặn thì khoá đăng nhập thay vì xoá.',
      okText: 'Xoá tài khoản',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      autoFocusButton: 'cancel',
      onOk: () =>
        deleteUser.mutateAsync(id).then(
          () => {
            toast.success(`Đã xoá ${user.email}`)
            navigate('/admin/users')
          },
          (error) => toast.error(errorText(error))
        ),
    })

  return (
    <div className="ds-page" style={{ maxWidth: 720 }}>
      <nav aria-label="Đường dẫn" style={{ color: 'var(--muted)' }}>
        <Link to="/admin/users" style={{ color: 'var(--muted)' }}>Tài khoản</Link>
      </nav>
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">{user.email}</h1>
          <p className="ds-page__desc" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RoleBadge role={user.role} /> {user.is_active ? 'Được phép đăng nhập' : 'Đã khoá đăng nhập'}
          </p>
        </div>
        <div className="ds-page__actions">
          <Button
            loading={toggleActive.isPending}
            onClick={() =>
              toggleActive.mutate(id, {
                onSuccess: () => toast.success(user.is_active ? 'Đã khoá đăng nhập' : 'Đã mở lại đăng nhập'),
                onError: (error) => toast.error(errorText(error)),
              })
            }
          >
            {user.is_active ? 'Khoá đăng nhập' : 'Mở lại đăng nhập'}
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setPanelOpen(true)}>
            Sửa
          </Button>
        </div>
      </div>
      <div className="ds-card" style={{ padding: 20 }}>
        <DescriptionList
          items={[
            { label: 'Email', value: user.email },
            { label: 'Vai trò', value: <RoleBadge role={user.role} /> },
            { label: 'Ngày tạo', value: formatDateTime(user.created_at) },
            { label: 'Cập nhật lần cuối', value: formatDateTime(user.updated_at) },
          ]}
        />
      </div>
      <div>
        <Button danger onClick={confirmDelete}>
          Xoá tài khoản
        </Button>
      </div>
      <UserForm
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={(values) =>
          updateUser.mutate(
            { id, data: values },
            {
              onSuccess: () => {
                toast.success('Đã lưu')
                setPanelOpen(false)
              },
              onError: (error) => toast.error(errorText(error)),
            }
          )
        }
        initialValues={user}
        loading={updateUser.isPending}
      />
    </div>
  )
}
