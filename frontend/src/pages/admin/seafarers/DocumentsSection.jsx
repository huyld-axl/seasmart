import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Form, Input, Select, Checkbox, DatePicker, Space, Dropdown, Skeleton } from 'antd'
import { PlusOutlined, DeleteOutlined, DownOutlined, ScanOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi, certificateApi, certificateTypeApi, lookupApi } from '../../../api'
import { documentApi } from '../../../api/documentApi'
import { DownloadIcon, UploadIcon } from '../../../components/ds/TransferIcons'
import useToast from '../../../components/ds/useToast'
import { EmptyState, StatusTabs } from '../../../components/ds/Controls'
import CertificateTable from '../../../components/ds/CertificateTable'
import ScanButton from '../../../components/ds/ScanButton'
import { useCan } from '../../../hooks/usePermission'
import { saveBlob, downloadError } from '../exports/download'
import { CATEGORY, toTableCerts } from './certificateView'
import { certImage } from './certFiles'
import DocPreview from './DocPreview'
import useObjectUrl from '../../../hooks/useObjectUrl'

const fmtDate = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '')

// Tab Giấy tờ: mọi giấy lấy trọn vẹn từ thuyền viên (ảnh thẻ, CCCD, hộ chiếu, sổ thuyền viên, chứng chỉ), chỉ cần nạp ảnh.
// Một bảng chung, lọc theo loại. Biểu tượng bút ở mỗi dòng mở hộp thoại giấy đó: xem bản gốc, tải về,
// thay / nạp ảnh (chọn tệp là lưu ngay) và Sửa thông tin (loại, số, ngày cấp, hạn).
export default function DocumentsSection({ seafarerId, seafarer, photo, dismissed, onDismiss, onRestore }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const can = useCan()
  const canEdit = can('seafarer.update')
  const [editing, setEditing] = useState(null) // null | 'new' | dòng chứng chỉ
  const quickScanInput = useRef(null)
  const photoInput = useRef(null)
  const fileInput = useRef(null)
  const [replaceFor, setReplaceFor] = useState(null) // chứng chỉ đang thay ảnh (bấm Thay ảnh trong hộp thoại xem)
  const [newType, setNewType] = useState('')
  const [creatingType, setCreatingType] = useState(false)
  const [renewing, setRenewing] = useState(null) // chứng chỉ đang được cập nhật bằng bản mới (editing = 'new')
  const [certFile, setCertFile] = useState(null)
  const [category, setCategory] = useState('ALL')
  const [previewAt, setPreviewAt] = useState(null)
  const [bundling, setBundling] = useState(false)
  const [form] = Form.useForm()
  const [formInit, setFormInit] = useState({}) // giá trị đầu của hộp thoại (Form chỉ gắn khi hộp thoại mở)

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', seafarerId],
    queryFn: () => certificateApi.list(seafarerId).then((r) => r.data),
  })

  const { data: certTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: () => lookupApi.certificateTypes().then((r) => r.data),
  })

  const close = () => { setEditing(null); setRenewing(null); setCertFile(null) }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['certificates', seafarerId] })
  const saved = (text) => () => {
    toast.success(text)
    close()
    refresh()
  }
  const failed = (text) => (e) => toast.error(text, { description: e.response?.data?.error || 'Thử lại sau ít phút.' })

  const saveMutation = useMutation({
    mutationFn: async ({ row, values }) => {
      const noExpiry = Boolean(values.no_expiry)
      const payload = {
        certificate_type_id: values.certificate_type_id,
        certificate_number: values.certificate_number || undefined,
        issued_date: values.issued_date?.format?.('YYYY-MM-DD') || undefined,
        expiry_date: noExpiry ? undefined : values.expiry_date?.format?.('YYYY-MM-DD') || undefined,
        no_expiry: noExpiry,
      }
      if (row) {
        await certificateApi.update(seafarerId, row.id, { ...payload, expiry_date: payload.expiry_date || null, issued_date: payload.issued_date || null })
        if (certFile) await certificateApi.upload(seafarerId, row.id, certFile)
        return row
      }
      const cert = (await certificateApi.create(seafarerId, payload)).data
      if (certFile && cert?.id) await certificateApi.upload(seafarerId, cert.id, certFile)
      return cert
    },
    onSuccess: (_, { row }) => saved(row ? 'Đã lưu giấy tờ' : 'Đã thêm giấy tờ')(),
    onError: failed('Không lưu được giấy tờ'),
  })

  const deleteMutation = useMutation({
    mutationFn: (certId) => certificateApi.remove(seafarerId, certId),
    onSuccess: saved('Đã xoá giấy tờ'),
    onError: failed('Xoá thất bại'),
  })

  const replaceMutation = useMutation({
    mutationFn: ({ certId, file }) => certificateApi.upload(seafarerId, certId, file),
    onSuccess: () => {
      toast.success('Đã thay ảnh')
      refresh()
      queryClient.invalidateQueries({ queryKey: ['doc-preview'] })
    },
    onError: failed('Không thay được ảnh'),
  })

  const photoMutation = useMutation({
    mutationFn: (file) => seafarerApi.uploadPhoto(seafarerId, file),
    onSuccess: () => {
      toast.success('Đã lưu ảnh thẻ')
      queryClient.invalidateQueries({ queryKey: ['seafarer', seafarerId] })
    },
    onError: failed('Không lưu được ảnh thẻ'),
  })

  function handleDeleteCert(row) {
    Modal.confirm({
      title: 'Xoá giấy tờ?',
      content: `Bạn có chắc muốn xoá "${row.display_name}"?`,
      okText: 'Xoá',
      cancelText: 'Huỷ',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(row.id),
    })
  }

  // Tạo nhanh loại giấy ngay trong ô chọn loại; mã tự sinh từ tên.
  async function createType() {
    const name = newType.trim()
    if (!name || creatingType) return
    setCreatingType(true)
    try {
      const code = `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase().slice(0, 40)}_${Date.now().toString(36).toUpperCase().slice(-4)}`
      const created = await certificateTypeApi.create({ code, name_vi: name, name_en: name })
      await queryClient.invalidateQueries({ queryKey: ['certificate-types'] })
      form.setFieldValue('certificate_type_id', created.id)
      setNewType('')
      toast.success(`Đã tạo loại "${name}"`)
    } catch (e) {
      failed('Không tạo được loại giấy tờ')(e)
    } finally {
      setCreatingType(false)
    }
  }

  // Cập nhật = tạo giấy mới, điền sẵn loại và số của bản cũ. Bản mới có hạn muộn hơn thì bản cũ hết cảnh báo.
  function startRenew(cert) {
    setRenewing(cert.raw)
    setFormInit({ certificate_type_id: cert.raw.certificate_type_id, certificate_number: cert.raw.certificate_number })
    setEditing('new')
  }

  function startEdit(row) {
    setPreviewAt(null)
    setEditing(row)
    setFormInit({
      certificate_type_id: row.certificate_type_id,
      certificate_number: row.certificate_number,
      issued_date: row.issued_date ? dayjs(row.issued_date) : null,
      expiry_date: row.expiry_date ? dayjs(row.expiry_date) : null,
      no_expiry: Boolean(row.no_expiry),
    })
  }

  const startNew = () => { setFormInit({}); setEditing('new') }
  const pickPhoto = () => { setPreviewAt(null); photoInput.current?.click() }

  async function downloadCert(cert) {
    if (cert.isPhoto) {
      const link = document.createElement('a')
      link.href = photo
      link.download = `${seafarer.seafarer_code || seafarerId} - ${seafarer.full_name} - Ảnh thẻ.${photo.startsWith('data:image/png') ? 'png' : 'jpg'}`
      link.click()
      return
    }
    try {
      const blob = cert.raw.document_url || !cert.uploadId ? await certificateApi.file(seafarerId, cert.id) : await documentApi.uploadFile(cert.uploadId)
      const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = cert.fileName || `${cert.name}${cert.number !== '—' ? ` - ${cert.number}` : ''}.${ext}`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (e) {
      failed('Không tải được giấy tờ')(e)
    }
  }

  async function downloadAll() {
    setBundling(true)
    try {
      saveBlob(await certificateApi.bundle(seafarerId), `${seafarer.full_name} - Giấy tờ.zip`)
    } catch (e) {
      toast.error('Không tải được cả bộ', { description: await downloadError(e) })
    } finally {
      setBundling(false)
    }
  }

  const certTypeList = certTypes?.data || certTypes || []
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState('')
  async function scanCertificate(file) {
    setScanning(true)
    try {
      const result = await documentApi.scan(file, 'certificate')
      const got = Object.fromEntries((result.fields || []).map((item) => [item.field, item.value]))
      const type = certTypeList.find((c) => c.code === got.certificate_type_code)
      const values = {
        ...(type ? { certificate_type_id: type.id } : {}),
        ...(got.certificate_number ? { certificate_number: got.certificate_number } : {}),
        ...(got.issued_date ? { issued_date: dayjs(got.issued_date) } : {}),
        ...(got.expiry_date ? { expiry_date: dayjs(got.expiry_date) } : {}),
        ...(got.no_expiry ? { no_expiry: true, expiry_date: null } : {}),
      }
      setCertFile(file)
      if (!Object.keys(values).length) {
        toast.warning('Không đọc được ô nào từ giấy này', { description: 'Ảnh vẫn được giữ, nhập tay các ô còn lại.' })
        return
      }
      form.setFieldsValue(values)
      setScanDone(`Đã điền ${Object.keys(values).length} ô`)
      setTimeout(() => setScanDone(''), 5000)
      if (!type) toast.warning('Chưa nhận ra loại giấy', { description: 'Chọn loại tay rồi kiểm tra các ô còn lại.' })
    } catch (e) {
      setCertFile(file)
      failed('Không đọc được giấy này')(e)
    } finally {
      setScanning(false)
    }
  }

  const rows = useMemo(() => data?.data || [], [data])
  const isNew = editing === 'new'
  const noExpiry = Form.useWatch('no_expiry', form)

  // Ảnh thẻ là một dòng của bảng (nhóm Tuỳ thân), lưu ở hồ sơ thuyền viên chứ không phải chứng chỉ.
  const docs = useMemo(() => {
    const photoRow = {
      id: 'photo', isPhoto: true, name: 'Ảnh thẻ 4x6', category: CATEGORY.DOCUMENT, categoryKey: 'DOCUMENT', number: '—',
      issuedOn: fmtDate(seafarer.photo_updated_at) || '—', expiresOn: '', noExpiry: true, status: 'NO_EXPIRY', manual: true, hasFile: Boolean(photo),
    }
    return [photoRow, ...toTableCerts(rows, { dismissed })]
  }, [rows, dismissed, photo, seafarer.photo_updated_at])

  const categories = Object.keys(CATEGORY).filter((key) => docs.some((d) => d.categoryKey === key))
  const tabs = [{ value: 'ALL', label: 'Tất cả', count: docs.length }, ...categories.map((key) => ({ value: key, label: CATEGORY[key], count: docs.filter((d) => d.categoryKey === key).length }))]
  const shown = category === 'ALL' || !categories.includes(category) ? docs : docs.filter((d) => d.categoryKey === category)
  const missing = docs.filter((d) => !d.hasFile && !d.replaced).length

  const imageOf = (cert, size) => {
    if (cert.isPhoto) return photo ? { key: ['photo', seafarerId, seafarer.photo_updated_at], load: () => fetch(photo).then((r) => r.blob()) } : null
    return certImage(seafarerId, cert.raw, size)
  }
  const previewItems = shown.map((cert) => ({
    key: cert.id,
    name: cert.name,
    status: cert.isPhoto ? null : cert.replaced ? 'REPLACED' : cert.status,
    number: cert.number !== '—' ? cert.number : '',
    issuedLabel: cert.isPhoto ? 'Cập nhật' : 'Cấp ngày',
    issuedOn: cert.issuedOn !== '—' ? cert.issuedOn : '',
    expiresOn: cert.expiresOn,
    noExpiry: cert.isPhoto ? undefined : cert.noExpiry,
    source: cert.isPhoto ? null : cert.uploadId ? `${cert.fileName || 'Bộ giấy tải lên'}${cert.raw.source_page ? ` · ${cert.raw.source_page}` : ''}` : cert.hasFile ? 'Nạp tay' : null,
    image: imageOf(cert, 'full'),
    onDownload: () => downloadCert(cert),
    onReplace: canEdit ? (cert.isPhoto ? pickPhoto : () => { setReplaceFor(cert.id); fileInput.current?.click() }) : undefined,
    onEdit: canEdit && !cert.isPhoto ? () => startEdit(cert.raw) : undefined,
  }))

  // Ảnh xem trước của tệp vừa chọn trong hộp thoại nạp.
  const pickedUrl = useObjectUrl(certFile, (f) => f.type?.startsWith('image/'))
  const editingHasFile = editing && editing !== 'new' && Boolean(editing.document_url || editing.source_document_id)

  const addMenu = {
    items: [
      ...(can('seafarer.docs') ? [
        { key: 'scan', icon: <ScanOutlined />, label: 'Quét giấy tờ (AI)' },
      ] : []),
    ],
    onClick: () => quickScanInput.current?.click(),
  }

  return (
    <section className="ct-block" aria-label="Giấy tờ">
      <div className="crew-certs__head">
        <h3 className="crew-certs__title">Giấy tờ</h3>
        <Space wrap>
          {docs.some((d) => d.hasFile) ? <Button icon={<DownloadIcon />} loading={bundling} onClick={downloadAll}>Tải cả bộ</Button> : null}
          {canEdit && addMenu.items.length ? (
            <Space.Compact>
              <Button type="primary" icon={<UploadIcon />} onClick={startNew}>Nạp giấy tờ</Button>
              <Dropdown trigger={['click']} placement="bottomRight" menu={addMenu}>
                <Button type="primary" icon={<DownOutlined />} aria-label="Nạp giấy tờ theo cách khác" />
              </Dropdown>
            </Space.Compact>
          ) : canEdit ? <Button type="primary" icon={<UploadIcon />} onClick={startNew}>Nạp giấy tờ</Button> : null}
        </Space>
        <input
          ref={quickScanInput}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="ds-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            startNew()
            scanCertificate(file)
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="ds-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file && replaceFor) replaceMutation.mutate({ certId: replaceFor, file })
          }}
        />
        <input
          ref={photoInput}
          type="file"
          accept=".jpg,.jpeg,.png"
          className="ds-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) photoMutation.mutate(file)
          }}
        />
      </div>
      {isLoading ? (
        <div style={{ padding: 16 }}><Skeleton active paragraph={{ rows: 4 }} /></div>
      ) : (
        <>
          {tabs.length > 2 ? <div className="crew-docs-filter"><StatusTabs tabs={tabs} value={categories.includes(category) ? category : 'ALL'} onChange={setCategory} mobileLabel="Loại:" /></div> : null}
          {rows.length === 0 && !photo ? (
            <EmptyState title="Chưa có giấy tờ nào" description="Nạp ảnh hoặc bản scan CCCD, hộ chiếu, sổ thuyền viên, chứng chỉ. Nạp cả tệp nhiều giấy thì hệ thống tự tách và đọc." />
          ) : null}
          <CertificateTable
            certs={shown}
            onDismiss={(cert) => onDismiss([{ id: cert.id, expiry: String(cert.raw.expiry_date).slice(0, 10) }])}
            onRestore={(cert) => onRestore(cert.id)}
            onRenew={canEdit ? startRenew : undefined}
            onEdit={(cert) => setPreviewAt(shown.indexOf(cert))}
            onDownload={downloadCert}
          />
          {missing && canEdit ? <p className="crew-certs__renew" style={{ margin: '12px 0 0' }}>{missing} giấy chưa có ảnh. Bấm biểu tượng bút ở dòng đó để nạp ảnh.</p> : null}
        </>
      )}
      <DocPreview items={previewItems} index={previewAt} onIndex={setPreviewAt} onClose={() => setPreviewAt(null)} />
      <Modal
        title={renewing ? `Cập nhật: ${renewing.display_name}` : isNew ? 'Nạp giấy tờ' : `Sửa giấy tờ: ${editing?.display_name || ''}`}
        open={editing !== null}
        onCancel={close}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <div className="crew-certs__scan">
          {certFile ? (
            <div className="crew-pick" style={{ width: '100%' }}>
              {pickedUrl ? <img src={pickedUrl} alt="" /> : <span className="ds-thumb ds-thumb--sm"><UploadIcon /></span>}
              <div className="crew-pick__body">
                <p className="crew-pick__name" title={certFile.name}>{certFile.name}</p>
                <p className="crew-pick__meta">{(certFile.size / 1024 / 1024).toFixed(1)} MB{editingHasFile ? ' · thay cho ảnh đang có' : ''}{scanDone ? ` · ${scanDone}` : ''}</p>
              </div>
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Bỏ tệp" onClick={() => setCertFile(null)} />
            </div>
          ) : (
            <label className="ds-drop" style={{ width: '100%' }}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="ds-sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) setCertFile(file) }} />
              <span className="ds-drop__title">{editingHasFile ? 'Chọn ảnh mới để thay' : 'Chọn ảnh hoặc bản scan'}</span>
              <span className="ds-drop__hint">PDF, JPG hoặc PNG</span>
              <span className="ds-drop__button"><UploadIcon aria-hidden />Chọn tệp</span>
            </label>
          )}
          {isNew && can('seafarer.docs') && !certFile ? (
            <ScanButton label="Quét giấy tờ (AI)" loading={scanning} doneText={scanDone || undefined} onPick={(files) => scanCertificate(files[0])} />
          ) : null}
        </div>
        {renewing ? <p className="crew-certs__renew">Nhập thông tin bản mới. Khi bản mới có hạn muộn hơn, cảnh báo của bản cũ sẽ tự tắt.</p> : null}
        <Form form={form} layout="vertical" initialValues={formInit} onFinish={(v) => saveMutation.mutate({ row: isNew ? null : editing, values: v })}>
          <Form.Item name="certificate_type_id" label="Loại giấy tờ" rules={[{ required: true, message: 'Chọn loại giấy tờ' }]}>
            <Select
              allowClear
              placeholder="Chọn loại"
              showSearch
              optionFilterProp="label"
              options={certTypeList.map((c) => ({ value: c.id, label: c.name_vi || c.name }))}
              popupRender={(menu) => (can('catalog.update') ? (
                <>
                  {menu}
                  <div className="crew-certs__newtype">
                    <Input size="small" value={newType} maxLength={200} placeholder="Tên loại giấy mới" onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => e.stopPropagation()} onPressEnter={createType} />
                    <Button size="small" type="primary" icon={<PlusOutlined />} disabled={!newType.trim()} loading={creatingType} onClick={createType}>Tạo nhanh</Button>
                  </div>
                </>
              ) : menu)}
            />
          </Form.Item>
          <Form.Item name="certificate_number" label="Số">
            <Input />
          </Form.Item>
          <Form.Item name="issued_date" label="Ngày cấp" rules={[{ required: true, message: 'Nhập ngày cấp' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Có giá trị đến" rules={[{ required: !noExpiry, message: 'Nhập hạn hoặc đánh dấu không thời hạn' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={Boolean(noExpiry)} />
          </Form.Item>
          <Form.Item name="no_expiry" valuePropName="checked">
            <Checkbox>Không thời hạn</Checkbox>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              {isNew ? <span /> : <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteCert(editing)}>Xoá giấy tờ</Button>}
              <Space>
                <Button onClick={close}>Huỷ</Button>
                <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>Lưu</Button>
              </Space>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
