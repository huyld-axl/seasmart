import { useParams, Navigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  message,
  Tag,
  Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import VesselMasterDataPage from './master-data/VesselMasterDataPage'

// ── Generic CRUD hook ──────────────────────────────────────────────────────────
function useMasterData(resource) {
  const qc = useQueryClient()
  const key = ['master', resource]

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get(`/admin/master/${resource}?limit=500`).then((r) => r.data.data),
  })

  const create = useMutation({
    mutationFn: (body) => api.post(`/admin/master/${resource}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['lookup'] })
    },
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/admin/master/${resource}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['lookup'] })
    },
  })
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/master/${resource}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['lookup'] })
    },
  })

  return { data: data || [], isLoading, create, update, remove }
}

// ── Generic table + modal ──────────────────────────────────────────────────────
function MasterTable({
  resource,
  columns,
  formFields,
  title,
  pagination = { pageSize: 20, showSizeChanger: false },
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const { data, isLoading, create, update, remove } = useMasterData(resource)

  function openCreate() {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }
  function openEdit(row) {
    setEditing(row)
    form.setFieldsValue(row)
    setOpen(true)
  }

  async function handleOk() {
    try {
      const values = await form.validateFields()
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...values })
        message.success('Đã cập nhật')
      } else {
        await create.mutateAsync(values)
        message.success('Đã thêm mới')
      }
      setOpen(false)
    } catch (e) {
      if (e?.response?.data?.error) message.error(e.response.data.error)
    }
  }

  async function handleDelete(id) {
    try {
      await remove.mutateAsync(id)
      message.success('Đã xóa')
    } catch (e) {
      message.error(e?.response?.data?.error || 'Lỗi khi xóa')
    }
  }

  const actionCol = {
    title: '',
    width: 90,
    fixed: 'right',
    render: (_, row) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        <Popconfirm
          title="Xóa mục này?"
          onConfirm={() => handleDelete(row.id)}
          okText="Xóa"
          cancelText="Hủy"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  }

  return (
    <>
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#666' }}>{data.length} mục</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm {title}
        </Button>
      </div>
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data}
        columns={[...columns, actionCol]}
        pagination={pagination}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        open={open}
        title={editing ? `Sửa ${title}` : `Thêm ${title}`}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        confirmLoading={create.isPending || update.isPending}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {formFields}
        </Form>
      </Modal>
    </>
  )
}

// ── Tab components ─────────────────────────────────────────────────────────────

function CertificateTypeTab() {
  return (
    <MasterTable
      resource="certificate-types"
      title="chứng chỉ"
      pagination={false}
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 160 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
        {
          title: 'Hiệu lực (năm)',
          dataIndex: 'validity_years',
          width: 120,
          render: (v) => v ?? <Tag>Vĩnh viễn</Tag>,
        },
        {
          title: 'STCW',
          dataIndex: 'is_stcw',
          width: 70,
          render: (v) => (v ? <Tag color="blue">STCW</Tag> : null),
        },
        {
          title: (
            <Tooltip title="Số tháng còn lại trước khi hết hạn cần bắt đầu theo dõi/cảnh báo">
              Theo dõi (tháng)
            </Tooltip>
          ),
          dataIndex: 'warning_before_months',
          width: 130,
          render: (v) => (v != null ? `${v} tháng` : <span style={{ color: '#bbb' }}>—</span>),
        },
      ]}
      formFields={
        <>
          <Form.Item name="code" label="Mã" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_vi" label="Tên tiếng Việt" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Tên tiếng Anh">
            <Input />
          </Form.Item>
          <Form.Item name="issuing_authority" label="Cơ quan cấp">
            <Input />
          </Form.Item>
          <Form.Item name="validity_years" label="Hiệu lực (năm, để trống = vĩnh viễn)">
            <InputNumber min={1} max={99} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="warning_before_months"
            label={
              <Tooltip title="Số tháng trước hạn cần cảnh báo. VD: 12 = cảnh báo khi còn dưới 12 tháng (phù hợp giấy sức khỏe, chứng chỉ STCW yêu cầu còn hiệu lực khi lên tàu).">
                Theo dõi trước hạn (tháng)
              </Tooltip>
            }
          >
            <InputNumber
              min={1}
              max={120}
              style={{ width: '100%' }}
              placeholder="Để trống = không cảnh báo sớm"
            />
          </Form.Item>
          <Form.Item name="is_stcw" label="Loại STCW" initialValue={1}>
            <Select
              options={[
                { value: 1, label: 'STCW' },
                { value: 0, label: 'Không phải STCW' },
              ]}
            />
          </Form.Item>
        </>
      }
    />
  )
}

function CountryTab() {
  return (
    <MasterTable
      resource="countries"
      title="quốc gia"
      columns={[
        { title: 'Mã ISO', dataIndex: 'code', width: 80 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
      ]}
      formFields={
        <>
          <Form.Item name="code" label="Mã ISO (2 ký tự)" rules={[{ required: true, max: 2 }]}>
            <Input maxLength={2} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name_en" label="Tên tiếng Anh" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_vi" label="Tên tiếng Việt">
            <Input />
          </Form.Item>
        </>
      }
    />
  )
}

function RankTab() {
  return (
    <MasterTable
      resource="ranks"
      title="Rank"
      pagination={false}
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 120 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
        { title: 'Bộ phận', dataIndex: 'department', width: 100 },
      ]}
      formFields={
        <>
          <Form.Item name="code" label="Mã" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_vi" label="Tên tiếng Việt" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label="Tên tiếng Anh">
            <Input />
          </Form.Item>
          <Form.Item name="department" label="Bộ phận">
            <Select
              allowClear
              options={[
                { value: 'DECK', label: 'DECK' },
                { value: 'ENGINE', label: 'ENGINE' },
                { value: 'CATERING', label: 'CATERING' },
              ]}
            />
          </Form.Item>
        </>
      }
    />
  )
}

function PortTab() {
  const { data: countries } = useQuery({
    queryKey: ['lookup', 'countries'],
    queryFn: () => api.get('/lookup/countries').then((r) => r.data),
  })
  const countryOptions = (countries || []).map((c) => ({
    value: c.id,
    label: `${c.code} - ${c.name_vi}`,
  }))

  return (
    <MasterTable
      resource="ports"
      title="cảng"
      columns={[
        { title: 'UN/LOCODE', dataIndex: 'un_locode', width: 110 },
        { title: 'Tên cảng', dataIndex: 'name' },
        { title: 'Quốc gia', dataIndex: 'country_name', width: 140 },
      ]}
      formFields={
        <>
          <Form.Item name="un_locode" label="UN/LOCODE (5 ký tự)">
            <Input maxLength={5} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name" label="Tên cảng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country_id" label="Quốc gia" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={countryOptions}
              placeholder="Chọn quốc gia"
            />
          </Form.Item>
        </>
      }
    />
  )
}

// ── Route map ──────────────────────────────────────────────────────────────────

const TAB_MAP = {
  cert: { component: CertificateTypeTab, title: 'Chứng chỉ' },
  vessels: { component: VesselMasterDataPage, title: 'Danh sách tàu' },
  country: { component: CountryTab, title: 'Quốc gia' },
  port: { component: PortTab, title: 'Cảng biển' },
  rank: { component: RankTab, title: 'Rank' },
}

export default function MasterSubPage() {
  const { tab } = useParams()
  const entry = TAB_MAP[tab]

  if (!entry) return <Navigate to="/master-data/cert" replace />

  const Component = entry.component
  return (
    <div>
      <h2 style={{ marginBottom: 16, fontWeight: 600 }}>{entry.title}</h2>
      <Component />
    </div>
  )
}
