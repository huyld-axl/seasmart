import { Table, List, Button, Popconfirm, Space, Switch, Typography } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import RoleBadge from './RoleBadge'
import useTranslation from '../../../hooks/useTranslation'

export default function UserTable({ data, loading, onEdit, onDelete, onToggleActive }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isMobile = window.innerWidth < 768
  const isProtectedUser = (record) => String(record?.id) === '1'

  const columns = [
    { title: t('user.emailCol'), dataIndex: 'email', key: 'email' },
    {
      title: t('user.roleCol'),
      dataIndex: 'role',
      key: 'role',
      render: (role) => <RoleBadge role={role} />,
    },
    {
      title: t('user.activateCol'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (val, record) => (
        <Switch
          checked={!!val}
          onChange={() => onToggleActive(record.id)}
          size="small"
          disabled={isProtectedUser(record)}
        />
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/users/${record.id}`)}
          />
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          {isProtectedUser(record) ? (
            <Button size="small" danger icon={<DeleteOutlined />} disabled />
          ) : (
            <Popconfirm
              title={t('user.deleteConfirmTitle')}
              description={t('common.deleteIrreversible')}
              onConfirm={() => onDelete(record.id)}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
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
                title={t('user.deleteConfirmTitle')}
                onConfirm={() => onDelete(item.id)}
                okText={t('common.delete')}
                cancelText={t('common.cancel')}
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
                    disabled={isProtectedUser(item)}
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
