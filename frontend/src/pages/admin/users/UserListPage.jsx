import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Input, Select } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import UserTable from '../../../components/admin/users/UserTable'
import UserForm from '../../../components/admin/users/UserForm'
import useToast from '../../../components/ds/useToast'
import { EmptyState } from '../../../components/ds/Controls'
import ListFooter from '../../../components/ds/ListFooter'
import useListSticky from '../../../components/ds/useListSticky'
import useAccountRights from '../../../hooks/useAccountRights'
import { useRoleOptions } from '../../../hooks/useRoles'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleActive,
} from '../../../hooks/useUsers'

const PAGE_SIZE = 20 // mặc định; người dùng đổi ở dòng chân
const errorText = (error) =>
  error?.response?.data?.message || error?.response?.data?.error || 'Có lỗi, thử lại sau.'

export default function UserListPage() {
  // `?role_id=` (từ menu "Xem N tài khoản" ở màn Vai trò và quyền) lọc sẵn theo vai trò; `none` = chưa có vai trò.
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    page: 1,
    limit: PAGE_SIZE,
    role_id: searchParams.get('role_id') || undefined,
  }))
  const rights = useAccountRights()
  const { data: roleOptions = [] } = useRoleOptions()
  const [panelOpen, setPanelOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const toast = useToast()
  const tableScroll = useListSticky()
  const { modal } = App.useApp()

  const { data, isLoading, isError, refetch } = useUsers(filters)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const toggleActive = useToggleActive()

  const rows = data?.data || []
  const total = data?.total || 0
  const filtered = !!(filters.email || filters.role_id || filters.is_active)
  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }))
    if (key === 'role_id')
      setSearchParams(value ? { role_id: String(value) } : {}, { replace: true })
  }

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
    if (editTarget)
      updateUser.mutate({ id: editTarget.id, data: values }, done(`Đã lưu ${values.email}`))
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
      onSuccess: () =>
        toast.success(user.is_active ? `Đã khoá ${user.email}` : `Đã mở lại ${user.email}`),
      onError: (error) => toast.error(errorText(error)),
    })

  let body
  if (isError) {
    body = (
      <EmptyState
        isError
        title="Không tải được danh sách tài khoản"
        description="Mất kết nối tới máy chủ."
        action={<Button onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  } else if (!isLoading && !rows.length) {
    body = filtered ? (
      <EmptyState
        title="Không có tài khoản nào khớp bộ lọc"
        action={
          <Button
            onClick={() => {
              setFilters({ page: 1, limit: PAGE_SIZE })
              setSearchParams({}, { replace: true })
            }}
          >
            Xoá bộ lọc
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="Chưa có tài khoản nào"
        action={
          rights.canCreate ? (
            <Button icon={<PlusOutlined />} onClick={() => openPanel(null)}>
              Tạo tài khoản
            </Button>
          ) : undefined
        }
      />
    )
  } else {
    body = (
      <>
        <UserTable
          data={rows}
          loading={isLoading}
          scroll={tableScroll}
          onEdit={openPanel}
          onDelete={confirmDelete}
          onToggleActive={handleToggle}
        />
        <ListFooter
          total={total}
          page={filters.page}
          pageSize={filters.limit}
          unit="tài khoản"
          onChange={(page, limit) => setFilters((current) => ({ ...current, page, limit }))}
        />
      </>
    )
  }

  return (
    <div className="ds-page">
      <div className="ds-card ds-card--fixed">
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
            value={filters.role_id}
            onChange={(value) => setFilter('role_id', value)}
            options={[
              ...roleOptions.map((role) => ({ value: String(role.id), label: role.name })),
              { value: 'none', label: 'Chưa có vai trò' },
            ]}
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
          {rights.canCreate ? (
            <span className="ds-toolbar__end">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>
                Tạo tài khoản
              </Button>
            </span>
          ) : null}
        </div>
        {body}
      </div>
      <UserForm
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleSubmit}
        initialValues={editTarget}
        loading={createUser.isPending || updateUser.isPending}
      />
    </div>
  )
}
