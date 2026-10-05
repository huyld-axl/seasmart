import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  Space,
  Tag,
  Switch,
  Grid,
  Spin,
  Pagination,
  App,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  ClearOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { partnerApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'
import useTranslation from '../../../hooks/useTranslation'

const PAYMENT_CYCLE_KEYS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY', 'PER_VOYAGE']
const PAYMENT_METHOD_KEYS = ['BANK_TRANSFER', 'CASH', 'OTHER']

const { useBreakpoint } = Grid

export default function PartnerListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const { user } = useAuthStore()
  const isReadOnly = !['admin', 'operator'].includes(user?.role)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [filters, setFilters] = useState({
    search: '',
    code: '',
    contact: '',
    is_active: undefined,
    payment_cycle: undefined,
  })
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['partners', { ...filters, page }],
    queryFn: () => {
      const params = { page, limit: 20 }
      if (filters.search) params.company_name = filters.search
      if (filters.code) params.code = filters.code
      if (filters.contact) params.contact_person = filters.contact
      if (filters.is_active !== undefined) params.is_active = filters.is_active
      if (filters.payment_cycle) params.payment_cycle = filters.payment_cycle
      return partnerApi.list(params).then((r) => r.data)
    },
  })

  const createMutation = useMutation({
    mutationFn: (values) => partnerApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      setModalOpen(false)
      form.resetFields()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => partnerApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partners'] }),
  })

  function handleDelete(record, e) {
    e.stopPropagation()
    modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa đối tác "${record.company_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(record.id),
    })
  }

  function openCreate() {
    form.resetFields()
    form.setFieldsValue({ is_active: true })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    form.resetFields()
  }

  function handleSubmit(values) {
    createMutation.mutate(values)
  }

  const isPending = createMutation.isPending

  const paymentCycles = useMemo(
    () =>
      PAYMENT_CYCLE_KEYS.map((value) => ({
        value,
        label: t(`job.paymentCycle.${value}`),
      })),
    [t]
  )
  const paymentMethodOptions = useMemo(
    () =>
      PAYMENT_METHOD_KEYS.map((value) => ({
        value,
        label: t(`partner.paymentMethod.${value}`),
      })),
    [t]
  )

  const columns = [
    { title: t('partner.colCode'), dataIndex: 'code', width: 100, render: (v) => v || '-' },
    { title: t('partner.colCompany'), dataIndex: 'company_name' },
    { title: t('partner.colContact'), dataIndex: 'contact_person', render: (v) => v || '-' },
    { title: t('partner.colContactPhone'), dataIndex: 'contact_phone', render: (v) => v || '-' },
    { title: t('partner.colContactEmail'), dataIndex: 'contact_email', render: (v) => v || '-' },
    {
      title: 'Hoa hồng',
      dataIndex: 'commission_rate',
      width: 90,
      render: (v) => (v != null ? `${v}%` : '-'),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      width: 100,
      render: (v) =>
        v ? (
          <Tag color="green">{t('partner.tagActive')}</Tag>
        ) : (
          <Tag color="default">{t('partner.tagInactive')}</Tag>
        ),
    },
    {
      title: '',
      width: 80,
      render: (_, r) =>
        isReadOnly ? null : (
          <Space size="small">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/partners/${r.id}`)
              }}
            />
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending && deleteMutation.variables === r.id}
              onClick={(e) => handleDelete(r, e)}
            />
          </Space>
        ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>
          {t('partner.pageTitle')}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!isReadOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('partner.addPartner')}
          </Button>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          border: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Input
            placeholder={t('partner.colCompany')}
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            value={filters.search}
            onChange={(e) => {
              setFilters((f) => ({ ...f, search: e.target.value }))
              setPage(1)
            }}
            allowClear
          />
          <Input
            placeholder={t('partner.colCode')}
            value={filters.code}
            onChange={(e) => {
              setFilters((f) => ({ ...f, code: e.target.value }))
              setPage(1)
            }}
            allowClear
          />
          <Input
            placeholder={t('partner.colContact')}
            value={filters.contact}
            onChange={(e) => {
              setFilters((f) => ({ ...f, contact: e.target.value }))
              setPage(1)
            }}
            allowClear
          />
          <Select
            allowClear
            placeholder={t('common.status')}
            style={{ width: '100%' }}
            value={filters.is_active}
            onChange={(v) => {
              setFilters((f) => ({ ...f, is_active: v }))
              setPage(1)
            }}
            options={[
              { value: 'true', label: t('partner.tagActive') },
              { value: 'false', label: t('partner.tagInactive') },
            ]}
          />
          <Select
            allowClear
            placeholder={t('partner.colPaymentCycle')}
            style={{ width: '100%' }}
            value={filters.payment_cycle}
            onChange={(v) => {
              setFilters((f) => ({ ...f, payment_cycle: v }))
              setPage(1)
            }}
            options={paymentCycles}
          />
        </div>
        <Button
          icon={<ClearOutlined />}
          disabled={
            !filters.search &&
            !filters.code &&
            !filters.contact &&
            filters.is_active === undefined &&
            !filters.payment_cycle
          }
          onClick={() => {
            setFilters({
              search: '',
              code: '',
              contact: '',
              is_active: undefined,
              payment_cycle: undefined,
            })
            setPage(1)
          }}
        >
          {t('common.clearFilters')}
        </Button>
      </div>

      {isMobile ? (
        <div>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {(data?.data || []).map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/partners/${r.id}`)}
              style={{
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #f0f0f0',
                padding: '12px 14px',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: '#1677ff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.company_name || '-'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    {t('partner.mobileCode')} {r.code || '-'}
                  </div>
                </div>
                <Tag color={r.is_active ? 'green' : 'default'} style={{ margin: 0 }}>
                  {r.is_active ? t('partner.tagActive') : t('partner.tagInactive')}
                </Tag>
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: '#595959' }}>
                {t('partner.mobileContact')} {r.contact_person || '-'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                {t('partner.mobilePhone')} {r.contact_phone || '-'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                {t('partner.mobileEmail')} {r.contact_email || '-'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                Hoa hồng: {r.commission_rate != null ? `${r.commission_rate}%` : '-'}
              </div>

              {!isReadOnly && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/partners/${r.id}`)
                    }}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending && deleteMutation.variables === r.id}
                    onClick={(e) => handleDelete(r, e)}
                  />
                </div>
              )}
            </div>
          ))}
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Pagination
              current={page}
              pageSize={20}
              total={data?.total || 0}
              simple
              onChange={(p) => setPage(p)}
            />
          </div>
        </div>
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.data || []}
          loading={isLoading}
          size="small"
          scroll={{ x: 'max-content' }}
          onRow={(row) => ({
            onClick: (e) => {
              if (e.target.closest('button')) return
              navigate(`/partners/${row.id}`)
            },
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total || 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => t('partner.paginationTotal', { count: total }),
          }}
        />
      )}

      <Modal
        title={t('partner.modalTitle')}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="code" label={t('partner.labelCode')}>
            <Input />
          </Form.Item>
          <Form.Item
            name="company_name"
            label={t('partner.labelCompany')}
            rules={[{ required: true, message: t('partner.companyRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="representative" label="Người đại diện">
            <Input />
          </Form.Item>
          <Form.Item name="commission_rate" label="Hoa hồng (%)">
            <Input type="number" min={0} max={100} step={0.1} suffix="%" />
          </Form.Item>
          <Form.Item name="tax_id" label="Mã số thuế">
            <Input />
          </Form.Item>
          <Form.Item name="contact_person" label={t('partner.labelContactPerson')}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_phone" label={t('partner.labelContactPhone')}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_email" label={t('partner.labelContactEmail')}>
            <Input />
          </Form.Item>
          <Form.Item name="payment_cycle" label={t('partner.labelPaymentCycle')}>
            <Select options={paymentCycles} allowClear />
          </Form.Item>
          <Form.Item name="payment_method" label={t('partner.labelPaymentMethod')}>
            <Select options={paymentMethodOptions} allowClear />
          </Form.Item>
          <Form.Item name="payment_terms" label={t('partner.labelPaymentTerms')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="payment_account_name" label={t('partner.labelAccountName')}>
            <Input />
          </Form.Item>
          <Form.Item name="payment_account_number" label={t('partner.labelAccountNumber')}>
            <Input />
          </Form.Item>
          <Form.Item name="payment_bank_name" label={t('partner.labelBank')}>
            <Input />
          </Form.Item>
          <Form.Item name="payment_bank_branch" label={t('partner.labelBankBranch')}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t('partner.labelAddress')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label={t('partner.labelNotes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="is_active"
            label={t('partner.labelActiveSwitch')}
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={closeModal}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={isPending}>
                {t('partner.submitAdd')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
