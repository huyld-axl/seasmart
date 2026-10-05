import { useState } from 'react'
import { Button, Pagination, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import UserTable from '../../../components/admin/users/UserTable'
import UserFilters from '../../../components/admin/users/UserFilters'
import UserForm from '../../../components/admin/users/UserForm'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useToggleActive,
} from '../../../hooks/useUsers'

export default function UserListPage() {
  const [filters, setFilters] = useState({ page: 1, limit: 20 })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const { data, isLoading } = useUsers(filters)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const toggleActive = useToggleActive()

  const rows = data?.data || []
  const total = data?.total || 0

  const openCreate = () => {
    setEditTarget(null)
    setDrawerOpen(true)
  }
  const openEdit = (user) => {
    setEditTarget(user)
    setDrawerOpen(true)
  }
  const closeDrawer = () => setDrawerOpen(false)

  const handleSubmit = (values) => {
    if (editTarget) {
      updateUser.mutate({ id: editTarget.id, data: values }, { onSuccess: closeDrawer })
    } else {
      createUser.mutate(values, { onSuccess: closeDrawer })
    }
  }

  const handleFilterChange = (newFilters) => {
    setFilters((f) => ({ ...f, ...newFilters, page: 1 }))
  }

  return (
    <div className="page-container">
      <Space
        className="page-header"
        style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}
      >
        <Typography.Title level={4} className="page-title">
          Quản lý User
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tạo user
        </Button>
      </Space>

      <div className="page-filters">
        <UserFilters filters={filters} onChange={handleFilterChange} />
      </div>

      <UserTable
        data={rows}
        loading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => deleteUser.mutate(id)}
        onToggleActive={(id) => toggleActive.mutate(id)}
      />

      <div className="page-pagination">
        <Pagination
          current={filters.page}
          total={total}
          pageSize={20}
          onChange={(page) => setFilters((f) => ({ ...f, page }))}
          showTotal={(t) => `Tổng ${t} user`}
          showSizeChanger={false}
        />
      </div>

      <UserForm
        open={drawerOpen}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        initialValues={editTarget}
        loading={createUser.isPending || updateUser.isPending}
      />
    </div>
  )
}
