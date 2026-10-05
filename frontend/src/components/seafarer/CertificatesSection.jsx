import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AutoComplete,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { certificateApi, lookupApi } from '../../api'

import sparkleAiIcon from '../../assets/sparkle-ai.png'

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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

function Section({ title, children, extra }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <span>{title}</span>
        {extra}
      </div>
      <div>{children}</div>
    </div>
  )
}

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')

function certificateTypeDisplayName(row) {
  const en = row?.certificate_type_name_en?.trim?.()
  const vi = row?.certificate_type_name?.trim?.()
  return en || vi || '-'
}

function removeAccents(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .toLowerCase()
}

function detectLanguage(text) {
  return /[àáảãạăắặằẳẵâấậầẩẫèéẻẽẹêếệềểễìíỉĩịòóỏõọôốộồổỗơớợờởỡùúủũụưứựừửữỳýỷỹỵđ]/i.test(text)
    ? 'vi'
    : 'en'
}

function certExpiryStatus(expiryDate, warningMonths) {
  if (!expiryDate) return { color: 'default', label: '-' }
  const d = dayjs(expiryDate)
  if (d.isBefore(dayjs(), 'day')) return { color: 'red', label: 'Hết hạn' }
  const thresholdDays = warningMonths ? warningMonths * 30 : 30
  if (d.diff(dayjs(), 'day') <= thresholdDays) return { color: 'orange', label: 'Sắp hết hạn' }
  return { color: 'green', label: 'Còn hiệu lực' }
}

export default function CertificatesSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingCert, setEditingCert] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [certFile, setCertFile] = useState(null)
  const [editCertFile, setEditCertFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [certTypeSearch, setCertTypeSearch] = useState('')
  const [certTypeId, setCertTypeId] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [form] = Form.useForm()
  const [formEdit] = Form.useForm()

  const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  )

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', seafarerId],
    queryFn: () => certificateApi.list(seafarerId).then((r) => r.data),
    enabled: !!seafarerId,
  })

  const { data: certTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: () => lookupApi.certificateTypes().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: async (values) => {
      const isNewType = !certTypeId && certTypeSearch.trim()
      const payload = {
        certificate_type_id: certTypeId || undefined,
        certificate_type_name: isNewType ? certTypeSearch.trim() : undefined,
        certificate_number: values.certificate_number || undefined,
        issued_date: values.issued_date?.format?.('YYYY-MM-DD') || undefined,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || undefined,
        place_of_issue: values.place_of_issue || undefined,
        notes: values.notes || undefined,
      }
      if (!payload.certificate_type_id && !payload.certificate_type_name) {
        throw new Error('Vui lòng chọn hoặc nhập loại chứng chỉ')
      }
      const res = await certificateApi.create(seafarerId, payload)
      const cert = res.data
      if (certFile && cert?.id) {
        await certificateApi.upload(seafarerId, cert.id, certFile)
      }
      return cert
    },
    onSuccess: () => {
      message.success('Thêm chứng chỉ thành công')
      setAddOpen(false)
      form.resetFields()
      setCertFile(null)
      setCertTypeSearch('')
      setCertTypeId(null)
      queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
      queryClient.invalidateQueries({ queryKey: ['certificate-types'] })
    },
    onError: (e) =>
      message.error(e.message || e.response?.data?.error || 'Thêm chứng chỉ thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (certId) => certificateApi.remove(seafarerId, certId),
    onSuccess: () => {
      message.success('Đã xóa chứng chỉ')
      queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  const deleteFileMutation = useMutation({
    mutationFn: (certId) => certificateApi.removeFile(seafarerId, certId),
    onSuccess: (res) => {
      message.success('Đã xóa file đính kèm')
      setEditingCert(res.data)
      queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa file thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        certificate_type_id: values.certificate_type_id,
        certificate_number: values.certificate_number || undefined,
        issued_date: values.issued_date?.format?.('YYYY-MM-DD') || undefined,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || undefined,
        place_of_issue: values.place_of_issue || undefined,
        notes: values.notes || undefined,
      }
      const res = await certificateApi.update(seafarerId, editingCert.id, payload)
      if (editCertFile) {
        await certificateApi.upload(seafarerId, editingCert.id, editCertFile)
      }
      return res.data
    },
    onSuccess: () => {
      message.success('Cập nhật chứng chỉ thành công')
      setEditOpen(false)
      setEditingCert(null)
      setEditCertFile(null)
      formEdit.resetFields()
      queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật chứng chỉ thất bại'),
  })

  function openEditCert(row) {
    setEditingCert(row)
    formEdit.setFieldsValue({
      certificate_type_id: row.certificate_type_id,
      certificate_number: row.certificate_number,
      issued_date: row.issued_date ? dayjs(row.issued_date) : null,
      expiry_date: row.expiry_date ? dayjs(row.expiry_date) : null,
      place_of_issue: row.place_of_issue,
      notes: row.notes,
    })
    setEditOpen(true)
  }

  function buildFileUrl(url) {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    if (url.startsWith('/')) return `${apiOrigin}${url}`
    return `${apiOrigin}/${url}`
  }

  function getFileType(url, file) {
    const name = file?.name || url || ''
    if (file?.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image'
    if (file?.type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
    return 'other'
  }

  function openFilePreview(url, file) {
    const absoluteUrl = buildFileUrl(url)
    if (!absoluteUrl) return
    setPreviewFile({
      url: absoluteUrl,
      type: getFileType(url, file),
      name: file?.name || url?.split('/').pop() || 'file',
    })
  }

  const isCurrentFileImage = Boolean(editingCert?.document_url?.match(/\.(png|jpe?g)$/i))
  const isNewFileImage = Boolean(editCertFile?.type?.startsWith('image/'))
  const newPreviewUrl = isNewFileImage ? URL.createObjectURL(editCertFile) : null

  const certTypeOptions = useMemo(() => {
    const types = certTypes?.data || certTypes || []
    const seen = new Set()
    return types
      .filter((c) => {
        const name = c.name_en || c.name_vi || ''
        if (!name || seen.has(name)) return false
        seen.add(name)
        return true
      })
      .map((c) => ({
        value: c.name_en || c.name_vi || '',
        label: c.name_en || c.name_vi || '',
        id: c.id,
      }))
  }, [certTypes])

  async function handleExtract(file) {
    const f = file || certFile
    if (!f) return
    setExtracting(true)
    try {
      const res = await certificateApi.extract(seafarerId, f)
      const d = res.data
      const types = certTypes?.data || certTypes || []
      if (d.suggested_certificate_type_id) {
        const match = types.find((c) => c.id === d.suggested_certificate_type_id)
        if (match) {
          setCertTypeId(match.id)
          setCertTypeSearch(match.name_en || match.name_vi || '')
        }
      } else if (d.certificate_name) {
        setCertTypeId(null)
        setCertTypeSearch(d.certificate_name)
      }
      form.setFieldsValue({
        certificate_number: d.certificate_number ?? undefined,
        issued_date: d.issued_date ? dayjs(d.issued_date) : null,
        expiry_date: d.expiry_date ? dayjs(d.expiry_date) : null,
        notes:
          [
            d.competency_level ? `Cấp độ: ${d.competency_level}` : null,
            d.limitation ? `Hạn chế: ${d.limitation}` : null,
          ]
            .filter(Boolean)
            .join(' | ') || undefined,
      })
      message.success(
        d.seafarer_name
          ? `Đã trích xuất: ${d.seafarer_name}${d.certificate_name ? ' - ' + d.certificate_name : ''}`
          : 'Trích xuất thành công. Vui lòng kiểm tra lại thông tin.'
      )
    } catch {
      message.warning('Không thể trích xuất tự động. Vui lòng nhập thủ công.')
    } finally {
      setExtracting(false)
    }
  }

  const columns = [
    {
      title: 'Tên chứng chỉ',
      key: 'certificate_type_display',
      width: 220,
      render: (_, row) => {
        const v = certificateTypeDisplayName(row)
        if (v === '-') return '-'
        const text = v.length > 55 ? `${v.slice(0, 55)}…` : v
        return <span title={v}>{text}</span>
      },
    },
    {
      title: 'Số chứng chỉ',
      dataIndex: 'certificate_number',
      width: 140,
      render: (v) => (typeof v === 'string' ? v.trim() : v) || '-',
    },
    {
      title: 'Ngày cấp',
      dataIndex: 'issued_date',
      width: 100,
      render: (v) => fmt(v),
      sorter: (a, b) => {
        const da = a.issued_date ? dayjs(a.issued_date).valueOf() : Infinity
        const db = b.issued_date ? dayjs(b.issued_date).valueOf() : Infinity
        return da - db
      },
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expiry_date',
      width: 110,
      render: (v) => fmt(v) || '-',
      sorter: (a, b) => {
        const da = a.expiry_date ? dayjs(a.expiry_date).valueOf() : Infinity
        const db = b.expiry_date ? dayjs(b.expiry_date).valueOf() : Infinity
        return da - db
      },
      sortDirections: ['ascend', 'descend'],
    },
    { title: 'Nơi cấp', dataIndex: 'place_of_issue', width: 160, render: (v) => v || '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'expiry_date',
      key: 'cert_status',
      width: 120,
      render: (v, row) => {
        const s = certExpiryStatus(v, row.warning_before_months)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      width: 280,
      render: (v) => {
        if (!v) return '-'
        const text = v.length > 200 ? v.slice(0, 200) + '…' : v
        return (
          <div
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            title={v}
          >
            {text}
          </div>
        )
      },
    },
    {
      title: '',
      width: 110,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditCert(r)} />
          <Popconfirm
            title="Xóa chứng chỉ?"
            description={`Bạn có chắc muốn xóa "${certificateTypeDisplayName(r)}"?`}
            onConfirm={() => deleteMutation.mutate(r.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending && deleteMutation.variables === r.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Section
      title="Chứng chỉ"
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            setAddOpen(true)
            setFileInputKey((k) => k + 1)
          }}
        >
          Thêm chứng chỉ
        </Button>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data?.data || []}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: (data?.data || []).length > 10 ? 400 : undefined }}
      />

      <Modal
        title="Thêm chứng chỉ"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
          setCertFile(null)
          setCertTypeSearch('')
          setCertTypeId(null)
          setFileInputKey((k) => k + 1)
        }}
        maskClosable={false}
        footer={null}
        width="min(440px, 95vw)"
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item label="File chứng chỉ">
            <Input
              key={fileInputKey}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff,.gif"
              disabled={extracting}
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setCertFile(file)
              }}
            />
            <div style={{ marginTop: 8 }}>
              {extracting ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#1677ff',
                    fontWeight: 500,
                  }}
                >
                  <span>Đang đọc thông tin bằng AI...</span>
                  <Spin size="large" />
                </div>
              ) : (
                <Button
                  disabled={!certFile}
                  style={{
                    paddingLeft: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                  onClick={() => handleExtract()}
                >
                  <img
                    src={sparkleAiIcon}
                    alt=""
                    width={22}
                    height={22}
                    style={{ display: 'block' }}
                  />
                  Đọc thông tin bằng AI
                </Button>
              )}
            </div>
          </Form.Item>
          <Form.Item label="Loại chứng chỉ" required>
            <AutoComplete
              value={certTypeSearch}
              options={certTypeOptions}
              filterOption={(input, opt) =>
                removeAccents(opt?.label || '').includes(removeAccents(input))
              }
              onChange={(v) => {
                setCertTypeSearch(v)
                setCertTypeId(null)
              }}
              onSelect={(v, opt) => {
                setCertTypeSearch(v)
                setCertTypeId(opt.id)
              }}
              placeholder="Tìm hoặc nhập tên loại chứng chỉ..."
              style={{ width: '100%' }}
              disabled={extracting}
            />
            {certTypeSearch.trim() && !certTypeId && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <span style={{ color: '#888' }}>
                  Loại mới sẽ được tạo:{' '}
                  <b>
                    {certTypeSearch} (
                    {detectLanguage(certTypeSearch) === 'vi' ? 'tiếng Việt' : 'tiếng Anh'})
                  </b>
                </span>
                <br />
                <span style={{ color: '#fa8c16' }}>
                  Chứng chỉ này chưa có trong danh sách chuẩn - sẽ không tự điền vào CV tiếng Trung.
                </span>
              </div>
            )}
          </Form.Item>
          <Form.Item name="certificate_number" label="Số chứng chỉ">
            <Input disabled={extracting} />
          </Form.Item>
          <Form.Item name="issued_date" label="Ngày cấp">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={extracting} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Ngày hết hạn">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={extracting} />
          </Form.Item>
          <Form.Item name="place_of_issue" label="Nơi cấp">
            <Input disabled={extracting} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} disabled={extracting} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setAddOpen(false)} disabled={extracting}>
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
                disabled={extracting}
              >
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Sửa chứng chỉ"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setEditingCert(null)
          setEditCertFile(null)
          formEdit.resetFields()
        }}
        maskClosable={false}
        footer={null}
        width="min(520px, 95vw)"
      >
        <Form form={formEdit} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <Form.Item name="certificate_type_id" label="Loại chứng chỉ" rules={[{ required: true }]}>
            <Select
              placeholder="Chọn loại"
              showSearch
              filterOption={(input, opt) =>
                (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(certTypes?.data || certTypes || []).map((c) => ({
                value: c.id,
                label: c.name_en || c.name_vi,
              }))}
            />
          </Form.Item>
          <Form.Item name="certificate_number" label="Số chứng chỉ">
            <Input />
          </Form.Item>
          <Form.Item name="issued_date" label="Ngày cấp">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Ngày hết hạn">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="place_of_issue" label="Nơi cấp">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="File hiện tại">
            {editingCert?.document_url ? (
              <Space size={4}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => openFilePreview(editingCert.document_url)}
                >
                  Xem file hiện tại
                </Button>
                <Popconfirm
                  title="Xóa file đính kèm?"
                  description="File sẽ bị xóa vĩnh viễn, không thể khôi phục."
                  onConfirm={() => deleteFileMutation.mutate(editingCert.id)}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteFileMutation.isPending}
                  />
                </Popconfirm>
              </Space>
            ) : (
              '-'
            )}
          </Form.Item>
          {(isCurrentFileImage || isNewFileImage) && (
            <div style={{ marginBottom: 12 }}>
              <img
                src={newPreviewUrl || buildFileUrl(editingCert?.document_url)}
                alt="certificate-preview"
                style={{ maxWidth: '100%', maxHeight: 260, border: '1px solid #f0f0f0' }}
              />
            </div>
          )}
          <Form.Item label="Thay file đính kèm">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setEditCertFile(e.target.files?.[0] || null)}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setEditOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={previewFile?.name || 'Xem file'}
        open={Boolean(previewFile)}
        onCancel={() => setPreviewFile(null)}
        maskClosable={false}
        footer={null}
        width="min(900px, 95vw)"
      >
        {previewFile?.type === 'image' && (
          <img
            src={previewFile.url}
            alt={previewFile.name}
            style={{ maxWidth: '100%', maxHeight: '75vh', display: 'block', margin: '0 auto' }}
          />
        )}
        {previewFile?.type === 'pdf' && (
          <iframe
            src={previewFile.url}
            title={previewFile.name}
            style={{ width: '100%', height: '75vh', border: 'none' }}
          />
        )}
        {previewFile?.type === 'other' && (
          <div>
            Không hỗ trợ preview trực tiếp định dạng này.{' '}
            <a href={previewFile.url} target="_blank" rel="noreferrer">
              Mở file ở tab mới
            </a>
          </div>
        )}
      </Modal>
    </Section>
  )
}
