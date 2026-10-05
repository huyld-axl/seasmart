import { Table, List, Tag, Button, Popconfirm, Space, Switch, Typography } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import RoleBadge from './RoleBadge'

export default function UserTable({ data, loading, onEdit, onDelete, onToggleActive }) {
  const navigate = useNavigate()
  const isMobile = window.innerWidth < 768

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (role) => <RoleBadge role={role} /> },
    {
      title: 'Kích hoạt',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (val, record) => (
        <Switch checked={!!val} onChange={() => onToggleActive(record.id)} size="small" />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/users/${record.id}`)}
          />
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          <Popconfirm
            title="Xóa user này?"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => onDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  if (isMobile) {
    return (
      <List
        loading={loading}
        dataSource={data}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/admin/users/${item.id}`)}
              />,
              <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(item)} />,
              <Popconfirm
                title="Xóa user này?"
                onConfirm={() => onDelete(item.id)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={<Typography.Text>{item.email}</Typography.Text>}
              description={
                <Space>
                  <RoleBadge role={item.role} />
                  <Switch
                    checked={!!item.is_active}
                    onChange={() => onToggleActive(item.id)}
                    size="small"
                  />
                </Space>
              }
            />
          </List.Item>
        )}
      />
    )
  }

  return (
    <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} />
  )
}
