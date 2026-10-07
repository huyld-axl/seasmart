import { useState } from 'react'
import { App, Button, Input, Pagination, Select } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import UserTable from '../../../components/admin/users/UserTable'
import UserForm from '../../../components/admin/users/UserForm'
import useToast from '../../../components/ds/useToast'
import { EmptyState } from '../../../components/ds/Controls'
import { ROLES, ROLE_LABELS } from '../../../constants/roles'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useToggleActive } from '../../../hooks/useUsers'

const PAGE_SIZE = 20
const errorText = (error) => error?.response?.data?.message || error?.response?.data?.error || 'Có lỗi, thử lại sau.'

export default function UserListPage() {
  const [filters, setFilters] = useState({ page: 1, limit: PAGE_SIZE })
  const [panelOpen, setPanelOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const toast = useToast()
  const { modal } = App.useApp()

  const { data, isLoading, isError, refetch } = useUsers(filters)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const toggleActive = useToggleActive()

  const rows = data?.data || []
  const total = data?.total || 0
  const filtered = !!(filters.email || filters.role || filters.is_active)
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }))

  const openPanel = (user) => {
    setEditTarget(user)
    setPanelOpen(true)
  }

  const handleSubmit = (values) => {
    const done = (text) => ({
      onSuccess: () => {
        toast.success(text)
        setPanelOpen(false)
      },
      onError: (error) => toast.error(errorText(error)),
    })
    if (editTarget) updateUser.mutate({ id: editTarget.id, data: values }, done(`Đã lưu ${values.email}`))
    else createUser.mutate(values, done(`Đã tạo tài khoản ${values.email}`))
  }

  const confirmDelete = (user) =>
    modal.confirm({
      title: `Xoá tài khoản ${user.email}?`,
      content: 'Người này không đăng nhập được nữa. Muốn tạm chặn thì tắt "Đăng nhập" thay vì xoá.',
      okText: 'Xoá tài khoản',
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      autoFocusButton: 'cancel',
      onOk: () =>
        deleteUser.mutateAsync(user.id).then(
          () => toast.success(`Đã xoá ${user.email}`),
          (error) => toast.error(errorText(error))
        ),
    })

  const handleToggle = (user) =>
    toggleActive.mutate(user.id, {
      onSuccess: () => toast.success(user.is_active ? `Đã khoá ${user.email}` : `Đã mở lại ${user.email}`),
      onError: (error) => toast.error(errorText(error)),
    })

  let body
  if (isError) {
    body = <EmptyState isError title="Không tải được danh sách tài khoản" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  } else if (!isLoading && !rows.length) {
    body = filtered ? (
      <EmptyState title="Không có tài khoản nào khớp bộ lọc" action={<Button onClick={() => setFilters({ page: 1, limit: PAGE_SIZE })}>Xoá bộ lọc</Button>} />
    ) : (
      <EmptyState title="Chưa có tài khoản nào" action={<Button icon={<PlusOutlined />} onClick={() => openPanel(null)}>Tạo tài khoản</Button>} />
    )
  } else {
    body = (
      <>
        <UserTable data={rows} loading={isLoading} onEdit={openPanel} onDelete={confirmDelete} onToggleActive={handleToggle} />
        <div className="ds-table-foot">
          <span className="ds-num">{total} tài khoản</span>
          {total > PAGE_SIZE ? (
            <Pagination simple current={filters.page} total={total} pageSize={PAGE_SIZE} onChange={(page) => setFilters((current) => ({ ...current, page }))} />
          ) : null}
        </div>
      </>
    )
  }

  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">Tài khoản</h1>
          <p className="ds-page__desc">Ai đăng nhập được vào MCAH và với vai trò gì.</p>
        </div>
      </div>
      <div className="ds-toolbar">
        <Input
          className="ds-toolbar__search"
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo email"
          aria-label="Tìm theo email"
          defaultValue={filters.email}
          onPressEnter={(event) => setFilter('email', event.target.value.trim())}
          onChange={(event) => !event.target.value && setFilter('email', '')}
        />
        <Select
          allowClear
          style={{ width: 200 }}
          placeholder="Vai trò: Tất cả"
          value={filters.role}
          onChange={(value) => setFilter('role', value)}
          options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          aria-label="Lọc theo vai trò"
        />
        <Select
          allowClear
          style={{ width: 180 }}
          placeholder="Đăng nhập: Tất cả"
          value={filters.is_active}
          onChange={(value) => setFilter('is_active', value)}
          options={[
            { value: 'true', label: 'Cho phép' },
            { value: 'false', label: 'Đã khoá' },
          ]}
          aria-label="Lọc theo trạng thái đăng nhập"
        />
        <span className="ds-toolbar__end">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>
            Tạo tài khoản
          </Button>
        </span>
      </div>
      <div className="ds-card">{body}</div>
      <UserForm open={panelOpen} onClose={() => setPanelOpen(false)} onSubmit={handleSubmit} initialValues={editTarget} loading={createUser.isPending || updateUser.isPending} />
    </div>
  )
}
