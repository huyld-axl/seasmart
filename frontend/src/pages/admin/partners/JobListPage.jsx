import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Button,
  Select,
  Grid,
  Spin,
  Pagination,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Space,
  Tag,
  App,
  Typography,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { jobApi, lookupApi, seafarerApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import useTranslation from '../../../hooks/useTranslation'

const { Title } = Typography
const { useBreakpoint } = Grid

const STATUS_COLOR = { OPEN: 'green', FILLED: 'blue', CANCELLED: 'default' }
const PAYMENT_COLOR = { UNPAID: 'red', PAID: 'green', PARTIAL: 'orange' }
const JOB_STATUS_KEYS = ['OPEN', 'FILLED', 'CANCELLED']
const PAYMENT_STATUS_KEYS = ['UNPAID', 'PAID', 'PARTIAL']
const PAYMENT_CYCLE_KEYS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY', 'PER_VOYAGE']

export default function JobListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isReadOnly = !['admin', 'operator', 'accountant'].includes(user?.role)
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [filters, setFilters] = useState({
    ship_owner_id: undefined,
    status: undefined,
    rank_id: undefined,
    has_payment: undefined,
    vessel_id: undefined,
  })
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [editingContract, setEditingContract] = useState(null)
  const [paymentFileList, setPaymentFileList] = useState([])
  const [form] = Form.useForm()
  const [payForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', { ...filters, page }],
    queryFn: () => {
      const params = { page, limit: 20 }
      if (filters.ship_owner_id) params.ship_owner_id = filters.ship_owner_id
      if (filters.status) params.status = filters.status
      if (filters.rank_id) params.rank_id = filters.rank_id
      if (filters.has_payment != null) params.has_payment = filters.has_payment
      if (filters.vessel_id) params.vessel_id = filters.vessel_id.value
      return jobApi.list(params).then((r) => r.data)
    },
  })

  const { data: shipOwners } = useQuery({
    queryKey: ['ship-owners-lookup'],
    queryFn: () => lookupApi.shipOwners().then((r) => r.data),
  })

  const [modalPartnerSearch, setModalPartnerSearch] = useState('')
  const [selectedPartnerOption, setSelectedPartnerOption] = useState(null)
  const { data: modalPartners } = useQuery({
    queryKey: ['partners-modal-search', modalPartnerSearch],
    queryFn: () => lookupApi.shipOwners(modalPartnerSearch || undefined).then((r) => r.data),
    enabled: modalOpen,
  })
  const modalPartnerOptions = useMemo(() => {
    const results = (modalPartners || []).map((s) => ({
      value: s.id,
      label: s.company_name,
      payment_cycle: s.payment_cycle,
    }))
    if (selectedPartnerOption && !results.find((o) => o.value === selectedPartnerOption.value)) {
      results.unshift(selectedPartnerOption)
    }
    return results
  }, [modalPartners, selectedPartnerOption])

  const { data: ranks } = useQuery({
    queryKey: ['ranks-lookup'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  const { data: vessels } = useQuery({
    queryKey: ['vessels-lookup'],
    queryFn: () => lookupApi.vessels().then((r) => r.data),
    enabled: modalOpen,
  })

  const [vesselSearch, setVesselSearch] = useState('')
  const { data: vesselSuggestions } = useQuery({
    queryKey: ['vessels-filter-search', vesselSearch],
    queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data),
    enabled: vesselSearch.length >= 1,
  })

  const { data: seafarers } = useQuery({
    queryKey: ['seafarers-lookup'],
    queryFn: () => seafarerApi.list({ limit: 500 }).then((r) => r.data?.data || r.data),
    enabled: modalOpen,
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      jobApi.create({
        ...values,
        start_date: values.start_date?.format?.('YYYY-MM-DD') || undefined,
        contract_date: values.contract_date?.format?.('YYYY-MM-DD') || undefined,
        end_date: values.end_date?.format?.('YYYY-MM-DD') || undefined,
        salary: values.salary || undefined,
        salary_currency: values.salary_currency || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setModalOpen(false)
      form.resetFields()
      setPage(1)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) =>
      jobApi.update(id, {
        ...values,
        start_date: values.start_date?.format?.('YYYY-MM-DD') || undefined,
        contract_date: values.contract_date?.format?.('YYYY-MM-DD') || undefined,
        end_date: values.end_date?.format?.('YYYY-MM-DD') || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setModalOpen(false)
      setEditingContract(null)
      form.resetFields()
    },
  })

  const paymentMutation = useMutation({
    mutationFn: ({ id, values }) => {
      const formData = new FormData()
      formData.append('payment_cycle_text', values.payment_cycle_text || '')
      formData.append('amount', values.amount || '')
      formData.append('paid_at', values.paid_at?.format?.('YYYY-MM-DD HH:mm:ss') || '')
      formData.append('notes', values.notes || '')
      if (paymentFileList[0]?.originFileObj) {
        formData.append('attachment', paymentFileList[0].originFileObj)
      }
      return jobApi.createPayment(id, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setPayModalOpen(false)
      setEditingContract(null)
      setPaymentFileList([])
      payForm.resetFields()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => jobApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })

  function openCreate() {
    setEditingContract(null)
    setSelectedPartnerOption(null)
    setModalPartnerSearch('')
    form.resetFields()
    form.setFieldsValue({ currency: 'USD', status: 'OPEN', salary_currency: 'USD' })
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditingContract(row)
    setSelectedPartnerOption(
      row.ship_owner_id ? { value: row.ship_owner_id, label: row.ship_owner_name } : null
    )
    setModalPartnerSearch('')
    form.setFieldsValue({
      ship_owner_id: row.ship_owner_id,
      vessel_id: row.vessel_id,
      seafarer_id: row.seafarer_id || undefined,
      rank_id: row.rank_id,
      start_date: row.start_date ? dayjs(row.start_date) : null,
      contract_date: row.contract_date ? dayjs(row.contract_date) : null,
      end_date: row.end_date ? dayjs(row.end_date) : null,
      amount: row.amount,
      currency: row.currency || 'VND',
      payment_cycle: row.payment_cycle,
      notes: row.notes,
      status: row.status,
    })
    setModalOpen(true)
  }

  function openPayment(row) {
    setEditingContract(row)
    payForm.resetFields()
    payForm.setFieldsValue({ paid_at: dayjs() })
    setPaymentFileList([])
    setPayModalOpen(true)
  }

  function handleDelete(row) {
    modal.confirm({
      title: t('job.deleteConfirmTitle'),
      content: t('job.deleteConfirmBody', {
        rank: row.rank_code || '',
        vessel: row.vessel_name || '-',
      }),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(row.id),
    })
  }

  function handleSubmit(values) {
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, values })
    } else {
      createMutation.mutate({
        ...values,
        status: values.seafarer_id ? 'FILLED' : 'OPEN',
      })
    }
  }

  const sortedShipOwners = [...(shipOwners || [])].sort((a, b) => {
    const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    return (b?.id || 0) - (a?.id || 0)
  })

  const shipOwnerOptions = sortedShipOwners.map((s) => ({
    value: s.id,
    label: s.company_name,
    payment_cycle: s.payment_cycle,
  }))
  const rankOptions = (ranks || []).map((r) => ({ value: r.id, label: r.code }))
  const rankFilterOptions = (ranks || []).map((r) => ({ value: r.id, label: r.code, code: r.code }))
  const vesselOptions = (vessels || []).map((v) => ({
    value: v.id,
    label: `${v.vessel_name}${v.imo_number ? ` (IMO: ${v.imo_number})` : ''}`,
  }))
  const seafarerOptions = useMemo(
    () =>
      (seafarers || []).map((s) => {
        const statusTxt =
          s.status && ['STANDBY', 'ONBOARD', 'SIGNOFF'].includes(s.status)
            ? t(`job.pickerStatus.${s.status}`)
            : s.status || ''
        return {
          value: s.id,
          label: `${s.full_name}${s.rank_code ? ` (${s.rank_code})` : ''} - ${statusTxt}`,
        }
      }),
    [seafarers, t]
  )

  const paymentCycleFormOptions = useMemo(
    () =>
      PAYMENT_CYCLE_KEYS.map((value) => ({
        value,
        label: t(`job.paymentCycle.${value}`),
      })),
    [t]
  )

  function handleVesselChange(vesselId) {
    if (!vesselId) return
  }

  const columns = [
    { title: t('job.colPartner'), dataIndex: 'ship_owner_name', render: (v) => v || '-' },
    { title: t('common.vessel'), dataIndex: 'vessel_name', render: (v) => v || '-' },
    { title: t('common.rank'), dataIndex: 'rank_code', render: (v) => v || '-' },
    { title: t('common.seafarer'), dataIndex: 'seafarer_name', render: (v) => v || '-' },
    {
      title: t('job.colAmount'),
      dataIndex: 'amount',
      render: (v, r) =>
        v != null ? `${Number(v).toLocaleString('vi-VN')} ${r.currency || 'VND'}` : '-',
    },
    {
      title: t('job.colContractStatus'),
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v] || 'default'}>{t(`job.statusMap.${v}`) || v}</Tag>,
    },
    {
      title: t('job.colPaidCycle'),
      dataIndex: 'latest_payment_cycle_text',
      render: (v) => v || '-',
    },
    {
      title: '',
      width: 110,
      render: (_, r) =>
        isReadOnly ? null : (
          <Space size="small">
            <Button
              size={isMobile ? 'small' : 'middle'}
              icon={<DollarOutlined />}
              onClick={() => openPayment(r)}
              title={t('job.tooltipAddPayment')}
            />
            <Button
              size={isMobile ? 'small' : 'middle'}
              icon={<EditOutlined />}
              onClick={() => openEdit(r)}
            />
            <Button
              size={isMobile ? 'small' : 'middle'}
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(r)}
            />
          </Space>
        ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Title level={isMobile ? 5 : 4} style={{ margin: 0, width: isMobile ? '100%' : 'auto' }}>
          {t('job.pageTitle')}
        </Title>
        {!isReadOnly && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size={isMobile ? 'small' : 'middle'}
            style={{ width: isMobile ? '100%' : 'auto' }}
            onClick={openCreate}
          >
            {t('job.addJob')}
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
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))',
            gap: 8,
            width: '100%',
          }}
        >
          <Select
            allowClear
            showSearch
            placeholder={t('job.filterShipOwner')}
            style={{ width: '100%' }}
            options={shipOwnerOptions}
            filterOption={(input, opt) =>
              (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            optionFilterProp="label"
            value={filters.ship_owner_id}
            onChange={(v) => {
              setFilters((f) => ({ ...f, ship_owner_id: v }))
              setPage(1)
            }}
          />
          <Select
            allowClear
            showSearch
            labelInValue
            placeholder="Tìm tên tàu / IMO"
            style={{ width: '100%' }}
            filterOption={false}
            onSearch={(v) => setVesselSearch(v)}
            notFoundContent={vesselSearch.length < 1 ? 'Nhập tên tàu hoặc IMO' : 'Không có kết quả'}
            options={(vesselSuggestions || []).map((v) => ({
              value: v.id,
              label: v.imo_number ? `${v.vessel_name} (${v.imo_number})` : v.vessel_name,
            }))}
            value={filters.vessel_id}
            onChange={(v) => {
              setFilters((f) => ({ ...f, vessel_id: v ?? undefined }))
              setVesselSearch('')
              setPage(1)
            }}
          />
          <Select
            allowClear
            placeholder={t('job.filterContractStatus')}
            style={{ width: '100%' }}
            options={JOB_STATUS_KEYS.map((v) => ({ value: v, label: t(`job.statusMap.${v}`) }))}
            value={filters.status}
            onChange={(v) => {
              setFilters((f) => ({ ...f, status: v }))
              setPage(1)
            }}
          />
          <Select
            allowClear
            placeholder="Thanh toán"
            style={{ width: '100%' }}
            options={[
              { value: 'true', label: 'Đã thanh toán' },
              { value: 'false', label: 'Chưa thanh toán' },
            ]}
            value={filters.has_payment}
            onChange={(v) => {
              setFilters((f) => ({ ...f, has_payment: v }))
              setPage(1)
            }}
          />
          <Select
            allowClear
            showSearch
            placeholder={t('job.filterRank')}
            style={{ width: '100%' }}
            options={rankFilterOptions}
            filterOption={(input, opt) =>
              (opt?.code ?? '').toLowerCase().includes(input.toLowerCase())
            }
            value={filters.rank_id}
            onChange={(v) => {
              setFilters((f) => ({ ...f, rank_id: v }))
              setPage(1)
            }}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Button
            icon={<ClearOutlined />}
            disabled={
              !filters.ship_owner_id &&
              !filters.status &&
              !filters.rank_id &&
              !filters.has_payment &&
              !filters.vessel_id
            }
            onClick={() => {
              setFilters({
                ship_owner_id: undefined,
                status: undefined,
                rank_id: undefined,
                has_payment: undefined,
                vessel_id: undefined,
              })
              setPage(1)
            }}
          >
            {t('common.clearFilters')}
          </Button>
        </div>
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
              onClick={() => navigate(`/jobs/${r.id}`)}
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
                    {r.rank_code || 'Job'} - {r.vessel_name || '-'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    {r.ship_owner_name || '-'}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    alignItems: 'flex-end',
                  }}
                >
                  <Tag color={STATUS_COLOR[r.status] || 'default'} style={{ margin: 0 }}>
                    {t(`job.statusMap.${r.status}`) || r.status}
                  </Tag>
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: '#595959' }}>
                {t('job.mobileAmount')}:{' '}
                {r.amount != null
                  ? `${Number(r.amount).toLocaleString('vi-VN')} ${r.currency || 'VND'}`
                  : '-'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                {t('job.colPaidCycle')}: {r.latest_payment_cycle_text || '-'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                {t('job.mobileSeafarerLabel')}: {r.seafarer_name || '-'}
              </div>

              {!isReadOnly && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <Button
                    size="small"
                    icon={<DollarOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      openPayment(r)
                    }}
                  />
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(r)
                    }}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(r)
                    }}
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
              navigate(`/jobs/${row.id}`)
            },
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.total || 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => t('job.paginationTotal', { count: total }),
          }}
        />
      )}

      {/* Modal thêm / sửa job */}
      <Modal
        title={editingContract ? t('job.modalEditTitle') : t('job.modalCreateTitle')}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingContract(null)
          setModalPartnerSearch('')
          setSelectedPartnerOption(null)
          form.resetFields()
        }}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="ship_owner_id"
            label={t('job.colPartner')}
            rules={[{ required: true, message: t('job.reqPartner') }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={setModalPartnerSearch}
              placeholder={t('job.phPartner')}
              options={modalPartnerOptions}
              notFoundContent="Không tìm thấy công ty"
              onChange={(partnerId) => {
                const owner = modalPartnerOptions.find((s) => s.value === partnerId)
                if (owner) setSelectedPartnerOption({ value: owner.value, label: owner.label })
                if (owner?.payment_cycle) form.setFieldValue('payment_cycle', owner.payment_cycle)
              }}
            />
          </Form.Item>
          <Form.Item
            name="vessel_id"
            label={t('common.vessel')}
            rules={[{ required: true, message: t('job.reqVessel') }]}
          >
            <Select
              showSearch
              allowClear
              placeholder={t('job.phVessel')}
              options={vesselOptions}
              filterOption={(input, opt) =>
                (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={handleVesselChange}
            />
          </Form.Item>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '0 16px',
            }}
          >
            <Form.Item
              name="rank_id"
              label={t('common.rank')}
              rules={[{ required: true, message: t('job.reqRank') }]}
            >
              <Select
                showSearch
                placeholder={t('job.phRank')}
                options={rankOptions}
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item name="contract_date" label={t('job.labelContractSignDate')}>
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="start_date" label={t('job.labelStartDate')}>
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="end_date" label={t('job.labelEndDate')}>
              <DatePicker
                format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="amount" label={t('job.labelContractValue')}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
                parser={(v) => v?.replace(/[^\d]/g, '')}
              />
            </Form.Item>
            <Form.Item name="currency" label={t('job.labelCurrency')}>
              <Select
                defaultValue="USD"
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'VND', label: 'VND' },
                ]}
              />
            </Form.Item>
            <Form.Item name="payment_cycle" label={t('job.payCycleLabel')}>
              <Select options={paymentCycleFormOptions} />
            </Form.Item>
          </div>
          <Form.Item name="seafarer_id" label={t('common.seafarer')}>
            <Select
              showSearch
              allowClear
              placeholder={t('job.phSeafarerOptional')}
              options={seafarerOptions}
              filterOption={(input, opt) =>
                (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={(v) => {
                if (!editingContract) {
                  form.setFieldValue('status', v ? 'FILLED' : 'OPEN')
                }
              }}
            />
          </Form.Item>
          {!editingContract && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '0 16px',
              }}
            >
              <Form.Item name="salary" label={t('job.labelSalary')}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
                  parser={(v) => v?.replace(/[^\d]/g, '')}
                />
              </Form.Item>
              <Form.Item name="salary_currency" label={t('job.labelSalaryCurrency')}>
                <Select
                  defaultValue="USD"
                  options={[
                    { value: 'USD', label: 'USD' },
                    { value: 'VND', label: 'VND' },
                  ]}
                />
              </Form.Item>
            </div>
          )}
          {editingContract && (
            <Form.Item name="status" label={t('job.labelContractStatusShort')}>
              <Select
                options={JOB_STATUS_KEYS.map((v) => ({ value: v, label: t(`job.statusMap.${v}`) }))}
              />
            </Form.Item>
          )}
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingContract ? t('job.submitSave') : t('job.submitAdd')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal cập nhật thanh toán */}
      <Modal
        title={t('job.modalPayTitle')}
        open={payModalOpen}
        onCancel={() => {
          setPayModalOpen(false)
          setEditingContract(null)
          setPaymentFileList([])
          payForm.resetFields()
        }}
        footer={null}
        width={520}
      >
        <Form
          form={payForm}
          layout="vertical"
          onFinish={(values) => paymentMutation.mutate({ id: editingContract.id, values })}
        >
          <Form.Item
            name="payment_cycle_text"
            label={t('job.payCycleLabel')}
            rules={[{ required: true, message: t('job.reqPayCycle') }]}
          >
            <Input placeholder={t('job.payCyclePh')} />
          </Form.Item>
          <Form.Item
            name="amount"
            label={t('job.payAmountLabel')}
            rules={[{ required: true, message: t('job.reqPayAmount') }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              formatter={(v) => v && Number(v).toLocaleString('vi-VN')}
              parser={(v) => v?.replace(/[^\d]/g, '')}
            />
          </Form.Item>
          <Form.Item name="paid_at" label={t('job.payDateLabel')}>
            <DatePicker format={{ format: 'DD/MM/YYYY', type: 'mask' }} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={t('job.attachOptional')}>
            <Upload
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              beforeUpload={() => false}
              maxCount={1}
              fileList={paymentFileList}
              onChange={({ fileList }) => setPaymentFileList(fileList)}
            >
              <Button>{t('job.chooseFile')}</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setPayModalOpen(false)
                  setEditingContract(null)
                  setPaymentFileList([])
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={paymentMutation.isPending}>
                {t('job.submitSave')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
