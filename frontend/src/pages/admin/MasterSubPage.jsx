import { flagEmoji, withFlag } from '../../utils/flag'
import { useParams, Navigate } from 'react-router-dom'
import { Children, cloneElement, isValidElement, useState } from 'react'
import { App, Table, Button, Form, Grid, Input, InputNumber, Select, Skeleton } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import SlidePanel from '../../components/ds/SlidePanel'
import useToast from '../../components/ds/useToast'
import { EmptyState } from '../../components/ds/Controls'
import RowActions from '../../components/ds/RowActions'
import ListFooter from '../../components/ds/ListFooter'
import useListSticky from '../../components/ds/useListSticky'
import { actionColumn } from '../../components/ds/actionColumn'
import { useCan } from '../../hooks/usePermission'
import ToggleRow from '../../components/ds/ToggleRow'
import changedLabel from './fleet/changedLabel'
import { CategoryTag } from '../../components/ds/CertificateTable'
import { CATEGORY } from './seafarers/certificateView'
import { lookupApi } from '../../api'
import './seafarers/SeafarerListPage.css'
import './seafarers/SeafarerForm.css'

const isBlank = (value) => value == null || value === ''
const sameValue = (a, b) => (isBlank(a) && isBlank(b)) || String(a) === String(b)

// Dòng trên mobile: tên làm dòng chính, mã và tên phụ làm dòng dưới.
function MobileRow({ row, resource }) {
  const rawName = row.name_vi || row.name || row.code
  const main = resource === 'countries' ? withFlag(row.code, rawName, row.flag_emoji) : rawName
  const sub = [row.code || row.un_locode, row.name_en || (row.country_name ? withFlag(row.country_code, row.country_name, row.country_flag_emoji) : null)].filter((v) => v && v !== main).join(' · ')
  return (
    <span className="ds-cell2">
      <span className="ds-cell2__main">{main}</span>
      {sub ? <span className="ds-cell2__sub">{sub}</span> : null}
    </span>
  )
}

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
      if (resource === 'countries') {
        qc.invalidateQueries({ queryKey: ['fleet'] })
        qc.invalidateQueries({ queryKey: ['master', 'ports'] })
        qc.invalidateQueries({ queryKey: ['vessel-match'] })
        qc.invalidateQueries({ queryKey: ['seafarer'] })
        qc.invalidateQueries({ queryKey: ['seafarers'] })
      }
    },
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/admin/master/${resource}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['lookup'] })
      if (resource === 'countries') {
        qc.invalidateQueries({ queryKey: ['fleet'] })
        qc.invalidateQueries({ queryKey: ['master', 'ports'] })
        qc.invalidateQueries({ queryKey: ['vessel-match'] })
        qc.invalidateQueries({ queryKey: ['seafarer'] })
        qc.invalidateQueries({ queryKey: ['seafarers'] })
      }
    },
  })
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/admin/master/${resource}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['lookup'] })
      if (resource === 'countries') {
        qc.invalidateQueries({ queryKey: ['fleet'] })
        qc.invalidateQueries({ queryKey: ['master', 'ports'] })
        qc.invalidateQueries({ queryKey: ['vessel-match'] })
        qc.invalidateQueries({ queryKey: ['seafarer'] })
        qc.invalidateQueries({ queryKey: ['seafarers'] })
      }
    },
  })

  return { data: data || [], isLoading, isError, refetch, create, update, remove }
}

// ── Bảng danh mục: khuôn danh sách của skill (bảng trong card, form trong panel trượt) ──────────
function MasterTable({ resource, columns, formFields, title }) {
  const can = useCan()
  const canEdit = can('catalog.update')
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const tableScroll = useListSticky()
  const [form] = Form.useForm()
  const [changed, setChanged] = useState(new Set())
  const isMobile = !Grid.useBreakpoint().md
  const toast = useToast()
  const { modal } = App.useApp()
  const { data, isLoading, isError, refetch, create, update, remove } = useMasterData(resource)
  const keyword = search.trim().toLowerCase()
  const rows = keyword
    ? data.filter((row) => Object.values(row).some((value) => typeof value === 'string' && value.toLowerCase().includes(keyword)))
    : data
  // Danh mục tải hết một lần; chia trang ngay trên trình duyệt.
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  function openPanel(row) {
    setEditing(row || {})
    setChanged(new Set())
    form.resetFields()
    if (row) form.setFieldsValue(row)
  }

  // Sửa: so từng trường với giá trị gốc để đánh dấu "Đã sửa" và bật nút lưu.
  function trackChanges() {
    if (!editing?.id) return
    const values = form.getFieldsValue()
    setChanged(new Set(Object.keys(values).filter((name) => !sameValue(values[name], editing[name]))))
  }

  async function submit({ addAnother = false } = {}) {
    let values
    try {
      values = await form.validateFields()
    } catch {
      form.scrollToField(form.getFieldsError().find((field) => field.errors.length)?.name, { block: 'center' })
      return
    }
    try {
      if (editing?.id) await update.mutateAsync({ id: editing.id, ...values })
      else await create.mutateAsync(values)
      toast.success(editing?.id ? `Đã lưu ${title}` : `Đã thêm ${title}`)
      if (addAnother) form.resetFields()
      else setEditing(null)
    } catch (error) {
      toast.error(editing?.id ? `Không lưu được ${title}` : `Không thêm được ${title}`, { description: error?.response?.data?.error || 'Thử lại sau ít phút.' })
    }
  }

  // Gắn chip "Đã sửa" và viền nhấn cho các trường đã đổi, không bắt từng tab tự làm.
  const fields = Children.map(isValidElement(formFields) ? formFields.props.children : formFields, (item) => {
    if (!isValidElement(item) || !item.props.name || !changed.has(item.props.name)) return item
    return cloneElement(item, {
      className: [item.props.className, 'sf-changed'].filter(Boolean).join(' '),
      ...(item.props.label ? { label: changedLabel(item.props.label, true) } : {}),
    })
  })

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
          toast.error(`Không xoá được ${title} "${name}"`, { description: error?.response?.data?.error || 'Thử lại sau ít phút.' })
        }
      },
    })
  }

  const actionCol = actionColumn((row) => <RowActions name={row.name_vi || row.name || row.code} onEdit={canEdit ? () => openPanel(row) : undefined} onDelete={can('catalog.delete') ? () => confirmDelete(row) : undefined} />)

  let body
  if (isError) {
    body = <EmptyState isError title={`Không tải được danh sách ${title}`} description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  } else if (isLoading) {
    body = <div className="crew-loading"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length) {
    body = keyword ? (
      <EmptyState title={`Không có ${title} nào khớp "${search}"`} action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
    ) : (
      <EmptyState title={`Chưa có ${title} nào`} action={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>Thêm {title}</Button> : undefined} />
    )
  } else {
    body = (
      <>
        {isMobile ? (
          <ul className="crew-list">
            {pageRows.map((row) => (
              <li key={row.id}>
                {canEdit ? (
                  <button type="button" className="crew-list__row" onClick={() => openPanel(row)}>
                    <MobileRow row={row} resource={resource} />
                  </button>
                ) : (
                  <span className="crew-list__row"><MobileRow row={row} resource={resource} /></span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Table
            rowKey="id"
            className="crew-table"
            dataSource={pageRows}
            columns={[...columns, actionCol]}
            pagination={false}
            scroll={tableScroll}
            onRow={(row) => (canEdit ? { onClick: () => openPanel(row), onKeyDown: (event) => event.key === 'Enter' && openPanel(row), tabIndex: 0 } : {})}
          />
        )}
        <ListFooter total={rows.length} page={page} pageSize={pageSize} unit={title} note={keyword ? `lọc từ ${data.length}` : null} onChange={(next, size) => { setPage(next); setPageSize(size) }} />
      </>
    )
  }

  return (
    <>
      <div className="ds-card ds-card--fixed">
        <div className="ds-toolbar">
          <Input className="ds-toolbar__search" allowClear prefix={<SearchOutlined />} placeholder={`Tìm ${title}`} aria-label={`Tìm ${title}`} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} />
          {canEdit ? (
            <span className="ds-toolbar__end">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>
                Thêm {title}
              </Button>
            </span>
          ) : null}
        </div>
        {body}
      </div>
      <SlidePanel
        open={!!editing}
        title={editing?.id ? `Sửa ${title}` : `Thêm ${title}`}
        description={editing?.id ? editing.name_vi || editing.name : null}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing?.id && changed.size > 0 ? <span style={{ marginRight: 'auto', color: 'var(--muted)' }}>{changed.size} thay đổi</span> : null}
            <Button onClick={() => setEditing(null)}>Huỷ</Button>
            {editing?.id ? (
              <Button type="primary" disabled={!changed.size} loading={update.isPending} onClick={() => submit()}>
                Lưu thay đổi
              </Button>
            ) : (
              <>
                <Button loading={create.isPending} onClick={() => submit({ addAnother: true })}>
                  Lưu & thêm khác
                </Button>
                <Button type="primary" loading={create.isPending} onClick={() => submit()}>
                  Thêm {title}
                </Button>
              </>
            )}
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={() => submit()} onValuesChange={trackChanges}>
          {fields}
        </Form>
      </SlidePanel>
    </>
  )
}

// ── Tab components ─────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = Object.entries(CATEGORY).map(([value, label]) => ({ value, label }))

// Loại giấy: nhóm theo loại giấy (Tuỳ thân, Chuyên môn, Huấn luyện STCW, Y tế, Khác); nước cấp là cột riêng, để trống nếu không gắn một nước.
function CertificateTypeTab() {
  const { data: countries = [] } = useQuery({ queryKey: ['lookup', 'countries'], queryFn: () => lookupApi.countries().then((r) => r.data?.data || r.data || []) })
  const countryName = (id) => countries.find((c) => c.id === id)?.name_vi || ''
  return (
    <MasterTable
      resource="certificate-types"
      title="chứng chỉ"
      columns={[
        { title: 'Mã', dataIndex: 'code', width: 160 },
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi' },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en' },
        {
          title: 'Nhóm',
          dataIndex: 'category',
          width: 220,
          render: (v, row) => <CategoryTag cert={{ category: CATEGORY[v] || CATEGORY.OTHER, categoryKey: CATEGORY[v] ? v : 'OTHER', country: countryName(row.issuing_country_id) }} />,
        },
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
          <Form.Item name="category" label="Nhóm" initialValue="OTHER" rules={[{ required: true }]}>
            <Select options={CATEGORY_OPTIONS} aria-label="Nhóm" />
          </Form.Item>
          <Form.Item name="issuing_country_id" label="Nước cấp (để trống nếu không gắn riêng một nước)">
            <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="Ví dụ: Panama" options={countries.map((c) => ({ value: c.id, label: c.name_vi || c.name_en }))} />
          </Form.Item>
          <Form.Item name="issuing_authority" label="Cơ quan cấp">
            <Input />
          </Form.Item>
          <Form.Item name="validity_years" label="Hiệu lực (năm, để trống = vĩnh viễn)">
            <InputNumber min={1} max={99} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_stcw" initialValue={1} normalize={(value) => (value ? 1 : 0)}>
            <ToggleRow label="Chứng chỉ STCW" />
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
        { title: 'Tên tiếng Việt', dataIndex: 'name_vi', render: (value, row) => withFlag(row.code, value || row.name_en, row.flag_emoji) },
        { title: 'Tên tiếng Anh', dataIndex: 'name_en', render: (value, row) => value ? withFlag(row.code, value, row.flag_emoji) : '—' },
      ]}
      formFields={
        <>
          <Form.Item name="code" label="Mã ISO (2 ký tự)" rules={[{ required: true, pattern: /^[A-Za-z]{2}$/, message: 'Nhập mã ISO gồm 2 chữ cái' }]}>
            <Input maxLength={2} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="flag_emoji" label="Cờ emoji" extra="Để trống để tự tạo cờ theo mã ISO. Nhập một emoji cờ để thay thế." rules={[{ validator: (_, value) => !value?.trim() || /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(value.trim()) ? Promise.resolve() : Promise.reject(new Error('Nhập một emoji cờ quốc gia, ví dụ 🇻🇳')) }]}>
            <Input placeholder="Ví dụ: 🇻🇳" maxLength={32} allowClear />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(before, after) => before.code !== after.code || before.flag_emoji !== after.flag_emoji}>
            {({ getFieldValue }) => <p>Cờ hiển thị: <span style={{ fontSize: 24 }}>{getFieldValue('flag_emoji')?.trim() || flagEmoji(getFieldValue('code')) || '—'}</span></p>}
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

function PortTab() {
  const { data: countries } = useQuery({
    queryKey: ['lookup', 'countries'],
    queryFn: () => api.get('/lookup/countries').then((r) => r.data),
  })
  const countryOptions = (countries || []).map((c) => ({
    value: c.id,
    label: withFlag(c.code, `${c.code} - ${c.name_vi || c.name_en}`, c.flag_emoji),
  }))

  return (
    <MasterTable
      resource="ports"
      title="cảng"
      columns={[
        { title: 'UN/LOCODE', dataIndex: 'un_locode', width: 110 },
        { title: 'Tên cảng', dataIndex: 'name' },
        { title: 'Quốc gia', dataIndex: 'country_name', width: 140, render: (value, row) => value ? withFlag(row.country_code, value, row.country_flag_emoji) : '—' },
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
              allowClear
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
  vessel: { component: VesselTypeTab, title: 'Loại tàu' },
  country: { component: CountryTab, title: 'Quốc gia' },
  contract: { component: ContractTypeTab, title: 'Loại hợp đồng' },
  port: { component: PortTab, title: 'Cảng biển' },
}

export default function MasterSubPage() {
  const { tab } = useParams()
  const entry = TAB_MAP[tab]

  if (tab === 'vessels') return <Navigate to="/vessels" replace />
  if (tab === 'ship-owners') return <Navigate to="/partners" replace />
  if (!entry) return <Navigate to="/master-data/cert" replace />

  const Component = entry.component
  return (
    <div className="ds-page">
      <Component key={tab} />
    </div>
  )
}
