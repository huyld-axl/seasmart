import { useState } from 'react'
import { Button, Drawer, Form, Input, Select, Space } from 'antd'
import { FilterOutlined } from '@ant-design/icons'

const ROLES = ['admin', 'operator', 'training_center', 'manning_agent', 'seafarer']
const ROLE_LABELS = {
  admin: 'Admin',
  operator: 'Operator',
  training_center: 'Training Center',
  manning_agent: 'Manning Agent',
  seafarer: 'Seafarer',
}

function FilterFields({ onFinish, initialValues }) {
  return (
    <Form
      layout="inline"
      onFinish={onFinish}
      initialValues={initialValues}
      style={{ flexWrap: 'wrap', gap: 8 }}
    >
      <Form.Item name="email">
        <Input placeholder="Tìm theo email" allowClear style={{ width: 200 }} />
      </Form.Item>
      <Form.Item name="role">
        <Select placeholder="Role" allowClear style={{ width: 160 }}>
          {ROLES.map((r) => (
            <Select.Option key={r} value={r}>
              {ROLE_LABELS[r]}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="is_active">
        <Select placeholder="Trạng thái" allowClear style={{ width: 140 }}>
          <Select.Option value="true">Đang hoạt động</Select.Option>
          <Select.Option value="false">Đã khóa</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Lọc
        </Button>
      </Form.Item>
    </Form>
  )
}

export default function UserFilters({ filters, onChange }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = window.innerWidth < 768

  const handleFinish = (values) => {
    const clean = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined && v !== '')
    )
    onChange(clean)
    setDrawerOpen(false)
  }

  if (isMobile) {
    return (
      <>
        <Button icon={<FilterOutlined />} onClick={() => setDrawerOpen(true)}>
          Bộ lọc
        </Button>
        <Drawer
          title="Bộ lọc"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="bottom"
          height="auto"
        >
          <Form layout="vertical" onFinish={handleFinish} initialValues={filters}>
            <Form.Item name="email" label="Email">
              <Input placeholder="Tìm theo email" allowClear />
            </Form.Item>
            <Form.Item name="role" label="Role">
              <Select placeholder="Chọn role" allowClear>
                {ROLES.map((r) => (
                  <Select.Option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="is_active" label="Trạng thái">
              <Select placeholder="Chọn trạng thái" allowClear>
                <Select.Option value="true">Đang hoạt động</Select.Option>
                <Select.Option value="false">Đã khóa</Select.Option>
              </Select>
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Áp dụng
              </Button>
              <Button
                onClick={() => {
                  onChange({})
                  setDrawerOpen(false)
                }}
              >
                Xóa lọc
              </Button>
            </Space>
          </Form>
        </Drawer>
      </>
    )
  }

  return <FilterFields onFinish={handleFinish} initialValues={filters} />
}
