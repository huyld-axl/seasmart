import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, DatePicker, Form, Input, Skeleton } from 'antd'
import dayjs from 'dayjs'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { useBill, useBillMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatDate, formatUsd } from '../../../utils/format'
import { Crumb } from '../fleet/FleetParts'
import BillMoneyTable from './BillMoneyTable'
import { countChanges, dueChanged, groupItems, toFormValues, toPayload } from './billView'
import '../seafarers/SeafarerForm.css'
import '../seafarers/SeafarerProfile.css'
import '../fleet/fleet.css'
import '../contracts/contracts.css'
import './bills.css'

function Figure({ label, value }) {
  return (
    <div className="ct-fig">
      <span className="ct-fig__label">{label}</span>
      <span className="ct-fig__value"><b>{formatUsd(value)}</b> <span className="ct-fig__unit">USD</span></span>
    </div>
  )
}

// Màn sửa riêng của yêu cầu thanh toán (theo khuôn Sửa hợp đồng): số tiền từng khoản, dòng điều chỉnh, ghi chú.
function BillForm({ data }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const initial = useMemo(() => toFormValues(data), [data])
  const values = Form.useWatch([], form) || initial
  const { save } = useBillMutations()
  const { bill } = data
  const back = `/bills/${bill.id}`
  const changes = countChanges(initial, { ...initial, ...values })
  const { totals } = groupItems(values.items || [])
  const negative = totals.all < 0

  async function submit(formValues) {
    if (negative) return
    const payload = toPayload(formValues)
    if (payload.items.some((item) => 'name' in item && !item.name)) {
      toast.error('Chưa lưu được', { description: 'Dòng điều chỉnh cần tên.' })
      return
    }
    try {
      await save.mutateAsync({ id: bill.id, ...payload })
      toast.success(`Đã lưu ${bill.code}`)
      navigate(back)
    } catch (error) {
      toast.error(`Không lưu được ${bill.code}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <div className="ds-page">
      <div>
        <Crumb items={[
          { label: 'Tàu', to: '/vessels' },
          { label: bill.vessel.vessel_name, to: `/vessels/${bill.vessel.id}` },
          bill.trip ? { label: bill.trip.code, to: `/voyages/${bill.trip.id}` } : { label: bill.voyage.code },
          { label: bill.contract.contract_number, to: `/contracts/${bill.contract.id}` },
          { label: bill.code, to: back },
          { label: 'Sửa' },
        ]} />
        <h1 className="sf-head__title">Sửa yêu cầu thanh toán {bill.code}</h1>
        <p className="sf-head__desc">Kỳ {bill.seq}/{bill.periods} · {formatDate(bill.period_start)} → {formatDate(bill.period_end)} · {bill.contract.contract_number} · {bill.ship_owner.company_name}</p>
      </div>

      <Form form={form} layout="vertical" className="ct-form" initialValues={initial} onFinish={submit}>
        <section className="sf-panel ct-panel" aria-labelledby="bl-general">
          <div className="sf-panel__head">
            <div>
              <h2 className="sf-panel__title" id="bl-general">Thông tin chung</h2>
              <p className="sf-panel__desc">{bill.seafarer.full_name} · {bill.vessel.vessel_name}</p>
            </div>
          </div>
          <div className="sf-panel__body">
            <div className="sf-grid">
              <Form.Item
                name="due_date"
                className={`sf-c4${dueChanged(initial, values) ? ' sf-changed' : ''}`}
                label={<>Hạn thanh toán{dueChanged(initial, values) ? <span className="sf-chip">Đã sửa</span> : null}</>}
                rules={[{ required: true, message: 'Chọn hạn thanh toán' }]}
                extra="Tính tự động theo kỳ thanh toán của hợp đồng. Cần dời (ngày lễ…) thì sửa ở đây."
              >
                <DatePicker format="DD/MM/YYYY" placeholder="dd/mm/yyyy" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(bill.period_start), 'day')} />
              </Form.Item>
              <Form.Item
                name="note"
                className={`sf-c8${(initial.note || '').trim() !== (values.note || '').trim() ? ' sf-changed' : ''}`}
                label={<>Ghi chú{(initial.note || '').trim() !== (values.note || '').trim() ? <span className="sf-chip">Đã sửa</span> : null}</>}
              >
                <Input.TextArea rows={2} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} placeholder="Ghi chú nội bộ, không in lên bill" />
              </Form.Item>
            </div>
          </div>
        </section>

        <Form.Item name="items" noStyle>
          <BillMoneyTable initial={initial.items} />
        </Form.Item>

        <div className="sf-savebar ct-bar">
          <div className="ct-budget">
            <span className="ct-budget__label">Tổng yêu cầu</span>
            <span className={`ct-budget__value${negative ? ' bl-negative' : ''}`}><b>{formatUsd(totals.all)}</b> <span className="ct-fig__unit">USD</span></span>
          </div>
          <div className="ct-figs">
            <Figure label="Hằng tháng" value={totals.monthly} />
            <Figure label="Một lần" value={totals.once} />
            <Figure label="Điều chỉnh" value={totals.adjust} />
          </div>
          {negative ? (
            <p className="sf-savebar__msg sf-savebar__msg--err bl-bar-msg"><ExclamationCircleOutlined aria-hidden /> Tổng không được âm. Sửa lại dòng điều chỉnh.</p>
          ) : changes ? (
            <p className="sf-savebar__msg bl-bar-msg"><b>{changes} thay đổi</b></p>
          ) : null}
          <div className="sf-savebar__actions">
            <Button onClick={() => navigate(back)}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={save.isPending} disabled={!changes || negative}>Lưu thay đổi</Button>
          </div>
        </div>
      </Form>
    </div>
  )
}

export default function BillFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useBill(id)
  if (isLoading) return <div className="ds-page"><div className="sf-panel sf-panel__body"><Skeleton active paragraph={{ rows: 8 }} /></div></div>
  if (isError || !data) {
    return <EmptyState isError={isError} title="Không tải được yêu cầu thanh toán" description="Mất kết nối tới máy chủ." action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }
  if (data.bill.status !== 'OPEN') {
    return <EmptyState title="Yêu cầu thanh toán này đã gửi, không sửa được" description="Thu hồi ở trang chi tiết để về Chưa gửi rồi sửa." action={<Button onClick={() => navigate(`/bills/${id}`)}>Về trang chi tiết</Button>} />
  }
  return <BillForm data={data} />
}
