import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  InputNumber,
  Space,
  Tag,
  App,
  Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { vesselApi, lookupApi } from '../../api'

const { Title } = Typography

const STATUS_COLOR = {
  IN_SERVICE: 'green',
  LAID_UP: 'orange',
  SCRAPPED: 'red',
  UNDER_CONSTRUCTION: 'blue',
}
const STATUS_LABEL = {
  IN_SERVICE: 'Đang hoạt động',
  LAID_UP: 'Nằm bờ',
  SCRAPPED: 'Phá dỡ',
  UNDER_CONSTRUCTION: 'Đang đóng',
}

export default function VesselPage() {
  const queryClient = useQueryClient()
  const { modal, message } = App.useApp()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [imoSearchInput, setImoSearchInput] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVessel, setEditingVessel] = useState(null)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['vessels', { search, page }],
    queryFn: () =>
      vesselApi.list({ search: search || undefined, page, limit: 20 }).then((r) => r.data),
  })

  const { data: vesselTypes } = useQuery({
    queryKey: ['vessel-types-distinct'],
    queryFn: () => vesselApi.vesselTypes().then((r) => r.data),
  })

  const { data: countries } = useQuery({
    queryKey: ['countries-lookup'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values) => vesselApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] })
      setModalOpen(false)
      form.resetFields()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => vesselApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] })
      setModalOpen(false)
      setEditingVessel(null)
      form.resetFields()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => vesselApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vessels'] }),
  })

  const externalSearchMutation = useMutation({
    mutationFn: (imo) => vesselApi.fetchExternalByImo(imo, true),
    onSuccess: (res, imo) => {
      const vesselId = res?.data?.vessel?.id
      setSearch(imo)
      setSearchInput('')
      setPage(1)
      if (vesselId) {
        setSelectedRowKeys([vesselId])
      }
      queryClient.invalidateQueries({ queryKey: ['vessels'] })
      message.success('Đã đồng bộ tàu từ internet')
    },
  })

  function openCreate() {
    setEditingVessel(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditingVessel(row)
    form.setFieldsValue({
      vessel_name: row.vessel_name,
      imo_number: row.imo_number,
      mmsi: row.mmsi,
      call_sign: row.call_sign,
      vessel_name_prev: row.vessel_name_prev,
      vessel_type: row.vessel_type,
      flag_country: row.flag_country,
      gross_tonnage: row.gross_tonnage,
      deadweight: row.deadweight,
      year_built: row.year_built,
      classification_society: row.classification_society,
      technical_manager: row.technical_manager,
      commercial_manager: row.commercial_manager,
      ship_owner_name: row.ship_owner_name,
      ship_owner_code: row.ship_owner_code,
      status: row.status,
      notes: row.notes,
    })
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

  function handleSubmit(values) {
    if (editingVessel) {
      updateMutation.mutate({ id: editingVessel.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  function normalizeImoInput(value) {
    return String(value || '').trim()
  }

  function handleSearchImoInDb() {
    const imo = normalizeImoInput(imoSearchInput)
    if (!/^\d{7}$/.test(imo)) {
      message.warning('IMO phải gồm đúng 7 chữ số')
      return
    }
    setSelectedRowKeys([])
    setSearch(imo)
    setSearchInput('')
    setPage(1)
  }

  function handleSearchExternal() {
    const imo = normalizeImoInput(imoSearchInput)
    if (!/^\d{7}$/.test(imo)) {
      message.warning('IMO phải gồm đúng 7 chữ số')
      return
    }
    externalSearchMutation.mutate(imo)
  }

  function handleGeneralSearch() {
    setSelectedRowKeys([])
    setSearch(searchInput)
    setImoSearchInput('')
    setPage(1)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const columns = [
    { title: 'Tên tàu', dataIndex: 'vessel_name', sorter: false },
    { title: 'IMO', dataIndex: 'imo_number', render: (v) => v || '-' },
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
    { title: 'Năm đóng', dataIndex: 'year_built', render: (v) => v || '-' },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
        </Space>
      ),
    },
  ]

  const vesselTypeOptions = (vesselTypes || []).map((t) => ({ value: t, label: t }))
  const countryOptions = (countries || [])
    .map((c) => ({
      value: (c.name_vi || c.name_en || c.code || '').trim() || String(c.id),
      label: c.name_vi || c.name_en,
    }))
    .filter((o) => o.value)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Quản lý Tàu
        </Title>
        <Space>
          <Input
            placeholder="Tìm IMO (7 số)"
            prefix={<SearchOutlined />}
            value={imoSearchInput}
            onChange={(e) => setImoSearchInput(e.target.value.replace(/[^\d]/g, '').slice(0, 7))}
            onPressEnter={handleSearchImoInDb}
            style={{ width: 180 }}
          />
          <Button onClick={handleSearchImoInDb}>Tìm IMO</Button>
          <Button loading={externalSearchMutation.isPending} onClick={handleSearchExternal}>
            Tìm kiếm trên internet
          </Button>
          <Input
            placeholder="Tìm thông tin khác của tàu"
            prefix={<SearchOutlined />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={handleGeneralSearch}
            style={{ width: 240 }}
          />
          <Button onClick={handleGeneralSearch}>Tìm thông tin</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm tàu
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.data || []}
        loading={isLoading}
        rowSelection={{
          type: 'radio',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        onRow={(record) => ({
          onClick: () => setSelectedRowKeys([record.id]),
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

      <Modal
        title={editingVessel ? 'Chỉnh sửa tàu' : 'Thêm tàu mới'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingVessel(null)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="vessel_name" label="Tên tàu">
            <Input placeholder="Không bắt buộc" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
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
            <Form.Item name="call_sign" label="Hô hiệu (Call Sign)">
              <Input />
            </Form.Item>
            <Form.Item name="mmsi" label="MMSI">
              <Input />
            </Form.Item>
            <Form.Item name="year_built" label="Năm đóng">
              <InputNumber style={{ width: '100%' }} min={1900} max={2100} />
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
            <Form.Item name="gross_tonnage" label="Gross Tonnage (GRT)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="deadweight" label="Deadweight (DWT)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Form.Item name="classification_society" label="Đăng kiểm">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
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
              <Button type="primary" htmlType="submit" loading={isPending}>
                {editingVessel ? 'Lưu' : 'Thêm'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
