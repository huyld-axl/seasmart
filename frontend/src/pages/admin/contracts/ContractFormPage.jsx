import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Select, Skeleton } from 'antd'
import DateField from '../../../components/ds/DateField'
import dayjs from 'dayjs'
import Banner from '../../../components/ds/Banner'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { voyageApi } from '../../../api/voyageApi'
import { useContract, useContractMutations, useVoyage } from '../../../hooks/useVoyages'
import { EDITABLE_CONTRACT_STATUSES } from '../../../constants/voyageContract'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { Crumb } from '../fleet/FleetParts'
import { monthsBetween } from '../voyages/voyageView'
import BalanceBar from './BalanceBar'
import DealTable from './DealTable'
import TermsTable from './TermsTable'
import { balance, newFormValues, toFormValues, toPayload } from './contractView'
import '../seafarers/SeafarerForm.css'
import '../seafarers/SeafarerProfile.css'
import '../fleet/fleet.css'
import './contracts.css'

const DATE_FORMAT = 'DD/MM/YYYY'
const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`

function safeMonths(start, end) {
  if (!start || !end) return null
  try {
    return monthsBetween(start, end)
  } catch {
    return null
  }
}

const BILL_STATUS_LABELS = { APPROVED: 'Đã duyệt', SENT: 'Đã gửi', PAID: 'Đã thu' }
const voyageLabel = (v) => `${v.code} · ${v.seafarer_name} · ${v.vessel_name} · lên ${formatDate(v.join_date)}`

// Dòng chuyến dùng trong form: từ danh sách chuyến hoặc chi tiết hợp đồng.
function voyageRowOfContract(detail) {
  const v = detail.voyage
  return {
    id: v.id, code: v.code, seafarer_name: detail.seafarer.full_name, rank_name: v.rank_name, vessel_name: v.vessel_name, ship_owner_name: v.ship_owner_name,
    join_date: v.join_date, planned_leave_date: v.planned_leave_date, budget_monthly_usd: detail.position.budget_monthly_usd,
  }
}

// Màn 4 · Thêm / sửa hợp đồng. Hợp đồng luôn thuộc một chuyến (mỗi chuyến tối đa một hợp đồng); thuyền viên lấy từ chuyến.
// lockVoyage: mở từ chi tiết chuyến (?voyage=) hoặc đang sửa thì ô Chuyến khoá.
function ContractForm({ contract, presetVoyage, initial, lockVoyage, onSavedAndNew }) {
  const isEdit = !!contract
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const values = Form.useWatch([], form) || initial
  const { save } = useContractMutations()
  const againRef = useRef(false)
  const [again, setAgain] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(presetVoyage || null)
  const [blocked, setBlocked] = useState(null)

  const voyages = useQuery({
    queryKey: ['voyages', 'contract-picker', search],
    queryFn: () => voyageApi.list({ search: search || undefined, no_contract: true, limit: 20 }).then((r) => r.data),
    enabled: !lockVoyage,
  })
  const options = (lockVoyage ? [picked] : voyages.data || []).filter(Boolean).map((v) => ({ value: v.id, label: voyageLabel(v), row: v }))

  const months = safeMonths(values.start_date, values.end_date)
  const budgetMonthly = picked?.budget_monthly_usd ?? null
  const bal = useMemo(() => balance({ items: values.items || [], budgetMonthly, contractMonths: months ?? 0 }), [values.items, budgetMonthly, months])

  const changed = useMemo(() => {
    if (!isEdit) return true
    return JSON.stringify(toPayload(initial)) !== JSON.stringify(toPayload(values))
  }, [isEdit, initial, values])

  function onVoyageChange(_, option) {
    const row = option?.row || null
    setPicked(row)
    // S, E chép từ chuyến lúc chọn; sau đó sửa tự do.
    if (row) form.setFieldsValue({ start_date: dayjs(row.join_date), end_date: dayjs(row.planned_leave_date) })
  }

  // Lỗi 409 vì bill bị ảnh hưởng đã gửi / đã thu: lỗi dưới ô ngày và banner liệt kê bill (Màn 10).
  function showBlocked(error, formValues) {
    const list = error.response?.data?.blocked_bills
    if (!list?.length) return false
    const startChanged = isEdit && !dayjs(formValues.start_date).isSame(initial.start_date, 'day')
    const field = startChanged ? 'start_date' : 'end_date'
    form.setFields([{ name: field, errors: [startChanged ? 'Có bill đã duyệt, đã gửi hoặc đã thu cần gỡ trước' : 'Có bill đã thu nằm sau ngày này'] }])
    setBlocked({ list, field, date: formValues[field], safeFrom: startChanged ? null : list.map((b) => b.end).sort().at(-1) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  async function submit(formValues) {
    setBlocked(null)
    try {
      const row = await save.mutateAsync({ id: contract?.contract.id, ...toPayload(formValues, { voyageId: isEdit ? undefined : formValues.seafarer_voyage_id }) })
      toast.success(isEdit ? `Đã lưu hợp đồng ${row.contract.contract_number}` : `Đã thêm hợp đồng ${row.contract.contract_number}`)
      if (againRef.current && !isEdit) {
        onSavedAndNew()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate(`/contracts/${row.contract.id}`)
      }
    } catch (error) {
      if (showBlocked(error, formValues)) return
      toast.error(isEdit ? 'Không lưu được hợp đồng' : 'Không thêm được hợp đồng', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const back = isEdit ? `/contracts/${contract.contract.id}` : picked && lockVoyage ? `/voyages/${picked.id}` : '/contracts'
  const crumbs = isEdit
    ? [{ label: 'Hợp đồng', to: '/contracts' }, { label: contract.contract.contract_number, to: back }, { label: 'Sửa' }]
    : [{ label: 'Hợp đồng', to: '/contracts' }, { label: 'Thêm hợp đồng' }]
  const ownerName = picked?.ship_owner_name || 'Chủ tàu'
  const seafarerName = picked?.seafarer_name || 'Thuyền viên'

  return (
    <div className="ds-page">
      <div>
        <Crumb items={crumbs} />
        <h1 className="sf-head__title">{isEdit ? `Sửa hợp đồng ${contract.contract.contract_number}` : 'Thêm hợp đồng'}</h1>
        <p className="sf-head__desc">
          {isEdit ? `${picked.rank_name} · ${picked.vessel_name} · chuyến ${picked.code}` : 'Hợp đồng luôn thuộc một chuyến. Mỗi chuyến tối đa một hợp đồng. Hợp đồng tạo ra ở dạng nháp; xin duyệt và duyệt xong mới có hiệu lực.'}
        </p>
      </div>

      <Form form={form} layout="vertical" requiredMark className="ct-form" initialValues={initial} onFinish={submit} onValuesChange={() => blocked && setBlocked(null)} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        {blocked ? (
          <Banner
            tone="error"
            title={`Chưa lưu được ngày ${blocked.field === 'start_date' ? 'bắt đầu' : 'kết thúc'} ${blocked.date ? dayjs(blocked.date).format(DATE_FORMAT) : ''}`.trim()}
            description={`Các bill ${blocked.field === 'start_date' ? 'của hợp đồng' : 'sau ngày này'} đã duyệt, đã gửi hoặc đã thu: Huỷ ghi nhận thu, thu hồi, bỏ duyệt bill đó rồi lưu lại${blocked.safeFrom ? `, hoặc chọn ngày từ ${formatDate(blocked.safeFrom)} trở đi` : ''}.`}
          >
            <ul className="ct-blocked">
              {blocked.list.map((b) => (
                <li key={b.bill_id}><Link to={`/bills/${b.bill_id}`}>{b.code}</Link> kỳ {b.seq} ({BILL_STATUS_LABELS[b.status]})</li>
              ))}
            </ul>
          </Banner>
        ) : null}
        <section className="sf-panel ct-panel" aria-labelledby="ct-general">
          <div className="sf-panel__head">
            <div>
              <h2 className="sf-panel__title" id="ct-general">Thông tin chung</h2>
              <p className="sf-panel__desc">{picked ? `${picked.vessel_name} · ${ownerName} · chuyến ${picked.code}` : 'Chọn chuyến để điền sẵn thuyền viên, tàu, chủ tàu và ngày.'}</p>
            </div>
          </div>
          <div className="sf-panel__body">
            <div className="sf-grid">
              <Form.Item
                name="seafarer_voyage_id"
                className="sf-c6"
                label="Chuyến"
                rules={[{ required: true, message: 'Chọn chuyến' }]}
                extra={lockVoyage ? undefined : 'Chỉ hiện chuyến chưa có hợp đồng'}
              >
                <Select
                  allowClear={!lockVoyage}
                  disabled={lockVoyage}
                  showSearch={{ filterOption: false, onSearch: setSearch }}
                  loading={voyages.isLoading}
                  options={options}
                  onChange={onVoyageChange}
                  placeholder="Tìm theo mã chuyến hoặc tên thuyền viên"
                  notFoundContent={voyages.isLoading ? 'Đang tìm…' : 'Không có chuyến nào chưa có hợp đồng'}
                />
              </Form.Item>
              <Form.Item className="sf-c6 ct-pos" label="Chức danh" extra="Theo chuyến">
                <Input value={picked?.rank_name || ''} disabled />
              </Form.Item>
              <Form.Item
                name="start_date"
                className="sf-c3"
                label="Ngày bắt đầu"
                rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}
                dependencies={['end_date']}
                extra={!isEdit ? 'Điền sẵn từ ngày xuống tàu, sửa được' : undefined}
              >
                <DateField format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="end_date"
                className="sf-c3"
                label="Ngày kết thúc"
                dependencies={['start_date']}
                rules={[
                  { required: true, message: 'Chọn ngày kết thúc' },
                  {
                    validator: (_, value) => {
                      const start = form.getFieldValue('start_date')
                      return !value || !start || !value.isBefore(start, 'day') ? Promise.resolve() : Promise.reject(new Error('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'))
                    },
                  },
                ]}
                extra={months != null ? formatMonths(months) : !isEdit ? 'Điền sẵn từ ngày rời dự kiến, sửa được' : undefined}
              >
                <DateField format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notes" className="sf-c6" label="Ghi chú">
                <Input.TextArea rows={1} autoSize={{ minRows: 1, maxRows: 4 }} maxLength={2000} placeholder="Ghi chú cho hợp đồng này" />
              </Form.Item>
            </div>
          </div>
        </section>

        <Form.Item name="items" noStyle>
          <DealTable ownerName={ownerName} seafarerName={seafarerName} />
        </Form.Item>
        <Form.Item name="terms" noStyle>
          <TermsTable ownerName={ownerName} seafarerName={seafarerName} />
        </Form.Item>

        <BalanceBar balance={bal} budgetTotal={null}>
          <Button onClick={() => navigate(back)}>Huỷ</Button>
          {!isEdit ? (
            <Button
              loading={save.isPending && again}
              disabled={save.isPending}
              onClick={() => {
                againRef.current = true
                setAgain(true)
                form.submit()
              }}
            >
              Lưu & thêm hợp đồng khác
            </Button>
          ) : null}
          <Button
            type="primary"
            htmlType="submit"
            loading={save.isPending && !again}
            disabled={isEdit && !changed}
            onClick={() => {
              againRef.current = false
              setAgain(false)
            }}
          >
            {isEdit ? 'Lưu thay đổi' : 'Thêm hợp đồng'}
          </Button>
        </BalanceBar>
      </Form>
    </div>
  )
}

function Loading() {
  return (
    <div className="ds-page">
      <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 8 }} /></div>
    </div>
  )
}

function EditContract({ id }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, isError, refetch } = useContract(id)
  const locked = data && !EDITABLE_CONTRACT_STATUSES.includes(data.contract.status)
  const legacy = data?.contract.legacy_unlinked

  useEffect(() => {
    if (locked || legacy) {
      toast.error(legacy ? 'Hợp đồng cũ chưa gắn chuyến, không sửa được' : 'Hợp đồng đang khoá, không sửa được')
      navigate(`/contracts/${id}`, { replace: true })
    }
  }, [locked, legacy, id, navigate, toast])

  const initial = useMemo(() => (data ? toFormValues(data) : null), [data])
  if (isLoading) return <Loading />
  if (isError || !data) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được hợp đồng' : 'Không tìm thấy hợp đồng'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/contracts')}>Về danh sách</Button>}
      />
    )
  }
  if (locked || legacy) return <Loading />
  return <ContractForm key={data.contract.id} contract={data} presetVoyage={voyageRowOfContract(data)} initial={initial} lockVoyage />
}

// Mở từ chi tiết chuyến (?voyage=): chuyến chọn sẵn và khoá. Chuyến đã có hợp đồng thì dẫn tới hợp đồng đó.
function CreateFromVoyage({ voyageId, round, onSavedAndNew }) {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useVoyage(voyageId)
  const initial = useMemo(() => (data ? { ...newFormValues(data), notes: '' } : null), [data])
  if (isLoading) return <Loading />
  if (isError || !data) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được chuyến' : 'Không tìm thấy chuyến'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/contracts')}>Về danh sách hợp đồng</Button>}
      />
    )
  }
  if (data.contract) {
    return (
      <EmptyState
        title={`Chuyến ${data.code} đã có hợp đồng ${data.contract.contract_number}`}
        description="Mỗi chuyến tối đa một hợp đồng."
        action={<Button onClick={() => navigate(`/contracts/${data.contract.id}`)}>Mở hợp đồng</Button>}
      />
    )
  }
  return <ContractForm key={round} presetVoyage={data} initial={initial} lockVoyage onSavedAndNew={onSavedAndNew} />
}

export default function ContractFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [round, setRound] = useState(0)
  const voyageId = params.get('voyage')
  if (id) return <EditContract id={id} />
  // Lưu & thêm khác: về form trống, bỏ chuyến chọn sẵn trên đường dẫn.
  const again = () => {
    if (voyageId) navigate('/contracts/new', { replace: true })
    setRound((value) => value + 1)
  }
  if (voyageId) return <CreateFromVoyage voyageId={voyageId} round={round} onSavedAndNew={again} />
  return <ContractForm key={round} initial={{ ...newFormValues(null), notes: '' }} onSavedAndNew={again} />
}
