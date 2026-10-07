import { useParams, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { App, Table, Button, Dropdown, Form, Input, InputNumber, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import SlidePanel from '../../components/ds/SlidePanel'
import useToast from '../../components/ds/useToast'
import { EmptyState } from '../../components/ds/Controls'
import { VesselTab, ShipOwnerTab } from './fleet/FleetTabs'

// ── Generic CRUD hook ──────────────────────────────────────────────────────────
function useMasterData(resource) {
  const qc = useQueryClient()
  const key = ['master', resource]

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    // API chỉ cho tối đa 100 dòng mỗi trang: tải lần lượt đến hết (danh mục chỉ vài trăm dòng)
    queryFn: async () => {
      const rows = []
      for (let page = 1; page <= 20; page += 1) {
        const { data } = await api.get(`/admin/master/${resource}`, { params: { limit: 100, page } })
        rows.push(...data.data)
        if (rows.length >= data.total || !data.data.length) break
      }
      return rows
    },
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

  return { data: data || [], isLoading, isError, refetch, create, update, remove }
}

// ── Bảng danh mục: khuôn danh sách của skill (bảng trong card, form trong panel trượt) ──────────
function MasterTable({ resource, columns, formFields, title }) {
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const toast = useToast()
  const { modal } = App.useApp()
  const { data, isLoading, isError, refetch, create, update, remove } = useMasterData(resource)
  const keyword = search.trim().toLowerCase()
  const rows = keyword
    ? data.filter((row) => Object.values(row).some((value) => typeof value === 'string' && value.toLowerCase().includes(keyword)))
    : data

  function openPanel(row) {
    setEditing(row || {})
    form.resetFields()
    if (row) form.setFieldsValue(row)
  }

  async function submit() {
    const values = await form.validateFields()
    try {
      if (editing?.id) await update.mutateAsync({ id: editing.id, ...values })
      else await create.mutateAsync(values)
      toast.success(editing?.id ? `Đã lưu ${title}` : `Đã thêm ${title}`)
      setEditing(null)
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không lưu được. Thử lại sau.')
    }
  }

  function confirmDelete(row) {
    const name = row.name_vi || row.name || row.code
    modal.confirm({
      title: `Xoá ${title} "${name}"?`,
      content: 'Mục này bị xoá hẳn, không hoàn tác được. Hồ sơ đang dùng mục này sẽ không còn hiện tên.',
      okText: `Xoá ${title}`,
      okButtonProps: { danger: true },
      cancelText: 'Huỷ',
      autoFocusButton: 'cancel',
      onOk: async () => {
        try {
          await remove.mutateAsync(row.id)
          toast.success(`Đã xoá ${title} "${name}"`)
        } catch (error) {
          toast.error(error?.response?.data?.error || 'Không xoá được')
        }
      },
    })
  }

  const actionCol = {
    title: <span className="ds-sr-only">Thao tác</span>,
    key: 'actions',
    width: 56,
    align: 'right',
    render: (_, row) => (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true },
          ],
          onClick: ({ key }) => (key === 'edit' ? openPanel(row) : confirmDelete(row)),
        }}
      >
        <Button type="text" icon={<MoreOutlined />} aria-label="Thao tác" />
      </Dropdown>
    ),
  }

  let body
  if (isError) {
    body = <EmptyState isError title={`Không tải được danh sách ${title}`} description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  } else if (!isLoading && !rows.length) {
    body = keyword ? (
      <EmptyState title={`Không có ${title} nào khớp "${search}"`} action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
    ) : (
      <EmptyState title={`Chưa có ${title} nào`} action={<Button icon={<PlusOutlined />} onClick={() => openPanel(null)}>Thêm {title}</Button>} />
    )
  } else {
    body = (
      <>
        <Table rowKey="id" loading={isLoading} dataSource={rows} columns={[...columns, actionCol]} pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false, size: 'small' } : false} scroll={{ x: 'max-content' }} onRow={(row) => ({ onDoubleClick: () => openPanel(row) })} />
        <div className="ds-table-foot">
          <span className="ds-num">{keyword ? `${rows.length} / ${data.length}` : data.length} {title}</span>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="ds-toolbar">
        <Input className="ds-toolbar__search" allowClear prefix={<SearchOutlined />} placeholder={`Tìm ${title}`} aria-label={`Tìm ${title}`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <span className="ds-toolbar__end">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>
            Thêm {title}
          </Button>
        </span>
      </div>
      <div className="ds-card">{body}</div>
      <SlidePanel
        open={!!editing}
        title={editing?.id ? `Sửa ${title}` : `Thêm ${title}`}
        description={editing?.id ? editing.name_vi || editing.name : null}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Huỷ</Button>
            <Button type="primary" loading={create.isPending || update.isPending} onClick={submit}>
              {editing?.id ? 'Lưu' : `Thêm ${title}`}
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          {formFields}
        </Form>
      </SlidePanel>
    </>
  )
}

// ── Tab components ─────────────────────────────────────────────────────────────

function CertificateTypeTab() {
  return (
    <MasterTable
      resource="certificate-types"
      title="chứng chỉ"
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 160 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
        {
          title: 'Hiệu lực (năm)',
          dataIndex: 'validity_years',
          width: 120,
          render: (v) => v ?? <span className="ds-role">Vĩnh viễn</span>,
        },
        {
          title: 'STCW',
          dataIndex: 'is_stcw',
          width: 70,
          render: (v) => (v ? <span className="ds-role">STCW</span> : null),
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

function VesselTypeTab() {
  return (
    <MasterTable
      resource="vessel-types"
      title="loại tàu"
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 160 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
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

function ContractTypeTab() {
  return (
    <MasterTable
      resource="contract-types"
      title="loại hợp đồng"
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 140 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
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
        </>
      }
    />
  )
}

function CourseTypeTab() {
  const { data: certTypes } = useQuery({
    queryKey: ['lookup', 'certificate-types'],
    queryFn: () => api.get('/lookup/certificate-types').then((r) => r.data),
  })
  const certOptions = (certTypes || []).map((c) => ({
    value: c.id,
    label: `${c.code} - ${c.name_vi}`,
  }))

  return (
    <MasterTable
      resource="course-types"
      title="loại khóa học"
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 180 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Số ngày', dataIndex: 'duration_days', width: 90 },
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
          <Form.Item name="certificate_type_id" label="Chứng chỉ liên kết">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={certOptions}
              placeholder="Chọn chứng chỉ"
            />
          </Form.Item>
          <Form.Item name="duration_days" label="Số ngày học">
            <InputNumber min={1} style={{ width: '100%' }} />
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
  vessels: { component: VesselTab, title: 'Tàu', description: 'Danh mục tàu dùng khi đối chiếu sea service. IMO được kiểm số kiểm tra.' },
  'ship-owners': { component: ShipOwnerTab, title: 'Chủ tàu', description: 'Chủ tàu và người liên hệ của từng chủ tàu.' },
  cert: { component: CertificateTypeTab, title: 'Chứng chỉ' },
  vessel: { component: VesselTypeTab, title: 'Loại tàu' },
  country: { component: CountryTab, title: 'Quốc gia' },
  contract: { component: ContractTypeTab, title: 'Loại hợp đồng' },
  course: { component: CourseTypeTab, title: 'Loại khóa học' },
  port: { component: PortTab, title: 'Cảng biển' },
}

export default function MasterSubPage() {
  const { tab } = useParams()
  const entry = TAB_MAP[tab]

  if (!entry) return <Navigate to="/master-data/vessels" replace />

  const Component = entry.component
  return (
    <div className="ds-page">
      <div className="ds-page__head">
        <div>
          <h1 className="ds-page__title">{entry.title}</h1>
          {entry.description ? <p className="ds-page__desc">{entry.description}</p> : null}
        </div>
      </div>
      <Component key={tab} />
    </div>
  )
}
