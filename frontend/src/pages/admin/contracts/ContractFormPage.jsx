import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Select, Skeleton } from 'antd'
import { EmptyState } from '../../../components/ds/Controls'
import StatusBadge from '../../../components/ds/StatusBadge'
import useToast from '../../../components/ds/useToast'
import { seafarerApi } from '../../../api'
import { useContract, useContractMutations, useVoyage } from '../../../hooks/useVoyages'
import { EDITABLE_CONTRACT_STATUSES } from '../../../constants/voyageContract'
import apiErrorText from '../../../utils/apiError'
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

// ctx: { voyageId, voyageCode, vesselName, ownerName, positionId, rankName, lineNo, budgetMonthly, budgetTotal }
function ContractForm({ contract, ctx, initial }) {
  const isEdit = !!contract
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const values = Form.useWatch([], form) || initial
  const { save } = useContractMutations()
  const [search, setSearch] = useState('')

  const people = useQuery({
    queryKey: ['seafarers', 'contract-picker', search],
    queryFn: () => seafarerApi.list({ search: search || undefined, limit: 20 }).then((r) => r.data.data),
  })
  const personRows = people.data || []
  const options = personRows.filter((p) => p.status !== 'INACTIVE').map((p) => ({ value: p.id, label: p.seafarer_code ? `${p.full_name} · ${p.seafarer_code}` : p.full_name, status: p.status, name: p.full_name }))
  if (contract && !options.some((o) => o.value === contract.seafarer.id)) {
    options.unshift({ value: contract.seafarer.id, label: contract.seafarer.seafarer_code ? `${contract.seafarer.full_name} · ${contract.seafarer.seafarer_code}` : contract.seafarer.full_name, status: contract.seafarer.status, name: contract.seafarer.full_name })
  }
  const picked = options.find((o) => o.value === values.seafarer_id)

  const months = safeMonths(values.start_date, values.end_date)
  const bal = useMemo(() => balance({ items: values.items || [], budgetMonthly: ctx.budgetMonthly, contractMonths: months ?? 0 }), [values.items, ctx.budgetMonthly, months])

  const changed = useMemo(() => {
    if (!isEdit) return true
    return JSON.stringify(toPayload(initial)) !== JSON.stringify(toPayload(values))
  }, [isEdit, initial, values])

  async function submit(formValues) {
    try {
      const row = await save.mutateAsync({ id: contract?.contract.id, ...toPayload(formValues, { positionId: isEdit ? undefined : ctx.positionId }) })
      toast.success(isEdit ? `Đã lưu hợp đồng ${row.contract.contract_number}` : `Đã tạo hợp đồng ${row.contract.contract_number}`)
      navigate(`/contracts/${row.contract.id}`)
    } catch (error) {
      toast.error(isEdit ? 'Không lưu được hợp đồng' : 'Không tạo được hợp đồng', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const back = isEdit ? `/contracts/${contract.contract.id}` : `/voyages/${ctx.voyageId}`
  const crumbs = isEdit
    ? [{ label: 'Hợp đồng', to: '/contracts' }, { label: contract.contract.contract_number, to: back }, { label: 'Sửa' }]
    : [{ label: 'Chuyến tàu', to: '/voyages' }, { label: ctx.voyageCode, to: back }, { label: 'Tạo hợp đồng' }]

  return (
    <div className="ds-page">
      <div>
        <Crumb items={crumbs} />
        <h1 className="sf-head__title">{isEdit ? `Sửa hợp đồng ${contract.contract.contract_number}` : `Tạo hợp đồng · ${ctx.rankName}`}</h1>
        <p className="sf-head__desc">
          {isEdit ? `${ctx.rankName} · ${ctx.vesselName} · chuyến ${ctx.voyageCode}` : 'Hợp đồng tạo ra ở dạng nháp. Tạo xong mở hợp đồng và bấm Xin duyệt; duyệt xong mới có hiệu lực.'}
        </p>
      </div>

      <Form form={form} layout="vertical" requiredMark className="ct-form" initialValues={initial} onFinish={submit} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <section className="sf-panel ct-panel" aria-labelledby="ct-general">
          <div className="sf-panel__head">
            <div>
              <h2 className="sf-panel__title" id="ct-general">Thông tin chung</h2>
              <p className="sf-panel__desc">{ctx.vesselName} · {ctx.ownerName} · chuyến {ctx.voyageCode}</p>
            </div>
          </div>
          <div className="sf-panel__body">
            <div className="sf-grid">
              <Form.Item
                name="seafarer_id"
                className="sf-c6"
                label="Thuyền viên"
                rules={[{ required: true, message: 'Chọn thuyền viên' }]}
                extra={picked?.status ? <StatusBadge group="crew" value={picked.status} /> : undefined}
              >
                <Select
                  showSearch={{ filterOption: false, onSearch: setSearch }}
                  loading={people.isLoading}
                  options={options}
                  placeholder="Tìm theo tên, mã, số hộ chiếu"
                  notFoundContent={people.isLoading ? 'Đang tìm…' : 'Không có thuyền viên nào khớp'}
                />
              </Form.Item>
              <Form.Item className="sf-c6 ct-pos" label="Vị trí" required extra={`Dòng ${ctx.lineNo} của chuyến`}>
                <Input value={ctx.rankName} disabled />
              </Form.Item>
              <Form.Item
                name="start_date"
                className="sf-c3"
                label="Ngày bắt đầu"
                rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}
                dependencies={['end_date']}
                extra={!isEdit ? 'Mặc định: xuống tàu dự kiến' : undefined}
              >
                <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
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
                extra={months != null ? formatMonths(months) : undefined}
              >
                <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notes" className="sf-c6" label="Ghi chú">
                <Input.TextArea rows={1} autoSize={{ minRows: 1, maxRows: 4 }} maxLength={2000} placeholder="Ghi chú cho hợp đồng này" />
              </Form.Item>
            </div>
          </div>
        </section>

        <Form.Item name="items" noStyle>
          <DealTable ownerName={ctx.ownerName} seafarerName={picked?.name || (isEdit ? contract.seafarer.full_name : 'Thuyền viên')} />
        </Form.Item>
        <Form.Item name="terms" noStyle>
          <TermsTable ownerName={ctx.ownerName} seafarerName={picked?.name || (isEdit ? contract.seafarer.full_name : 'Thuyền viên')} />
        </Form.Item>

        <BalanceBar balance={bal} budgetTotal={ctx.budgetTotal}>
          <Button onClick={() => navigate(back)}>Huỷ</Button>
          <Button type="primary" htmlType="submit" loading={save.isPending} disabled={isEdit && !changed}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo hợp đồng'}
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

function NewContract({ positionId, voyageId }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: voyage, isLoading, isError, refetch } = useVoyage(voyageId)
  const position = voyage?.positions.find((p) => p.id === positionId)
  const index = voyage?.positions.findIndex((p) => p.id === positionId)
  const existing = position?.contract

  useEffect(() => {
    if (existing) {
      toast.error('Vị trí này đã có hợp đồng')
      navigate(`/contracts/${existing.id}`, { replace: true })
    } else if (voyage?.status === 'ENDED') {
      toast.error('Chuyến đã kết thúc, không tạo thêm hợp đồng')
      navigate(`/voyages/${voyage.id}`, { replace: true })
    }
  }, [existing, voyage, navigate, toast])

  if (isLoading) return <Loading />
  if (isError || !voyage || !position) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được chuyến tàu' : 'Không tìm thấy vị trí'}
        description="Mở một chuyến tàu, bấm Tạo hợp đồng ở dòng vị trí còn trống."
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/voyages')}>Xem chuyến tàu</Button>}
      />
    )
  }
  if (existing || voyage.status === 'ENDED') return <Loading />
  const ctx = {
    voyageId: voyage.id,
    voyageCode: voyage.code,
    vesselName: voyage.vessel_name,
    ownerName: voyage.ship_owner_name,
    positionId: position.id,
    rankName: position.rank_name,
    lineNo: index + 1,
    budgetMonthly: position.budget_monthly_usd,
    budgetTotal: position.budget_total_usd,
  }
  return <ContractForm key={position.id} ctx={ctx} initial={newFormValues(voyage)} />
}

function EditContract({ id }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, isError, refetch } = useContract(id)
  const locked = data && !EDITABLE_CONTRACT_STATUSES.includes(data.contract.status)

  useEffect(() => {
    if (locked) {
      toast.error('Hợp đồng đang khoá, không sửa được')
      navigate(`/contracts/${id}`, { replace: true })
    }
  }, [locked, id, navigate, toast])

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
  if (locked) return <Loading />
  const ctx = {
    voyageId: data.voyage.id,
    voyageCode: data.voyage.code,
    vesselName: data.voyage.vessel_name,
    ownerName: data.voyage.ship_owner_name,
    rankName: data.position.rank_name,
    lineNo: data.position.sort_order + 1,
    budgetMonthly: data.position.budget_monthly_usd,
    budgetTotal: data.position.budget_total_usd,
  }
  return <ContractForm key={data.contract.id} contract={data} ctx={ctx} initial={initial} />
}

export default function ContractFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  if (id) return <EditContract id={id} />
  const positionId = Number(params.get('positionId'))
  const voyageId = Number(params.get('voyageId'))
  if (!positionId || !voyageId) {
    return (
      <EmptyState
        title="Chưa chọn vị trí để tạo hợp đồng"
        description="Mở một chuyến tàu, bấm Tạo hợp đồng ở dòng vị trí còn trống."
        action={<Button onClick={() => navigate('/voyages')}>Xem chuyến tàu</Button>}
      />
    )
  }
  return <NewContract positionId={positionId} voyageId={voyageId} />
}
