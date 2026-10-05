import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Grid,
  Spin,
  message,
} from 'antd'
import { PlusOutlined, ClearOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { deploymentApi, lookupApi, seafarerApi } from '../../api'
import useTranslation from '../../hooks/useTranslation'

const STATUS_COLOR = {
  collecting_docs: 'default',
  confirmed: 'blue',
  pre_boarding: 'orange',
  onboard: 'green',
  signed_off: 'default',
  cancelled: 'red',
}

const DEPLOYMENT_STATUS_KEYS = [
  'collecting_docs',
  'confirmed',
  'pre_boarding',
  'onboard',
  'signed_off',
  'cancelled',
]

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')
const { useBreakpoint } = Grid

export default function DeploymentListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [vesselNameFilter, setVesselNameFilter] = useState('')
  const [rankFilter, setRankFilter] = useState()
  const [seafarerFilter, setSeafarerFilter] = useState()
  const [dateRange, setDateRange] = useState([])
  const [statusFilter, setStatusFilter] = useState()
  const [hideCancel, setHideCancel] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const [seafarerSearch, setSeafarerSearch] = useState('')
  const [vesselSearch, setVesselSearch] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  useEffect(() => {
    if (location.state?.copyFrom) {
      const d = location.state.copyFrom
      form.setFieldsValue({
        seafarer_id: d.seafarer_id || undefined,
        vessel_id: d.vessel_id || undefined,
        vessel_name: d.vessel_name || undefined,
        vessel_flag: d.vessel_flag || undefined,
        rank_id: d.rank_id || undefined,
        join_date: d.join_date ? dayjs(d.join_date) : undefined,
        notes: d.notes || undefined,
      })
      setTimeout(() => setCreateOpen(true), 0)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const { data, isLoading } = useQuery({
    queryKey: [
      'deployments-list',
      vesselNameFilter,
      rankFilter,
      seafarerFilter,
      dateRange,
      statusFilter,
    ],
    queryFn: () =>
      deploymentApi
        .listAll({
          vessel_name: vesselNameFilter || undefined,
          rank_id: rankFilter || undefined,
          seafarer_id: seafarerFilter || undefined,
          from_date: dateRange?.[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : undefined,
          to_date: dateRange?.[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : undefined,
          status: statusFilter,
        })
        .then((r) => r.data?.data || []),
  })

  const displayData = useMemo(() => {
    if (!data) return []
    if (hideCancel && !statusFilter) return data.filter((r) => r.status !== 'cancelled')
    return data
  }, [data, hideCancel, statusFilter])

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data?.data || r.data || []),
  })

  const { data: seafarers } = useQuery({
    queryKey: ['deployment-seafarer-options', seafarerSearch],
    queryFn: () =>
      seafarerApi
        .list({ page: 1, limit: 20, search: seafarerSearch || undefined })
        .then((r) => r.data?.data || []),
  })
  const { data: vessels } = useQuery({
    queryKey: ['deployment-vessels-create', vesselSearch],
    queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data?.data || r.data || []),
    enabled: createOpen,
  })
  const vesselOptions = useMemo(
    () =>
      (vessels || []).map((v) => {
        const vesselName = v.vessel_name || t('common.notAvailable')
        const imo = v.imo_number || t('common.notAvailable')
        return {
          value: v.id,
          label: `${vesselName} (IMO: ${imo})${v.flag_country_name ? ` - ${v.flag_country_name}` : ''}`,
          searchText: `${vesselName} ${imo}`.toLowerCase(),
          vessel_name: v.vessel_name,
          vessel_flag: v.flag_country_name,
        }
      }),
    [vessels, t]
  )

  const createMutation = useMutation({
    mutationFn: (values) =>
      deploymentApi.create(values.seafarer_id, {
        vessel_name: values.vessel_name,
        vessel_flag: values.vessel_flag,
        vessel_id: values.vessel_id || null,
        rank_id: values.rank_id,
        join_date: values.join_date?.format?.('YYYY-MM-DD') || null,
        sign_off_date: values.sign_off_date?.format?.('YYYY-MM-DD') || null,
        salary: values.salary != null ? values.salary : null,
        salary_currency: values.salary_currency || null,
        notes: values.notes || null,
      }),
    onSuccess: (res) => {
      message.success(t('deployment.createdOk'))
      setCreateOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['deployments-list'] })
      const created = res?.data
      if (created?.id) navigate(`/deployments/${created.id}`)
    },
    onError: (e) => message.error(e.response?.data?.error || t('deployment.createFailed')),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => deploymentApi.bulkRemove(ids),
    onSuccess: (res) => {
      const { deleted, failed } = res?.data || {}
      if (failed > 0) message.warning(`Đã xóa ${deleted}, thất bại ${failed}`)
      else message.success(`Đã xóa ${deleted} điều động`)
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['deployments-list'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  const handleBulkDelete = () => {
    Modal.confirm({
      title: `Xóa ${selectedRowKeys.length} điều động?`,
      content: 'Hành động này không thể hoàn tác.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => bulkDeleteMutation.mutate(selectedRowKeys),
    })
  }

  const statusSelectOptions = useMemo(
    () =>
      DEPLOYMENT_STATUS_KEYS.map((value) => ({
        value,
        label: t(`deployment.statusMap.${value}`),
      })),
    [t]
  )

  const columns = useMemo(
    () => [
      { title: 'Rank', dataIndex: 'rank_code', render: (v) => v || '-' },
      { title: t('common.seafarer'), dataIndex: 'seafarer_name', render: (v) => v || '-' },
      { title: t('common.vessel'), dataIndex: 'vessel_name', render: (v) => v || '-' },
      { title: t('common.joinDate'), dataIndex: 'join_date', render: (v) => fmt(v) },
      {
        title: t('common.source'),
        render: (_, r) =>
          r.job_id ? (
            <Tag color="blue">{t('deployment.jobTag', { id: r.job_id })}</Tag>
          ) : (
            <Tag color="purple">{t('common.manual')}</Tag>
          ),
      },
      {
        title: t('deployment.colStatus'),
        dataIndex: 'status',
        render: (v) => (
          <Tag color={STATUS_COLOR[v] || 'default'}>{t(`deployment.statusMap.${v}`) || v}</Tag>
        ),
      },
    ],
    [t]
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, width: isMobile ? '100%' : 'auto' }}>
          {t('deployment.title')}
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size={isMobile ? 'small' : 'middle'}
          style={{ width: isMobile ? '100%' : 'auto' }}
          onClick={() => setCreateOpen(true)}
        >
          {t('deployment.createManual')}
        </Button>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          border: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            width: '100%',
          }}
        >
          <Input
            allowClear
            placeholder={t('common.vessel')}
            style={{ width: '100%' }}
            value={vesselNameFilter}
            onChange={(e) => setVesselNameFilter(e.target.value)}
          />
          <Select
            allowClear
            showSearch
            placeholder="Rank"
            style={{ width: '100%' }}
            value={rankFilter}
            onChange={setRankFilter}
            options={(ranks || []).map((r) => ({ value: r.id, label: r.code }))}
            filterOption={(input, opt) =>
              (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Select
            allowClear
            showSearch
            filterOption={false}
            placeholder={t('deployment.placeholderSeafarer')}
            style={{ width: '100%' }}
            value={seafarerFilter}
            onSearch={setSeafarerSearch}
            onChange={setSeafarerFilter}
            options={(seafarers || []).map((s) => ({
              value: s.id,
              label: `${s.full_name} (${s.seafarer_code || t('common.notAvailable')})`,
            }))}
          />
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            placeholder={[t('common.joinDate') + ' từ', t('common.joinDate') + ' đến']}
            style={{ width: '100%' }}
            value={dateRange}
            onChange={(v) => setDateRange(v || [])}
          />
          <Select
            allowClear
            placeholder={t('deployment.filterStatus')}
            style={{ width: '100%' }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusSelectOptions}
          />
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
          <Checkbox checked={hideCancel} onChange={(e) => setHideCancel(e.target.checked)}>
            Ẩn hợp đồng đã hủy
          </Checkbox>
          <Button
            icon={<ClearOutlined />}
            disabled={
              !vesselNameFilter &&
              !rankFilter &&
              !seafarerFilter &&
              !dateRange.length &&
              !statusFilter &&
              hideCancel
            }
            onClick={() => {
              setVesselNameFilter('')
              setRankFilter(undefined)
              setSeafarerFilter(undefined)
              setDateRange([])
              setStatusFilter(undefined)
              setHideCancel(true)
            }}
          >
            {t('common.clearFilters')}
          </Button>
        </div>
      </div>

      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={bulkDeleteMutation.isPending}
            onClick={handleBulkDelete}
          >
            Xóa {selectedRowKeys.length} mục đã chọn
          </Button>
        </div>
      )}

      {isMobile ? (
        <div>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {displayData.map((r) => {
            const checked = selectedRowKeys.includes(r.id)
            return (
              <div
                key={r.id}
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  border: `1px solid ${checked ? '#1677ff' : '#f0f0f0'}`,
                  padding: '12px 14px',
                  marginBottom: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <Checkbox
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setSelectedRowKeys((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((k) => k !== r.id)
                    )
                  }}
                  style={{ marginTop: 2 }}
                />
                <div
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() => navigate(`/deployments/${r.id}`)}
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
                        {r.seafarer_name || '-'}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                        {r.rank_code || '-'} · {r.vessel_name || '-'}
                      </div>
                    </div>
                    <Tag color={STATUS_COLOR[r.status] || 'default'} style={{ margin: 0 }}>
                      {t(`deployment.statusMap.${r.status}`) || r.status}
                    </Tag>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#595959' }}>
                    {t('deployment.mobileJoin')}: {fmt(r.join_date)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {r.job_id ? (
                      <Tag color="blue">{t('deployment.jobTag', { id: r.job_id })}</Tag>
                    ) : (
                      <Tag color="purple">{t('common.manual')}</Tag>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={displayData}
          loading={isLoading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          onRow={(r) => ({
            onClick: () => navigate(`/deployments/${r.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      <Modal
        title={t('deployment.modalTitle')}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="vessel_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="seafarer_id" label={t('common.seafarer')} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              placeholder={t('deployment.searchSeafarer')}
              onSearch={setSeafarerSearch}
              options={(seafarers || []).map((s) => ({
                value: s.id,
                label: `${s.full_name} (${s.seafarer_code || t('common.notAvailable')})`,
              }))}
            />
          </Form.Item>
          <Form.Item label={t('deployment.vesselFromDb')}>
            <Select
              showSearch
              allowClear
              filterOption={(input, option) =>
                (option?.searchText || '').includes((input || '').toLowerCase())
              }
              placeholder={t('deployment.searchVessel')}
              onSearch={setVesselSearch}
              options={vesselOptions}
              onChange={(value, option) => {
                if (!value || !option) return
                form.setFieldsValue({
                  vessel_id: value,
                  vessel_name: option.vessel_name || null,
                  vessel_flag: option.vessel_flag || null,
                })
              }}
            />
          </Form.Item>
          <Form.Item name="vessel_name" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="vessel_flag" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="rank_id" label="Rank">
            <Select
              allowClear
              placeholder="Chọn rank"
              options={(ranks || []).map((r) => ({
                value: r.id,
                label: r.code,
              }))}
            />
          </Form.Item>
          <Form.Item name="join_date" label={t('common.joinDate')}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sign_off_date" label="Ngày rời tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Lương HĐ">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="salary" noStyle>
                <InputNumber
                  min={0}
                  precision={2}
                  placeholder="1200"
                  style={{ width: 'calc(100% - 90px)' }}
                />
              </Form.Item>
              <Form.Item name="salary_currency" noStyle initialValue="USD">
                <Select
                  style={{ width: 90 }}
                  options={[
                    { value: 'USD', label: 'USD' },
                    { value: 'VND', label: 'VND' },
                  ]}
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="notes" label={t('common.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                {t('common.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
