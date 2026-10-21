import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Modal, Select } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import Banner from '../../../components/ds/Banner'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { useVoyageMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { crewMoves } from './voyageView'
import './voyages.css'

const CONTRACT_LABELS = { DRAFT: 'Nháp', PENDING: 'Chờ duyệt', REJECTED: 'Bị từ chối' }

// Bắt đầu (kind 'start') hoặc Kết thúc (kind 'end') chuyến: ghi ngày và nơi thực tế, liệt kê ai đổi trạng thái.
export default function VoyageTransitionModal({ kind, voyage, open, onClose }) {
  const isStart = kind === 'start'
  const toast = useToast()
  const [form] = Form.useForm()
  const { start, end } = useVoyageMutations()
  const mutation = isStart ? start : end
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data), enabled: open })
  const { moved, skipped } = crewMoves(voyage.positions, kind)
  const dateName = isStart ? 'actual_embark_date' : 'actual_disembark_date'
  const portName = isStart ? 'embark_port_id' : 'disembark_port_id'
  const plannedDate = isStart ? voyage.planned_embark_date : voyage.planned_disembark_date
  const defaultPort = isStart ? voyage.embark_port_id : voyage.disembark_port_id
  const toState = isStart ? 'ON_VESSEL' : 'AVAILABLE'

  useEffect(() => {
    if (open) form.setFieldsValue({ [dateName]: plannedDate ? dayjs(plannedDate) : null, [portName]: defaultPort ?? undefined })
  }, [open, form, dateName, portName, plannedDate, defaultPort])

  async function submit(values) {
    try {
      await mutation.mutateAsync({ id: voyage.id, [dateName]: values[dateName].format('YYYY-MM-DD'), [portName]: values[portName] })
      toast.success(isStart
        ? `Đã bắt đầu chuyến ${voyage.code} · ${moved.length} người chuyển sang Đang trên tàu`
        : `Đã kết thúc chuyến ${voyage.code} · ${moved.length} người chuyển sang Ở bờ`)
      onClose()
    } catch (error) {
      toast.error(isStart ? `Không bắt đầu được chuyến ${voyage.code}` : `Không kết thúc được chuyến ${voyage.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const dateRules = [
    { required: true, message: isStart ? 'Chọn ngày xuống tàu thực tế' : 'Chọn ngày rời tàu thực tế' },
    ...(isStart ? [] : [{
      validator: (_, value) => (!value || !voyage.actual_embark_date || !value.isBefore(dayjs(voyage.actual_embark_date), 'day')
        ? Promise.resolve()
        : Promise.reject(new Error(`Ngày rời tàu phải sau hoặc bằng ngày xuống tàu ${formatDate(voyage.actual_embark_date)}`))),
    }]),
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={600}
      destroyOnHidden
      title={
        <div>
          <div>{isStart ? `Bắt đầu chuyến ${voyage.code}?` : `Kết thúc chuyến ${voyage.code}?`}</div>
          <p className="vt-desc">{isStart ? 'Ghi ngày và nơi xuống tàu thực tế. Chuyến chuyển sang Đang trên tàu.' : 'Ghi ngày và nơi rời tàu thực tế. Chuyến chuyển sang Đã kết thúc.'}</p>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>Huỷ</Button>,
        <Button key="ok" type="primary" loading={mutation.isPending} onClick={() => form.submit()}>{isStart ? 'Bắt đầu chuyến' : 'Kết thúc chuyến'}</Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark onFinish={submit} className="vt-form">
        <div className="vt-fields">
          <Form.Item name={dateName} label={isStart ? 'Ngày xuống tàu thực tế' : 'Ngày rời tàu thực tế'} rules={dateRules} extra="Mặc định: ngày dự kiến">
            <DatePicker format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name={portName} label={isStart ? 'Nơi xuống tàu' : 'Nơi rời tàu'} rules={[{ required: true, message: 'Chọn cảng' }]} extra="Mặc định: nơi đã nhập ở chuyến">
            <Select showSearch optionFilterProp="label" loading={ports.isLoading} options={(ports.data || []).map((p) => ({ value: p.id, label: p.name }))} placeholder="Chọn cảng" />
          </Form.Item>
        </div>
      </Form>

      <section className="vt-box" aria-label={isStart ? 'Chuyển sang Đang trên tàu' : 'Chuyển sang Ở bờ'}>
        <h3 className="vt-box__head">{isStart ? 'Chuyển sang Đang trên tàu' : 'Chuyển sang Ở bờ'}<span className="vt-box__count">{moved.length}</span></h3>
        {moved.length ? (
          <ul className="vt-list">
            {moved.map((person) => (
              <li key={person.seafarerId}>
                <span className="ds-cell2">
                  <span className="ds-cell2__main">{person.name}</span>
                  <span className="ds-cell2__sub">{person.rank} · hợp đồng hiệu lực</span>
                </span>
                <span className="vt-list__states">
                  <StatusBadge group="crew" value={person.from} />
                  <ArrowRightOutlined aria-hidden />
                  <StatusBadge group="crew" value={toState} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vt-empty">Chưa có thuyền viên nào có hợp đồng Hiệu lực, không ai đổi trạng thái.</p>
        )}
      </section>

      {skipped.length ? (
        <div className="vt-warn">
          <Banner tone="warning" title={`${skipped.length} người có hợp đồng chưa hiệu lực, giữ nguyên trạng thái`}>
            <ul className="vt-skipped">
              {skipped.map((person) => (
                <li key={person.seafarerId}>{person.name} · {person.rank} · {CONTRACT_LABELS[person.contractStatus]}</li>
              ))}
            </ul>
          </Banner>
        </div>
      ) : null}
    </Modal>
  )
}
