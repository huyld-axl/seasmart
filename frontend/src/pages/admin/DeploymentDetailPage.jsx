import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DollarOutlined,
  DownloadOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FileWordOutlined,
  LinkOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { deploymentApi, lookupApi } from '../../api'
import SalaryTab from '../../components/deployment/SalaryTab'
import useAuthStore from '../../stores/authStore'

const STATUS_LABEL = {
  collecting_docs: 'Thu giấy tờ',
  confirmed: 'Đã chốt tàu',
  pre_boarding: 'Chuẩn bị nhập tàu',
  onboard: 'Đang tàu',
  signed_off: 'Đã rời tàu',
  cancelled: 'Đã hủy',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))
const DEFAULT_CERT_WARNING_MONTHS = 12
const ATTACHMENT_NAME_MAX_CHARS = 28

const EXTERNAL_LINKS = {
  CHECK_ONLINE: 'https://qltv.dichvucong.vinamarine.gov.vn/webqltv/TraCuuDulieuTV.aspx',
  VAX_COVID: 'https://tiemchungcovid19.gov.vn/portal/search',
}

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')
const truncateText = (value, maxChars = ATTACHMENT_NAME_MAX_CHARS) =>
  value && value.length > maxChars ? `${value.slice(0, maxChars)}...` : value

function parseDocDateFromNote(note) {
  if (!note) return null
  const match = String(note).match(/DOC_DATE=(\d{4}-\d{2}-\d{2})/)
  return match ? dayjs(match[1]) : null
}

function toDateKey(v) {
  return v ? dayjs(v).format('YYYY-MM-DD') : ''
}

const DOCUMENT_TYPES = [
  {
    type: 'bb_giao_nhan',
    label: 'BB Giao Nhận Giấy Tờ TV',
    icon: <FileExcelOutlined style={{ color: '#52c41a' }} />,
  },
  {
    type: 'hop_dong_dan_su',
    label: 'Hợp Đồng Dân Sự',
    icon: <FileWordOutlined style={{ color: '#1677ff' }} />,
  },
  {
    type: 'hop_dong_mlc',
    label: 'Hợp Đồng MLC',
    icon: <FileWordOutlined style={{ color: '#1677ff' }} />,
  },
  {
    type: 'quyet_dinh_dieu_dong',
    label: 'Quyết Định Điều Động',
    icon: <FileWordOutlined style={{ color: '#1677ff' }} />,
  },
]

function DocumentsTab({ deploymentId, seafarerName }) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
  const token = localStorage.getItem('token')

  const handleDownload = async (type, filename) => {
    try {
      const res = await fetch(`${apiUrl}/deployments/${deploymentId}/documents/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Tải file thất bại')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      message.error(e.message || 'Tải file thất bại')
    }
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {seafarerName && (
        <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
          Thuyền viên: <strong>{seafarerName}</strong>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DOCUMENT_TYPES.map(({ type, label, icon }) => {
          const ext = type === 'bb_giao_nhan' ? 'xlsx' : type === 'hop_dong_mlc' ? 'doc' : 'docx'
          const nameSuffix = seafarerName ? ` - ${seafarerName}` : ''
          const filename = `${label}${nameSuffix}.${ext}`
          return (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                border: '1px solid #f0f0f0',
                borderRadius: 6,
              }}
            >
              {icon}
              <span style={{ flex: 1 }}>{label}</span>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(type, filename)}
              >
                Tải xuống
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Local override: undefined = chưa đụng (lấy checklist), null = user đã xóa ngày */
function mergeDocDate(localVal, checklistVal) {
  return localVal !== undefined ? localVal : checklistVal
}

export default function DeploymentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canDelete = ['admin', 'operator'].includes(user?.role)
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [targetStatus, setTargetStatus] = useState(null)
  const [statusWarnings, setStatusWarnings] = useState([])
  const [localDocDates, setLocalDocDates] = useState({})
  const [editOpen, setEditOpen] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [form] = Form.useForm()

  const { data: dep, isLoading } = useQuery({
    queryKey: ['deployment-detail', id],
    queryFn: () => deploymentApi.getById(id).then((r) => r.data),
  })

  const { data: checklistData } = useQuery({
    queryKey: ['deployment-checklist', id],
    queryFn: () => deploymentApi.getChecklist(id).then((r) => r.data?.data || []),
  })
  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data?.data || r.data || []),
    enabled: editOpen,
  })
  const { data: vessels } = useQuery({
    queryKey: ['deployment-vessels', vesselSearch],
    queryFn: () => lookupApi.vessels(vesselSearch).then((r) => r.data?.data || r.data || []),
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
      deploymentApi.changeStatus(id, status, {
        cert_scope: 'all',
        cert_warning_months: DEFAULT_CERT_WARNING_MONTHS,
        document_dates: {
          SYLY: selectedDocDates.SYLY ? selectedDocDates.SYLY.format('YYYY-MM-DD') : null,
          CMND: selectedDocDates.CMND ? selectedDocDates.CMND.format('YYYY-MM-DD') : null,
          CAM_KET: selectedDocDates.CAM_KET ? selectedDocDates.CAM_KET.format('YYYY-MM-DD') : null,
        },
      }),
    onSuccess: (res) => {
      setLocalDocDates({})
      setStatusWarnings(res?.data?.warnings || [])
      message.success('Đã cập nhật trạng thái')
      queryClient.invalidateQueries({ queryKey: ['deployment-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', id] })
      queryClient.invalidateQueries({ queryKey: ['deployments-list'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật trạng thái thất bại'),
  })

  const checklistMutation = useMutation({
    mutationFn: ({ key, is_checked }) => deploymentApi.updateChecklistItem(id, key, is_checked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deployment-checklist', id] }),
    onError: (e) => message.error(e.response?.data?.error || 'Lưu checklist thất bại'),
  })
  const attachmentUploadMutation = useMutation({
    mutationFn: ({ key, file }) => deploymentApi.uploadChecklistAttachment(id, key, file),
    onSuccess: () => {
      message.success('Đã tải file đính kèm')
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', id] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Tải file thất bại'),
  })
  const attachmentDeleteMutation = useMutation({
    mutationFn: (key) => deploymentApi.deleteChecklistAttachment(id, key),
    onSuccess: () => {
      message.success('Đã xóa file đính kèm')
      queryClient.invalidateQueries({ queryKey: ['deployment-checklist', id] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa file thất bại'),
  })
  const updateMutation = useMutation({
    mutationFn: (values) =>
      deploymentApi.update(id, {
        vessel_id: values.vessel_id || null,
        vessel_name: values.vessel_name || null,
        rank_id: values.rank_id || null,
        contract_start_date: values.contract_start_date?.format?.('YYYY-MM-DD') || null,
        contract_end_date: values.contract_end_date?.format?.('YYYY-MM-DD') || null,
        join_date: values.join_date?.format?.('YYYY-MM-DD') || null,
        sign_off_date: values.sign_off_date?.format?.('YYYY-MM-DD') || null,
        salary: values.salary != null ? values.salary : null,
        salary_currency: values.salary_currency || null,
        notes: values.notes || null,
      }),
    onSuccess: () => {
      message.success('Đã cập nhật thông tin điều động')
      setEditOpen(false)
      queryClient.invalidateQueries({ queryKey: ['deployment-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['deployments-list'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật điều động thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deploymentApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa điều động')
      queryClient.invalidateQueries({ queryKey: ['deployments-list'] })
      navigate('/deployments')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa điều động thất bại'),
  })

  const checked = checklist.filter((i) => i.is_checked).length
  const pct = checklist.length > 0 ? Math.round((checked / checklist.length) * 100) : 0

  if (isLoading || !dep) return null
  const selectedTargetStatus = targetStatus || dep.status

  return (
    <div style={{ padding: isMobile ? '8px 8px' : '0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/deployments')}>
          {isMobile ? null : 'Quay lại'}
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              form.setFieldsValue({
                vessel_id: dep.vessel_id || null,
                vessel_name: dep.vessel_name,
                rank_id: dep.rank_id,
                contract_start_date: dep.contract_start_date
                  ? dayjs(dep.contract_start_date)
                  : null,
                contract_end_date: dep.contract_end_date ? dayjs(dep.contract_end_date) : null,
                join_date: dep.join_date ? dayjs(dep.join_date) : null,
                sign_off_date: dep.sign_off_date ? dayjs(dep.sign_off_date) : null,
                salary: dep.salary != null ? parseFloat(dep.salary) : undefined,
                salary_currency: dep.salary_currency || 'USD',
                notes: dep.notes,
              })
              setEditOpen(true)
            }}
          >
            {isMobile ? null : 'Sửa thông tin'}
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() =>
              navigate('/deployments', {
                state: {
                  copyFrom: {
                    seafarer_id: dep.seafarer_id,
                    vessel_id: dep.vessel_id,
                    vessel_name: dep.vessel_name,
                    vessel_flag: dep.vessel_flag,
                    rank_id: dep.rank_id,
                    join_date: dep.join_date,
                    notes: dep.notes,
                  },
                },
              })
            }
          >
            {isMobile ? null : 'Copy tạo mới'}
          </Button>
          {canDelete && (
            <Popconfirm
              title="Xóa điều động này?"
              description={
                <span style={{ color: '#d4380d' }}>
                  Thao tác này không thể hoàn tác. Toàn bộ checklist và file đính kèm sẽ bị xóa vĩnh
                  viễn.
                </span>
              }
              okText="Xóa"
              okButtonProps={{ danger: true }}
              cancelText="Hủy"
              onConfirm={() => deleteMutation.mutate()}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                {isMobile ? null : 'Xóa'}
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #D9D9D9',
          borderRadius: 2,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #D9D9D9',
            fontWeight: 600,
            fontSize: 13,
            color: '#003366',
            background: '#FAFAFA',
          }}
        >
          Thông tin điều động #{dep.id}
        </div>
        <div style={{ padding: 16 }}>
          <Descriptions
            column={isMobile ? 1 : 2}
            bordered
            size="small"
            styles={{ label: { width: 140, background: '#fafafa' } }}
          >
            <Descriptions.Item label="Thuyền viên">
              {dep.seafarer_id ? (
                <a href={`/seafarers/${dep.seafarer_id}`} target="_blank" rel="noopener noreferrer">
                  {dep.seafarer_name || '-'}
                </a>
              ) : (
                dep.seafarer_name || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Tàu">
              {dep.vessel_id ? (
                <a href={`/vessels/${dep.vessel_id}`} target="_blank" rel="noopener noreferrer">
                  {dep.vessel_name || '-'}
                </a>
              ) : (
                dep.vessel_name || '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Rank">{dep.rank_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="Job">
              {dep.job_id ? (
                <a href={`/jobs/${dep.job_id}`} target="_blank" rel="noopener noreferrer">
                  #{dep.job_id}
                </a>
              ) : (
                'Thủ công'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày nhập tàu">{fmt(dep.join_date)}</Descriptions.Item>
            <Descriptions.Item label="Ngày rời tàu">{fmt(dep.sign_off_date)}</Descriptions.Item>
            <Descriptions.Item label="Lương HĐ" span={isMobile ? 1 : 2}>
              {dep.salary != null
                ? `${Number(dep.salary).toLocaleString('en-US')} ${dep.salary_currency || 'USD'}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú" span={isMobile ? 1 : 2}>
              {dep.notes || '-'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>

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

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          display: 'flex',
          gap: 8,
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap',
        }}
      >
        <Select
          value={selectedTargetStatus}
          onChange={setTargetStatus}
          options={STATUS_OPTIONS}
          style={{ width: isMobile ? '100%' : 220 }}
        />
        {isMobile ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DatePicker
              size="small"
              placeholder="Ngày sơ yếu lý lịch"
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              value={selectedDocDates.SYLY}
              onChange={(v) => setLocalDocDates((p) => ({ ...p, SYLY: v }))}
            />
            <DatePicker
              size="small"
              placeholder="Ngày CMND công chứng"
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              value={selectedDocDates.CMND}
              onChange={(v) => setLocalDocDates((p) => ({ ...p, CMND: v }))}
            />
            <DatePicker
              size="small"
              placeholder="Ngày cam kết"
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              value={selectedDocDates.CAM_KET}
              onChange={(v) => setLocalDocDates((p) => ({ ...p, CAM_KET: v }))}
            />
          </div>
        ) : (
          <>
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
          </>
        )}
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={statusMutation.isPending}
          disabled={
            !selectedTargetStatus || (selectedTargetStatus === dep.status && !hasDocDateChange)
          }
          onClick={() => statusMutation.mutate(selectedTargetStatus)}
          style={{ width: isMobile ? '100%' : undefined }}
        >
          Cập nhật trạng thái
        </Button>
      </div>

      <Tabs
        defaultActiveKey="salary"
        style={{ marginTop: 8 }}
        items={[
          {
            key: 'salary',
            label: (
              <span>
                <DollarOutlined /> Lương
              </span>
            ),
            children: <SalaryTab deployment={dep} />,
          },
          {
            key: 'checklist',
            label: (
              <span>
                <FileDoneOutlined /> Checklist
              </span>
            ),
            children: (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ marginRight: 8 }}>Checklist:</span>
                  <span>
                    {checked}/{checklist.length}
                  </span>
                </div>
                <Progress percent={pct} size="small" status={pct === 100 ? 'success' : 'active'} />
                <div style={{ marginTop: 12 }}>
                  {checklist.map((item) => {
                    const link = EXTERNAL_LINKS[item.item_key]
                    const attachmentUrl = item.attachment_url
                    const attachmentName = item.attachment_name
                    const uploadDate = item.updated_at || item.checked_at
                    return (
                      <div
                        key={item.item_key}
                        style={{
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Checkbox
                            checked={!!item.is_checked}
                            onChange={(e) =>
                              checklistMutation.mutate({
                                key: item.item_key,
                                is_checked: e.target.checked,
                              })
                            }
                          />
                          <span style={{ flex: 1, color: item.is_checked ? '#999' : '#262626' }}>
                            {item.item_label}
                          </span>
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
                          {!isMobile && (
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
                          )}
                        </div>
                        {(isMobile || attachmentUrl) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                              paddingLeft: 28,
                              marginTop: 4,
                              minWidth: 0,
                            }}
                          >
                            {isMobile && (
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
                            )}
                            {attachmentUrl && (
                              <>
                                <Tooltip title={attachmentName || 'Tải file'}>
                                  <Button
                                    type="link"
                                    size="small"
                                    href={attachmentUrl}
                                    target="_blank"
                                    style={{
                                      padding: 0,
                                      fontSize: 13,
                                      color: '#69b1ff',
                                      fontWeight: 500,
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        maxWidth: isMobile ? 160 : 320,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        verticalAlign: 'bottom',
                                      }}
                                    >
                                      {truncateText(attachmentName || 'Tải file')}
                                    </span>
                                  </Button>
                                </Tooltip>
                                {uploadDate && (
                                  <span style={{ fontSize: 11, color: '#aaa' }}>
                                    {fmt(uploadDate)}
                                  </span>
                                )}
                                <Button
                                  size="small"
                                  danger
                                  onClick={() => attachmentDeleteMutation.mutate(item.item_key)}
                                >
                                  Xóa file
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ),
          },
          {
            key: 'documents',
            label: (
              <span>
                <FileTextOutlined /> Văn bản
              </span>
            ),
            children: <DocumentsTab deploymentId={id} seafarerName={dep.seafarer_name} />,
          },
        ]}
      />

      <Modal
        title="Sửa thông tin điều động"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <Form.Item name="vessel_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="Tàu (từ DB vessel)">
            <Select
              showSearch
              allowClear
              filterOption={false}
              placeholder="Tìm và chọn tàu"
              onSearch={setVesselSearch}
              options={(vessels || []).map((v) => ({
                value: v.id,
                label: v.vessel_name,
                vessel_name: v.vessel_name,
              }))}
              onChange={(value, option) => {
                if (!value || !option) return
                form.setFieldsValue({
                  vessel_id: value,
                  vessel_name: option.vessel_name || null,
                })
              }}
            />
          </Form.Item>
          <Form.Item name="vessel_name" label="Tên tàu">
            <Input placeholder="Tự điền nếu tàu chưa có trong DB" />
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
          <Form.Item name="contract_start_date" hidden>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contract_end_date" hidden>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="join_date" label="Ngày nhập tàu">
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
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button onClick={() => setEditOpen(false)} style={{ marginRight: 8 }}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
              Lưu
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
