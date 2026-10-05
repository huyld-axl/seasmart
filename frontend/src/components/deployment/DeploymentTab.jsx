import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Drawer,
  Checkbox,
  Upload,
  Progress,
  Space,
  Descriptions,
  Tooltip,
  message,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { deploymentApi, lookupApi, vesselApi } from '../../api'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_LABEL = {
  collecting_docs: 'Thu giấy tờ',
  confirmed: 'Đã chốt tàu',
  pre_boarding: 'Chuẩn bị nhập tàu',
  onboard: 'Đang tàu',
  signed_off: 'Đã rời tàu',
}

const STATUS_COLOR = {
  collecting_docs: 'default',
  confirmed: 'blue',
  pre_boarding: 'orange',
  onboard: 'green',
  signed_off: 'default',
}

const STATUS_OPTIONS = [
  { value: 'collecting_docs', label: 'Thu giấy tờ' },
  { value: 'confirmed', label: 'Đã chốt tàu' },
  { value: 'pre_boarding', label: 'Chuẩn bị nhập tàu' },
  { value: 'onboard', label: 'Đang tàu' },
  { value: 'signed_off', label: 'Đã rời tàu' },
]

const DEFAULT_CERT_WARNING_MONTHS = 12

function parseDocDateFromNote(note) {
  if (!note) return null
  const match = String(note).match(/DOC_DATE=(\d{4}-\d{2}-\d{2})/)
  return match ? dayjs(match[1]) : null
}

const EXTERNAL_LINKS = {
  CHECK_ONLINE: 'https://qltv.dichvucong.vinamarine.gov.vn/webqltv/TraCuuDulieuTV.aspx',
  VAX_COVID: 'https://tiemchungcovid19.gov.vn/portal/search',
}

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')

function mergeDocDate(localVal, checklistVal) {
  return localVal !== undefined ? localVal : checklistVal
}

function toDateKey(v) {
  return v ? dayjs(v).format('YYYY-MM-DD') : ''
}

function rankLabel(row) {
  return row.rank_code || '-'
}

const sectionStyle = {
  background: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: 2,
  marginBottom: 16,
}
const sectionHeaderStyle = {
  padding: '10px 16px',
  borderBottom: '1px solid #D9D9D9',
  fontWeight: 600,
  fontSize: 13,
  color: '#003366',
  background: '#FAFAFA',
}

export default function DeploymentTab({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [vesselSearch, setVesselSearch] = useState('')
  const [form] = Form.useForm()

  const { data: deploymentsData, isLoading } = useQuery({
    queryKey: ['deployments', seafarerId],
    queryFn: () => deploymentApi.list(seafarerId).then((r) => r.data),
  })

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  const { data: vessels } = useQuery({
    queryKey: ['lookup-vessels', vesselSearch],
    queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data?.data || r.data || []),
    enabled: addOpen,
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      deploymentApi.create(seafarerId, {
        vessel_id: values.vessel_id || null,
        vessel_name: values.vessel_name || null,
        rank_id: values.rank_id || null,
        notes: values.notes || null,
        join_date: values.join_date?.format?.('YYYY-MM-DD') || undefined,
      }),
    onSuccess: () => {
      message.success('Tạo điều động thành công')
      setAddOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['deployments', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Tạo thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deploymentApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa điều động')
      queryClient.invalidateQueries({ queryKey: ['deployments', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete(row) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa điều động tàu "${row.vessel_name || '?'}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(row.id),
    })
  }

  const columns = [
    { title: 'Tên tàu', dataIndex: 'vessel_name', render: (v) => v || '-' },
    { title: 'Rank', key: 'rank', render: (_, r) => rankLabel(r) },
    { title: 'Loại tàu', dataIndex: 'vessel_type', render: (v) => v || '-' },
    { title: 'Cờ', dataIndex: 'vessel_flag', render: (v) => v || '-' },
    {
      title: 'GRT/DWT',
      key: 'grt_dwt',
      render: (_, r) => {
        const grt = r.vessel_grt ?? '-'
        const dwt = r.vessel_dwt ?? '-'
        return `${grt}/${dwt}`
      },
    },
    { title: 'Loại máy', dataIndex: 'vessel_engine_type', render: (v) => v || '-' },
    { title: 'Công suất (kW)', dataIndex: 'main_engine_kw', render: (v) => v ?? '-' },
    { title: 'Vùng', dataIndex: 'operating_area', render: (v) => v || '-' },
    { title: 'Ngày nhập tàu', dataIndex: 'join_date', render: (v) => fmt(v) },
    { title: 'Ngày rời tàu', dataIndex: 'sign_off_date', render: (v) => fmt(v) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] || v}</Tag>,
    },
    {
      title: '',
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => setDetailId(r.id)} />
          {r.status === 'collecting_docs' && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Tạo điều động mới
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={deploymentsData?.data || deploymentsData || []}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({ onClick: () => setDetailId(r.id), style: { cursor: 'pointer' } })}
      />

      {/* Modal tạo điều động */}
      <Modal
        title="Tạo điều động mới"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="vessel_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="vessel_name" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="Tên tàu">
            <Select
              showSearch
              allowClear
              filterOption={false}
              placeholder="Tìm và chọn tàu"
              onSearch={setVesselSearch}
              options={(vessels || []).map((v) => ({
                value: v.id,
                label: v.vessel_name,
              }))}
              onChange={(value, option) => {
                form.setFieldsValue({
                  vessel_id: value ?? null,
                  vessel_name: option?.label ?? null,
                })
              }}
            />
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
          <Form.Item name="join_date" label="Ngày nhập tàu (dự kiến)">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setAddOpen(false)
                  form.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Tạo
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer chi tiết */}
      {detailId && (
        <DeploymentDrawer
          deploymentId={detailId}
          seafarerId={seafarerId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}

function DeploymentDrawer({ deploymentId, seafarerId, onClose }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState(null)
  const [statusWarnings, setStatusWarnings] = useState([])
  const [certScope] = useState('all')
  const [localDocDates, setLocalDocDates] = useState({})
  const [form] = Form.useForm()

  const { data: dep, isLoading } = useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: async () => {
      const r = await deploymentApi.list(seafarerId)
      const list = r.data?.data || r.data || []
      return list.find((d) => d.id === deploymentId) || null
    },
  })

  const { data: checklistData, isLoading: clLoading } = useQuery({
    queryKey: ['deployment-checklist', deploymentId],
    queryFn: () =>
      deploymentApi.getChecklist(deploymentId).then((r) => r.data?.data || r.data || []),
  })

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
    enabled: editOpen,
  })

  const checklist = checklistData || []
  const checklistDocDates = {
    SYLY: parseDocDateFromNote(checklist.find((i) => i.item_key === 'SYLY')?.notes),
    CMND: parseDocDateFromNote(checklist.find((i) => i.item_key === 'CMND')?.notes),
    CAM_KET: parseDocDateFromNote(checklist.find((i) => i.item_key === 'CAM_KET')?.notes),
  }
  const selectedDocDates = {
    SYLY: mergeDocDate(localDocDates.SYLY, checklistDocDates.SYLY),
    CMND: mergeDocDate(localDocDates.CMND, checklistDocDates.CMND),
    CAM_KET: mergeDocDate(localDocDates.CAM_KET, checklistDocDates.CAM_KET),
  }
  const hasDocDateChange =
    toDateKey(selectedDocDates.SYLY) !== toDateKey(checklistDocDates.SYLY) ||
    toDateKey(selectedDocDates.CMND) !== toDateKey(checklistDocDates.CMND) ||
    toDateKey(selectedDocDates.CAM_KET) !== toDateKey(checklistDocDates.CAM_KET)

  const statusMutation = useMutation({
    mutationFn: (status) =>
      deploymentApi.changeStatus(deploymentId, status, {
        cert_scope: certScope,
        cert_warning_months: DEFAULT_CERT_WARNING_MONTHS,
        document_dates: {
          SYLY: selectedDocDates.SYLY ? selectedDocDates.SYLY.format('YYYY-MM-DD') : null,
          CMND: selectedDocDates.CMND ? selectedDocDates.CMND.format('YYYY-MM-DD') : null,
          CAM_KET: selectedDocDates.CAM_KET ? selectedDocDates.CAM_KET.format('YYYY-MM-DD') : null,
        },
      }),
    onSuccess: (res) => {
      setLocalDocDates({})
      message.success('Đã cập nhật trạng thái')
      const warnings = res?.data?.warnings || []
      setStatusWarnings(warnings)
      queryClient.invalidateQueries({ queryKey: ['deployments', seafarerId] })
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] })
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', deploymentId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: (values) =>
      deploymentApi.update(deploymentId, {
        vessel_id: values.vessel_id || null,
        vessel_name: values.vessel_name || null,
        rank_id: values.rank_id || null,
        notes: values.notes || null,
        join_date: values.join_date?.format?.('YYYY-MM-DD') ?? values.join_date,
        sign_off_date: values.sign_off_date?.format?.('YYYY-MM-DD') ?? values.sign_off_date,
      }),
    onSuccess: () => {
      message.success('Đã cập nhật')
      setEditOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['deployments', seafarerId] })
      queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const syncVesselMutation = useMutation({
    mutationFn: (imo) => vesselApi.fetchExternalByImo(imo, true),
    onSuccess: (res) => {
      const vessel = res?.data?.vessel
      if (!vessel) {
        message.error('Không lấy được thông tin tàu từ IMO')
        return
      }
      form.setFieldsValue({
        vessel_id: vessel.id,
        vessel_name: vessel.vessel_name || null,
      })
      message.success('Đã đồng bộ thông tin tàu')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Không thể lấy thông tin tàu'),
  })

  function handleSyncVesselForEdit() {
    const imo = String(form.getFieldValue('imo_number') || '').trim()
    if (!/^\d{7}$/.test(imo)) {
      message.error('IMO phải gồm đúng 7 chữ số')
      return
    }
    syncVesselMutation.mutate(imo)
  }

  const checklistMutation = useMutation({
    mutationFn: ({ key, is_checked }) =>
      deploymentApi.updateChecklistItem(deploymentId, key, is_checked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', deploymentId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lưu thất bại'),
  })

  const attachmentUploadMutation = useMutation({
    mutationFn: ({ key, file }) => deploymentApi.uploadChecklistAttachment(deploymentId, key, file),
    onSuccess: () => {
      message.success('Đã tải file đính kèm')
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', deploymentId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Tải file thất bại'),
  })

  const attachmentDeleteMutation = useMutation({
    mutationFn: (key) => deploymentApi.deleteChecklistAttachment(deploymentId, key),
    onSuccess: () => {
      message.success('Đã xóa file đính kèm')
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', deploymentId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa file thất bại'),
  })

  const checked = checklist.filter((i) => i.is_checked).length
  const pct = checklist.length > 0 ? Math.round((checked / checklist.length) * 100) : 0
  const isPreBoarding = dep?.status === 'pre_boarding'
  const effectiveStatus = targetStatus || dep?.status

  function openEdit() {
    if (!dep) return
    form.setFieldsValue({
      vessel_id: dep.vessel_id || null,
      imo_number: dep.vessel_imo_number || '',
      vessel_name: dep.vessel_name,
      rank_id: dep.rank_id,
      join_date: dep.join_date ? dayjs(dep.join_date) : null,
      sign_off_date: dep.sign_off_date ? dayjs(dep.sign_off_date) : null,
      notes: dep.notes,
    })
    setEditOpen(true)
  }

  return (
    <Drawer
      title="Chi tiết điều động"
      open
      onClose={onClose}
      width={560}
      extra={
        <Button icon={<EditOutlined />} size="small" onClick={openEdit}>
          Chỉnh sửa
        </Button>
      }
    >
      {isLoading || !dep ? null : (
        <>
          {/* Thông tin */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>Thông tin điều động</div>
            <div style={{ padding: 16 }}>
              <Descriptions
                column={1}
                size="small"
                bordered
                styles={{ label: { width: 140, background: '#fafafa' } }}
              >
                <Descriptions.Item label="Tên tàu">{dep.vessel_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Rank">{rankLabel(dep)}</Descriptions.Item>
                <Descriptions.Item label="Ngày nhập tàu">{fmt(dep.join_date)}</Descriptions.Item>
                <Descriptions.Item label="Ngày rời tàu">{fmt(dep.sign_off_date)}</Descriptions.Item>
                <Descriptions.Item label="Ghi chú">{dep.notes || '-'}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag color={STATUS_COLOR[dep.status]}>{STATUS_LABEL[dep.status]}</Tag>
                </Descriptions.Item>
              </Descriptions>
              {statusWarnings.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                    color: '#ad6800',
                    fontSize: 12,
                    padding: '6px 10px',
                    borderRadius: 2,
                  }}
                >
                  Cảnh báo: {statusWarnings.map((w) => w.message).join(' • ')}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    marginBottom: 10,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#8c8c8c' }}>Chọn trạng thái:</span>
                  <Select
                    size="small"
                    value={effectiveStatus}
                    style={{ width: 220 }}
                    onChange={setTargetStatus}
                    options={STATUS_OPTIONS}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <DatePicker
                    size="small"
                    placeholder="Ngày sơ yếu lý lịch"
                    format="DD/MM/YYYY"
                    style={{ width: 180 }}
                    value={selectedDocDates.SYLY}
                    onChange={(v) => setLocalDocDates((p) => ({ ...p, SYLY: v }))}
                  />
                  <DatePicker
                    size="small"
                    placeholder="Ngày CMND công chứng"
                    format="DD/MM/YYYY"
                    style={{ width: 220 }}
                    value={selectedDocDates.CMND}
                    onChange={(v) => setLocalDocDates((p) => ({ ...p, CMND: v }))}
                  />
                  <DatePicker
                    size="small"
                    placeholder="Ngày cam kết"
                    format="DD/MM/YYYY"
                    style={{ width: 180 }}
                    value={selectedDocDates.CAM_KET}
                    onChange={(v) => setLocalDocDates((p) => ({ ...p, CAM_KET: v }))}
                  />
                </div>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={statusMutation.isPending}
                  disabled={
                    !effectiveStatus || (effectiveStatus === dep.status && !hasDocDateChange)
                  }
                  onClick={() => statusMutation.mutate(effectiveStatus)}
                >
                  Cập nhật trạng thái
                </Button>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div style={sectionStyle}>
            <div
              style={{
                ...sectionHeaderStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Checklist giấy tờ</span>
              <span style={{ fontWeight: 400, fontSize: 12, color: '#666' }}>
                {checked}/{checklist.length} mục
              </span>
            </div>
            <div style={{ padding: '8px 16px' }}>
              <Progress
                percent={pct}
                size="small"
                status={pct === 100 ? 'success' : 'active'}
                style={{ marginBottom: 12 }}
              />
              {clLoading
                ? null
                : checklist.map((item) => {
                    const link = EXTERNAL_LINKS[item.item_key]
                    const warn = isPreBoarding && !item.is_checked
                    const attachmentUrl = item.attachment_url
                    const attachmentName = item.attachment_name
                    return (
                      <div
                        key={item.item_key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 0',
                          borderBottom: '1px solid #f0f0f0',
                          background: warn ? '#fff1f0' : 'transparent',
                        }}
                      >
                        <Checkbox
                          checked={!!item.is_checked}
                          onChange={(e) =>
                            checklistMutation.mutate({
                              key: item.item_key,
                              is_checked: e.target.checked,
                            })
                          }
                        />
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: item.is_checked ? '#999' : warn ? '#cf1322' : '#262626',
                            textDecoration: item.is_checked ? 'line-through' : 'none',
                          }}
                        >
                          {item.item_label}
                        </Text>
                        {link && (
                          <Tooltip title="Mở link kiểm tra">
                            <Button
                              type="link"
                              size="small"
                              icon={<LinkOutlined />}
                              href={link}
                              target="_blank"
                              style={{ padding: 0 }}
                            />
                          </Tooltip>
                        )}
                        {item.checked_at && (
                          <Text style={{ fontSize: 11, color: '#aaa' }}>
                            {fmt(item.checked_at)}
                          </Text>
                        )}
                        <Upload
                          showUploadList={false}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          customRequest={({ file, onSuccess, onError }) => {
                            attachmentUploadMutation.mutate(
                              { key: item.item_key, file },
                              {
                                onSuccess: () => onSuccess?.('ok'),
                                onError: (err) => onError?.(err),
                              }
                            )
                          }}
                        >
                          <Button size="small" icon={<UploadOutlined />}>
                            Tải file
                          </Button>
                        </Upload>
                        {attachmentUrl && (
                          <Button
                            size="small"
                            type="link"
                            icon={<DownloadOutlined />}
                            href={attachmentUrl}
                            target="_blank"
                          >
                            {attachmentName || 'Tải xuống'}
                          </Button>
                        )}
                        {attachmentUrl && (
                          <Button
                            size="small"
                            danger
                            onClick={() => attachmentDeleteMutation.mutate(item.item_key)}
                          >
                            Xóa file
                          </Button>
                        )}
                      </div>
                    )
                  })}
            </div>
          </div>
        </>
      )}

      {/* Modal chỉnh sửa */}
      <Modal
        title="Chỉnh sửa điều động"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <Form.Item name="vessel_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="imo_number"
            label="IMO Number"
            rules={[{ pattern: /^\d{7}$/, message: 'IMO phải gồm đúng 7 chữ số' }]}
          >
            <Input placeholder="VD: 9551052" maxLength={7} />
          </Form.Item>
          <Form.Item>
            <Button
              onClick={handleSyncVesselForEdit}
              loading={syncVesselMutation.isPending}
              type="dashed"
            >
              Lấy thông tin tàu
            </Button>
          </Form.Item>
          <Form.Item name="vessel_name" label="Tên tàu">
            <Input />
          </Form.Item>
          <Form.Item name="rank_id" label="Rank">
            <Select
              allowClear
              placeholder="Chọn rank"
              options={(ranks?.data || ranks || []).map((r) => ({
                value: r.id,
                label: r.code,
              }))}
            />
          </Form.Item>
          <Form.Item name="join_date" label="Ngày nhập tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sign_off_date" label="Ngày rời tàu">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setEditOpen(false)
                  form.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  )
}
