import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Input,
  InputNumber,
  Modal,
  Form,
  Select,
  Space,
  Tag,
  Switch,
  App,
  Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { vesselApi, lookupApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'
import useVesselFilterStore from '../../../stores/vesselFilterStore'

const VESSEL_STATUS_COLOR = {
  IN_SERVICE: 'green',
  LAID_UP: 'orange',
  SCRAPPED: 'red',
  UNDER_CONSTRUCTION: 'blue',
}
const VESSEL_STATUS_LABEL = {
  IN_SERVICE: 'Đang hoạt động',
  LAID_UP: 'Nằm bờ',
  SCRAPPED: 'Phá dỡ',
  UNDER_CONSTRUCTION: 'Đang đóng',
}

export default function VesselMasterDataPage() {
  const queryClient = useQueryClient()
  const { message, modal } = App.useApp()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isReadOnly = !['admin', 'operator'].includes(user?.role)

  const {
    vesselNameInput,
    setVesselNameInput,
    ownerInput,
    setOwnerInput,
    vesselTypeFilter,
    setVesselTypeFilter,
    flagFilter,
    setFlagFilter,
    statusFilter,
    setStatusFilter,
    filters,
    setFilters,
    page,
    setPage,
    catalogRows,
    setCatalogRows,
    reset: resetFilters,
  } = useVesselFilterStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  // catalog results (chỉ hiện khi search tên tàu)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [addingImo, setAddingImo] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['master-vessels', { filters, page }],
    queryFn: () => vesselApi.list({ ...filters, page, limit: 20 }).then((r) => r.data),
  })

  const { data: vesselTypes } = useQuery({
    queryKey: ['vessel-types-from-db'],
    queryFn: () => vesselApi.vesselTypes().then((r) => r.data),
  })

  const { data: countries } = useQuery({
    queryKey: ['countries-lookup'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values) => vesselApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-vessels'] })
      setModalOpen(false)
      form.resetFields()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => vesselApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-vessels'] }),
  })

  async function handleApplyFilters() {
    const f = {}
    if (vesselNameInput.trim()) f.search = vesselNameInput.trim()
    if (ownerInput.trim()) f.ship_owner_name = ownerInput.trim()
    if (vesselTypeFilter) f.vessel_type = vesselTypeFilter
    if (flagFilter) f.flag_country = flagFilter
    if (statusFilter) f.status = statusFilter
    setFilters(f)
    setPage(1)

    // tìm thêm trong catalog nếu có tên tàu
    if (vesselNameInput.trim().length >= 2) {
      setCatalogLoading(true)
      setCatalogRows([])
      try {
        const res = await vesselApi.nameSearch(vesselNameInput.trim())
        const catalogOnly = (res.data || []).filter((r) => !r.vessel_id)
        setCatalogRows(catalogOnly)
      } catch {
        setCatalogRows([])
      } finally {
        setCatalogLoading(false)
      }
    } else {
      setCatalogRows([])
      setCatalogLoading(false)
    }
  }

  function handleResetFilters() {
    resetFilters()
    setCatalogLoading(false)
  }

  async function handleAddFromCatalog(row) {
    if (!row.imo_no || !/^\d{7}$/.test(String(row.imo_no))) return
    const imo = String(row.imo_no)
    setAddingImo(row.imo_no)
    try {
      let vesselId
      try {
        // fetch đầy đủ data từ external API và lưu vào DB
        const res = await vesselApi.fetchExternalByImo(imo)
        vesselId = res.data?.vessel?.id
      } catch (extErr) {
        if (extErr?.response?.status === 429) {
          // tàu đã tồn tại và vừa được sync - chỉ cần navigate
          const list = await vesselApi.list({ search: imo, limit: 1 })
          vesselId = list.data?.data?.[0]?.id
        } else {
          // external API không khả dụng - fallback tạo tối giản
          try {
            const res = await vesselApi.create({ vessel_name: row.ship_name, imo_number: imo })
            vesselId = res.data?.id
          } catch (createErr) {
            if (createErr?.response?.status === 409) {
              const list = await vesselApi.list({ search: imo, limit: 1 })
              vesselId = list.data?.data?.[0]?.id
            } else throw createErr
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['master-vessels'] })
      if (vesselId) navigate(`/partners/vessels/${vesselId}`)
    } catch {
      message.error('Không thể thêm tàu')
    } finally {
      setAddingImo(null)
    }
  }

  function openCreate() {
    form.resetFields()
    setModalOpen(true)
  }

  function handleDelete(row) {
    modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa tàu "${row.vessel_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(row.id),
    })
  }

  const vesselTypeOptions = (vesselTypes || []).map((t) => ({ value: t, label: t }))
  const countryOptions = (countries || [])
    .map((c) => ({
      value: (c.name_vi || c.name_en || c.code || '').trim() || String(c.id),
      label: c.name_vi || c.name_en,
    }))
    .filter((o) => o.value)

  const columns = [
    { title: 'IMO', dataIndex: 'imo_number', render: (v) => v || '-' },
    { title: 'Tên tàu', dataIndex: 'vessel_name' },
    { title: 'Chủ tàu', dataIndex: 'ship_owner_name', render: (v) => v || '-' },
    { title: 'Loại tàu', dataIndex: 'vessel_type_name', render: (v) => v || '-' },
    { title: 'Cờ', dataIndex: 'flag_country_name', render: (v) => v || '-' },
    {
      title: 'GRT',
      dataIndex: 'gross_tonnage',
      render: (v) => (v != null ? Number(v).toLocaleString() : '-'),
    },
    {
      title: 'DWT',
      dataIndex: 'deadweight',
      render: (v) => (v != null ? Number(v).toLocaleString() : '-'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v) => (
        <Tag color={VESSEL_STATUS_COLOR[v] || 'default'}>{VESSEL_STATUS_LABEL[v] || v}</Tag>
      ),
    },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/partners/vessels/${r.id}`)
            }}
          >
            Chi tiết
          </Button>
          {!isReadOnly && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(r)
              }}
            />
          )}
        </Space>
      ),
    },
  ]

  const catalogColumns = [
    { title: 'IMO', dataIndex: 'imo_no', render: (v) => v || '-' },
    { title: 'Tên tàu', dataIndex: 'ship_name' },
    { title: 'Loại tàu', dataIndex: 'ship_type', render: (v) => v || '-' },
    { title: 'Quốc gia', dataIndex: 'country_name', render: (v) => v || '-' },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          ghost
          loading={addingImo === r.imo_no}
          onClick={() => handleAddFromCatalog(r)}
        >
          Thêm vào hệ thống
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#999', fontSize: 13 }}>{data?.total || 0} tàu</span>
        {!isReadOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm tàu
          </Button>
        )}
      </div>

      {/* filter panel */}
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          border: '1px solid #f0f0f0',
        }}
      >
        <Space wrap>
          <Input
            placeholder="Tên tàu / IMO"
            style={{ width: 200, height: 32, borderRadius: 6 }}
            value={vesselNameInput}
            onChange={(e) => setVesselNameInput(e.target.value)}
            onPressEnter={handleApplyFilters}
            allowClear
            onClear={() => {
              setVesselNameInput('')
              setCatalogRows([])
            }}
          />
          <Input
            placeholder="Chủ tàu"
            style={{ width: 160, height: 32, borderRadius: 6 }}
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
            onPressEnter={handleApplyFilters}
            allowClear
            onClear={() => setOwnerInput('')}
          />
          <Select
            placeholder="Loại tàu"
            style={{ width: 140 }}
            value={vesselTypeFilter}
            onChange={(v) => setVesselTypeFilter(v)}
            options={vesselTypeOptions}
            allowClear
            showSearch
            filterOption={(input, opt) =>
              (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Select
            placeholder="Cờ"
            style={{ width: 140 }}
            value={flagFilter}
            onChange={(v) => setFlagFilter(v)}
            options={countryOptions}
            allowClear
            showSearch
            filterOption={(input, opt) =>
              (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Select
            placeholder="Trạng thái"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { value: 'IN_SERVICE', label: 'Đang hoạt động' },
              { value: 'LAID_UP', label: 'Nằm bờ' },
              { value: 'UNDER_CONSTRUCTION', label: 'Đang đóng' },
              { value: 'SCRAPPED', label: 'Phá dỡ' },
            ]}
            allowClear
          />
          <Button type="primary" onClick={handleApplyFilters}>
            Tìm
          </Button>
          <Button onClick={handleResetFilters}>Reset</Button>
        </Space>
      </div>

      {/* vessel table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.data || []}
        loading={isLoading}
        onRow={(record) => ({
          onClick: () => navigate(`/partners/vessels/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: (p) => setPage(p),
          showTotal: (t) => `${t} tàu`,
        }}
      />

      {/* catalog results */}
      {(catalogLoading || catalogRows.length > 0) && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>
            {catalogLoading
              ? 'Đang tìm trong Ship Catalog...'
              : `Kết quả từ Ship Catalog - ${catalogRows.length} tàu chưa có trong hệ thống`}
          </div>
          <Table
            rowKey="imo_no"
            columns={catalogColumns}
            dataSource={catalogRows}
            loading={catalogLoading}
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      {/* add modal */}
      <Modal
        title="Thêm tàu mới"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item
            name="imo_number"
            label="Số IMO"
            rules={[
              { required: true, message: 'Nhập số IMO' },
              { pattern: /^\d{7}$/, message: 'IMO phải gồm đúng 7 chữ số' },
            ]}
          >
            <Input placeholder="Ví dụ: 9551052" />
          </Form.Item>
          <Form.Item name="vessel_name" label="Tên tàu">
            <Input placeholder="Không bắt buộc" />
          </Form.Item>
          <Form.Item name="ship_owner_name" label="Chủ tàu">
            <Input />
          </Form.Item>
          <Form.Item name="ship_owner_code" label="Mã chủ tàu">
            <Input />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="year_built" label="Năm đóng">
              <Input type="number" placeholder="2005" />
            </Form.Item>
            <Form.Item name="vessel_type" label="Loại tàu">
              <Select options={vesselTypeOptions} allowClear placeholder="Chọn loại" />
            </Form.Item>
            <Form.Item name="flag_country" label="Cờ quốc gia">
              <Select
                options={countryOptions}
                allowClear
                showSearch
                placeholder="Chọn quốc gia"
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item name="gross_tonnage" label="GRT">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="deadweight" label="DWT">
              <Input type="number" />
            </Form.Item>
          </div>

          <Form.Item name="status" label="Trạng thái tàu">
            <Select
              options={[
                { value: 'IN_SERVICE', label: 'Đang hoạt động' },
                { value: 'LAID_UP', label: 'Nằm bờ' },
                { value: 'UNDER_CONSTRUCTION', label: 'Đang đóng' },
                { value: 'SCRAPPED', label: 'Phá dỡ' },
              ]}
              defaultValue="IN_SERVICE"
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>Thông tin kỹ thuật</Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="engine_power_kw" label="Công suất máy (kW)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="engine_type" label="Loại động cơ">
              <Input placeholder="Diesel / Steam / Gas Turbine" />
            </Form.Item>
            <Form.Item name="dp_class" label="DP Class">
              <Select
                allowClear
                placeholder="Không có DP"
                options={[
                  { value: 'DPS-1', label: 'DPS-1' },
                  { value: 'DPS-2', label: 'DPS-2' },
                  { value: 'DPS-3', label: 'DPS-3' },
                ]}
              />
            </Form.Item>
            <Form.Item name="class_status" label="Trạng thái đăng kiểm">
              <Select
                allowClear
                options={[
                  { value: 'CLASSED', label: 'Còn class' },
                  { value: 'SUSPENDED', label: 'Tạm dừng' },
                  { value: 'WITHDRAWN', label: 'Rút đăng kiểm' },
                  { value: 'NOT_CLASSED', label: 'Không đăng kiểm' },
                ]}
              />
            </Form.Item>
            <Form.Item name="passenger_capacity" label="Sức chứa hành khách">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="crew_capacity" label="Định biên thuyền viên">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Space size="large" style={{ marginBottom: 12 }}>
            <Form.Item
              name="has_boiler"
              label="Nồi hơi"
              valuePropName="checked"
              style={{ margin: 0 }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="has_refrigeration"
              label="Lạnh / Refrigeration"
              valuePropName="checked"
              style={{ margin: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setModalOpen(false)
                  form.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
