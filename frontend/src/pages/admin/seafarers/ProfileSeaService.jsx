import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Modal, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seaServiceApi } from '../../../api/seaServiceApi'
import { documentApi } from '../../../api/documentApi'
import { EmptyState } from '../../../components/ds/Controls'
import SeaServiceTimeline from '../../../components/ds/SeaServiceTimeline'
import useToast from '../../../components/ds/useToast'
import { useCan } from '../../../hooks/usePermission'
import { toTimelineTrips } from './seaServiceView'

const DATE_FORMAT = 'DD/MM/YYYY'

// Tab "Đi tàu" (T5): chuyến đi tàu của thuyền viên, mới nhất trước. Chuyến lấy từ sổ thuyền viên hoặc nhập tay.
// Sửa và xoá bắt buộc ghi lý do; backend ghi lý do vào lịch sử hồ sơ.
export default function ProfileSeaService({ seafarerId }) {
  const qc = useQueryClient()
  const toast = useToast()
  const canEdit = useCan()('seafarer.sea')
  const [editing, setEditing] = useState(null) // null | 'new' | chuyến
  const [deleting, setDeleting] = useState(null)
  const [reason, setReason] = useState('')
  const [form] = Form.useForm()
  const queryKey = ['sea-services', String(seafarerId)]

  const { data, isLoading, isError, refetch } = useQuery({ queryKey, queryFn: () => seaServiceApi.list(seafarerId) })
  const fail = (e) => toast.error('Không cập nhật được lịch sử đi tàu', { description: e.response?.data?.error || 'Thử lại sau ít phút.' })
  const done = (text) => () => { toast.success(text); qc.invalidateQueries({ queryKey }); setEditing(null); setDeleting(null); setReason('') }

  const save = useMutation({
    mutationFn: ({ trip, values }) => {
      const body = {
        vessel_name_raw: values.vessel_name_raw || null,
        rank_raw: values.rank_raw || null,
        sign_on_date: values.sign_on_date ? values.sign_on_date.format('YYYY-MM-DD') : null,
        sign_on_port: values.sign_on_port || null,
        sign_off_date: values.sign_off_date ? values.sign_off_date.format('YYYY-MM-DD') : null,
        sign_off_port: values.sign_off_port || null,
      }
      return trip ? seaServiceApi.update(trip.id, body, values.reason) : seaServiceApi.create(seafarerId, body)
    },
    onSuccess: done('Đã lưu chuyến đi tàu'),
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: ({ trip, text }) => seaServiceApi.remove(trip.id, text),
    onSuccess: done('Đã xoá chuyến đi tàu'),
    onError: fail,
  })

  async function openSource(trip) {
    const docId = trip.raw.document_id
    try {
      const doc = docId ? await documentApi.get(docId) : null
      if (!doc?.upload_id) return toast.error('Chuyến này không còn bản gốc')
      const blob = await documentApi.uploadFile(doc.upload_id)
      window.open(URL.createObjectURL(blob), '_blank', 'noopener')
    } catch (e) {
      fail(e)
    }
  }

  function startEdit(trip) {
    setEditing(trip.raw)
    form.setFieldsValue({
      vessel_name_raw: trip.raw.vessel_name_raw,
      rank_raw: trip.raw.rank_raw,
      sign_on_date: trip.raw.sign_on_date ? dayjs(trip.raw.sign_on_date) : null,
      sign_on_port: trip.raw.sign_on_port,
      sign_off_date: trip.raw.sign_off_date ? dayjs(trip.raw.sign_off_date) : null,
      sign_off_port: trip.raw.sign_off_port,
      reason: '',
    })
  }
  function startNew() {
    form.resetFields()
    setEditing('new')
  }

  const trips = toTimelineTrips(data || [], () => 'Từ sổ thuyền viên')
  const isNew = editing === 'new'
  let body
  if (isLoading) body = <Skeleton active paragraph={{ rows: 4 }} />
  else if (isError) body = <EmptyState isError title="Không tải được các chuyến đi tàu" description="Mất kết nối với máy chủ. Dữ liệu đã lưu không bị mất." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  else if (!trips.length) {
    body = <EmptyState title="Chưa có chuyến đi tàu nào" description="Tải sổ thuyền viên lên, mỗi trang bố trí chức danh thành một chuyến. Hoặc nhập tay từng chuyến." action={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>Thêm chuyến</Button> : undefined} />
  } else {
    body = <SeaServiceTimeline trips={trips} onEdit={canEdit ? (trip) => startEdit(trip) : undefined} onDelete={canEdit ? (trip) => setDeleting(trip.raw) : undefined} onOpenSource={openSource} />
  }

  return (
    <section className="crew-panel">
      <div className="crew-panel__head">
        <div>
          <h2 className="crew-panel__title">Chuyến đi tàu {trips.length ? <span className="ds-num">{trips.length}</span> : null}</h2>
          <p className="ds-field__reason" style={{ margin: 0 }}>Mới nhất trước. Chuyến lấy từ sổ thuyền viên hoặc nhập tay.</p>
        </div>
        {canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={startNew}>Thêm chuyến</Button> : null}
      </div>
      <div className="crew-panel__body">{body}</div>

      <Modal
        title={isNew ? 'Thêm chuyến đi tàu' : 'Sửa chuyến đi tàu'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(values) => save.mutate({ trip: isNew ? null : editing, values })}>
          <Form.Item name="vessel_name_raw" label="Tên tàu" rules={[{ required: true, message: 'Nhập tên tàu' }]}><Input /></Form.Item>
          <Form.Item name="rank_raw" label="Chức danh"><Input placeholder="Ví dụ OLR, 2/E" /></Form.Item>
          <div className="ds-form-row">
            <Form.Item name="sign_on_date" label="Ngày xuống tàu"><DatePicker format={DATE_FORMAT} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="sign_on_port" label="Cảng xuống tàu"><Input /></Form.Item>
            <Form.Item name="sign_off_date" label="Ngày rời tàu"><DatePicker format={DATE_FORMAT} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="sign_off_port" label="Cảng rời tàu"><Input /></Form.Item>
          </div>
          {!isNew && (
            <Form.Item name="reason" label="Lý do sửa" rules={[{ required: true, whitespace: true, message: 'Cần ghi lý do để sửa' }]}>
              <Input.TextArea rows={2} placeholder="Ví dụ: sổ ghi nhầm ngày, đã đối chiếu bản gốc" maxLength={500} />
            </Form.Item>
          )}
          <div className="rv-inline" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditing(null)}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu chuyến</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`Xoá chuyến ${deleting?.vessel_name_raw || ''}?`}
        open={deleting !== null}
        onCancel={() => { setDeleting(null); setReason('') }}
        okText="Xoá chuyến"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: remove.isPending }}
        cancelText="Huỷ"
        onOk={() => remove.mutate({ trip: deleting, text: reason.trim() })}
      >
        <p>{deleting?.source_type === 'DOCUMENT' ? 'Chuyến này lấy từ sổ thuyền viên. Xoá thì chuyến biến khỏi hồ sơ, tệp gốc vẫn còn.' : 'Chuyến nhập tay. Xoá thì chuyến biến khỏi hồ sơ.'}</p>
        <Input.TextArea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do xoá (bắt buộc)" maxLength={500} />
      </Modal>
    </section>
  )
}
