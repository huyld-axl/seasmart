import { useState } from 'react'
import { Button, Drawer, Form, Input, Select, Space } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import useTranslation from '../../../hooks/useTranslation'

const ROLES = ['admin', 'operator', 'accountant', 'seafarer']

function FilterFields({ onFinish, onClear, initialValues }) {
  const { t } = useTranslation()
  const hasFilters = initialValues?.email || initialValues?.role || initialValues?.is_active
  return (
    <Form
      layout="inline"
      onFinish={onFinish}
      initialValues={initialValues}
      style={{ flexWrap: 'wrap', gap: 8 }}
    >
      <Form.Item name="email">
        <Input placeholder={t('user.filterEmailPh')} allowClear style={{ width: 200 }} />
      </Form.Item>
      <Form.Item name="role">
        <Select placeholder={t('user.roleSelectPh')} allowClear style={{ width: 160 }}>
          {ROLES.map((r) => (
            <Select.Option key={r} value={r}>
              {t(`user.roles.${r}`)}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="is_active">
        <Select placeholder={t('common.status')} allowClear style={{ width: 140 }}>
          <Select.Option value="true">{t('common.active')}</Select.Option>
          <Select.Option value="false">{t('common.locked')}</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            {t('common.filter')}
          </Button>
          <Button disabled={!hasFilters} onClick={onClear}>
            {t('common.clearFilters')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default function UserFilters({ filters, onChange }) {
  const { t } = useTranslation()
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
          {t('common.filters')}
        </Button>
        <Drawer
          title={t('common.filters')}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="bottom"
          height="auto"
        >
          <Form layout="vertical" onFinish={handleFinish} initialValues={filters}>
            <Form.Item name="email" label="Email">
              <Input placeholder={t('user.filterEmailPh')} allowClear />
            </Form.Item>
            <Form.Item name="role" label={t('common.role')}>
              <Select placeholder={t('user.filterRolePh')} allowClear>
                {ROLES.map((r) => (
                  <Select.Option key={r} value={r}>
                    {t(`user.roles.${r}`)}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="is_active" label={t('common.status')}>
              <Select placeholder={t('user.filterStatusPh')} allowClear>
                <Select.Option value="true">{t('common.active')}</Select.Option>
                <Select.Option value="false">{t('common.locked')}</Select.Option>
              </Select>
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.apply')}
              </Button>
              <Button
                onClick={() => {
                  onChange({})
                  setDrawerOpen(false)
                }}
              >
                {t('common.clearFilters')}
              </Button>
            </Space>
          </Form>
        </Drawer>
      </>
    )
  }

  return (
    <FilterFields onFinish={handleFinish} onClear={() => onChange({})} initialValues={filters} />
  )
}
