import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Input, Select } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import UserTable from '../../../components/admin/users/UserTable'
import UserForm from '../../../components/admin/users/UserForm'
import useToast from '../../../components/ds/useToast'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import ListFooter from '../../../components/ds/ListFooter'
import useListSticky from '../../../components/ds/useListSticky'
import useAccountRights from '../../../hooks/useAccountRights'
import { useRoleOptions } from '../../../hooks/useRoles'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResendInvite,
} from '../../../hooks/useUsers'

const PAGE_SIZE = 20 // mặc định; người dùng đổi ở dòng chân
const errorText = (error) =>
  error?.response?.data?.message || error?.response?.data?.error || 'Thử lại sau ít phút.'

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
  const resendInvite = useResendInvite()
  const [formKey, setFormKey] = useState(0)

  const rows = data?.data || []
  const total = data?.total || 0
  const filtered = !!(filters.email || filters.role_id || filters.status)
  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }))
    if (key === 'role_id')
      setSearchParams(value ? { role_id: String(value) } : {}, { replace: true })
  }

  const openPanel = (user) => {
    setEditTarget(user)
    setPanelOpen(true)
  }

  const handleSubmit = (values, form, addAnother) => {
    const name = values.full_name?.trim() || values.email
    const done = (text) => ({
      onSuccess: () => {
        toast.success(text)
        if (addAnother) {
          form.resetFields()
          setFormKey((key) => key + 1)
        } else setPanelOpen(false)
      },
      onError: (error) => toast.error('Không lưu được tài khoản', { description: errorText(error) }),
    })
    if (editTarget) updateUser.mutate({ id: editTarget.id, data: values }, done(`Đã lưu ${name}`))
    else createUser.mutate(values, done(`Đã tạo tài khoản và gửi email mời tới ${values.email}`))
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
          (error) => toast.error(`Không xoá được ${user.email}`, { description: errorText(error) })
        ),
    })

  const handleResend = (user) =>
    resendInvite.mutate(user.id, {
      onSuccess: () => toast.success(`Đã gửi lại lời mời tới ${user.email}`),
      onError: (error) => toast.error('Không gửi được lời mời', { description: errorText(error) }),
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
              Thêm tài khoản
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
          onResendInvite={handleResend}
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
          <StatusTabs
            tabs={[
              { value: 'all', label: 'Tất cả' },
              { value: 'pending', label: 'Chờ kích hoạt' },
              { value: 'active', label: 'Hoạt động' },
              { value: 'locked', label: 'Đã khoá' },
            ]}
            value={filters.status || 'all'}
            onChange={(value) => setFilter('status', value === 'all' ? '' : value)}
          />
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm tên, email"
            aria-label="Tìm tên, email"
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
          {rights.canCreate ? (
            <span className="ds-toolbar__end">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>
                Thêm tài khoản
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
        resetKey={formKey}
      />
    </div>
  )
}
