import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Select, Skeleton, Tooltip } from 'antd'
import { CheckCircleFilled, CloseOutlined, CopyOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import MoneyInput from '../../../components/ds/MoneyInput'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { shipOwnerApi, vesselApi } from '../../../api/fleetApi'
import { useVoyage, useVoyageMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatUsd } from '../../../utils/format'
import { FleetTile, FormFrame, FormSection } from '../fleet/FleetParts'
import changedLabel from '../fleet/changedLabel'
import { monthsBetween, splitBudget, toFormValues, toPayload } from './voyageView'
import '../fleet/fleet.css'
import './voyages.css'

const DATE_FORMAT = 'DD/MM/YYYY'
const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' } }
const BLANK_POSITION = { rank_id: undefined, budget_total_usd: null, budget_monthly_usd: null }
const EMPTY = { vessel_id: undefined, ship_owner_id: undefined, planned_embark_date: null, planned_disembark_date: null, embark_port_id: undefined, disembark_port_id: undefined, notes: '', positions: [BLANK_POSITION] }

const FIELD_LABELS = {
  vessel_id: 'Tàu', ship_owner_id: 'Chủ tàu', planned_embark_date: 'Ngày xuống tàu dự kiến', planned_disembark_date: 'Ngày rời tàu dự kiến',
  embark_port_id: 'Nơi xuống tàu', disembark_port_id: 'Nơi rời tàu', actual_embark_date: 'Ngày xuống tàu thực tế', actual_disembark_date: 'Ngày rời tàu thực tế',
  notes: 'Ghi chú', positions: 'Vị trí dự kiến',
}

function safeMonths(start, end) {
  if (!start || !end) return null
  try {
    return monthsBetween(start, end)
  } catch {
    return null
  }
}

const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`

function VoyageForm({ voyage }) {
  const isEdit = !!voyage
  const started = isEdit && voyage.status !== 'PLANNING'
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const initial = useMemo(() => (voyage ? toFormValues(voyage) : EMPTY), [voyage])
  const values = Form.useWatch([], form) || initial
  const { save } = useVoyageMutations()
  const againRef = useRef(false)
  const [again, setAgain] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [ownerFromVessel, setOwnerFromVessel] = useState(false)

  const vessels = useQuery({ queryKey: ['fleet', 'vessel-options', vesselSearch], queryFn: () => vesselApi.list({ search: vesselSearch || undefined, limit: 50 }) })
  const owners = useQuery({ queryKey: ['fleet', 'owner-options'], queryFn: () => shipOwnerApi.list({ limit: 100 }) })
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const ranks = useQuery({ queryKey: ['lookup', 'ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data) })

  const vesselRows = vessels.data?.data || []
  const vesselOptions = vesselRows.map((row) => ({ value: row.id, label: row.imo_number ? `${row.vessel_name} · IMO ${row.imo_number}` : row.vessel_name, ownerId: row.ship_owner_id }))
  if (voyage && !vesselRows.some((row) => row.id === voyage.vessel_id)) vesselOptions.unshift({ value: voyage.vessel_id, label: voyage.vessel_name })
  const ownerOptions = (owners.data?.data || []).map((row) => ({ value: row.id, label: row.company_name }))
  if (voyage && !ownerOptions.some((o) => o.value === voyage.ship_owner_id)) ownerOptions.push({ value: voyage.ship_owner_id, label: voyage.ship_owner_name })
  const portOptions = (ports.data || []).map((row) => ({ value: row.id, label: row.name }))
  const rankOptions = (ranks.data || []).map((row) => ({ value: row.id, label: row.name_en ? `${row.name_vi} (${row.name_en})` : row.name_vi }))

  const months = safeMonths(values.planned_embark_date, values.planned_disembark_date)
  const positions = values.positions || []

  const changed = useMemo(() => {
    if (!isEdit) return new Set()
    const before = toPayload(initial, { started })
    const after = toPayload(values, { started })
    return new Set(Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])))
  }, [isEdit, initial, values, started])
  const cn = (name, base) => [base, changed.has(name) && 'sf-changed'].filter(Boolean).join(' ') || undefined
  const label = (name, text) => changedLabel(text, changed.has(name))
  const changeLabels = [...changed].map((key) => FIELD_LABELS[key] || key)

  const infoFields = ['vessel_id', 'ship_owner_id', 'planned_embark_date', 'embark_port_id', 'planned_disembark_date', 'disembark_port_id', 'notes', ...(started ? ['actual_embark_date', 'actual_disembark_date'] : [])]
  const infoDone = infoFields.filter((name) => (typeof values[name] === 'string' ? values[name].trim() : values[name])).length
  const sections = [
    { key: 'info', title: 'Thông tin chung', desc: started ? 'Ngày thực tế được ghi khi bấm Bắt đầu chuyến và Kết thúc chuyến. Sửa ở đây khi nhập sai.' : 'Dùng chung cho mọi vị trí của chuyến. Hợp đồng lấy ngày ở đây làm mặc định.' },
    { key: 'positions', title: 'Vị trí dự kiến', desc: 'Budget dự kiến là số chủ tàu sẵn sàng trả cho mỗi chỗ. Nhập tổng chuyến hoặc mỗi tháng, ô kia tự tính theo số tháng của chuyến. Cần 2 AB thì thêm 2 dòng.' },
  ]
  const metas = [`${infoDone}/${infoFields.length}`, `${positions.length}`]
  const budgetTotal = positions.reduce((sum, p) => sum + Number(p?.budget_total_usd || 0), 0)
  const budgetMonthly = positions.reduce((sum, p) => sum + Number(p?.budget_monthly_usd || 0), 0)
  const ready = !!(values.vessel_id && values.ship_owner_id && values.planned_embark_date && values.planned_disembark_date && positions.length && positions.every((p) => p?.rank_id))
  const selectedVessel = vesselOptions.find((o) => o.value === values.vessel_id)
  const selectedOwner = ownerOptions.find((o) => o.value === values.ship_owner_id)

  // Sửa ô nào thì ô kia tự tính; đổi ngày dự kiến thì giữ tổng chuyến và tính lại mỗi tháng.
  function onValuesChange(change, all) {
    const rows = all.positions || []
    if ('planned_embark_date' in change || 'planned_disembark_date' in change) {
      const m = safeMonths(all.planned_embark_date, all.planned_disembark_date)
      if (!m) return
      form.setFieldsValue({ positions: rows.map((p) => (p?.budget_total_usd == null ? p : { ...p, budget_monthly_usd: splitBudget({ total: p.budget_total_usd, months: m }).monthly })) })
      return
    }
    if (!change.positions || !months) return
    const next = rows.map((p) => ({ ...p }))
    change.positions.forEach((item, index) => {
      if (!item) return
      if ('budget_total_usd' in item) {
        next[index].budget_monthly_usd = item.budget_total_usd == null ? null : splitBudget({ total: item.budget_total_usd, months }).monthly
      } else if ('budget_monthly_usd' in item) {
        next[index].budget_total_usd = item.budget_monthly_usd == null ? null : splitBudget({ monthly: item.budget_monthly_usd, months }).total
      }
    })
    form.setFieldsValue({ positions: next })
  }

  function onVesselChange(_, option) {
    if (option?.ownerId) {
      form.setFieldsValue({ ship_owner_id: option.ownerId })
      setOwnerFromVessel(true)
    } else {
      setOwnerFromVessel(false)
    }
  }

  async function submit(formValues) {
    try {
      const row = await save.mutateAsync({ id: voyage?.id, ...toPayload(formValues, { started }) })
      toast.success(isEdit ? `Đã lưu chuyến ${row.code}` : `Đã tạo chuyến ${row.code}`)
      if (againRef.current) {
        form.resetFields()
        setOwnerFromVessel(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate(`/voyages/${row.id}`)
      }
    } catch (error) {
      toast.error(apiErrorText(error, 'Không lưu được. Thử lại sau.'))
    }
  }

  const gridCol = started ? 'sf-c4' : 'sf-c6'
  const dateRules = (name) => [
    { required: true, message: name === 'start' ? 'Chọn ngày xuống tàu dự kiến' : 'Chọn ngày rời tàu dự kiến' },
    ...(name === 'end'
      ? [{
          validator: (_, value) => {
            const start = form.getFieldValue('planned_embark_date')
            return !value || !start || !value.isBefore(start, 'day') ? Promise.resolve() : Promise.reject(new Error('Ngày rời tàu phải sau hoặc bằng ngày xuống tàu'))
          },
        }]
      : []),
  ]

  return (
    <FormFrame
      crumbs={isEdit ? [{ label: 'Chuyến tàu', to: '/voyages' }, { label: voyage.code, to: `/voyages/${voyage.id}` }, { label: 'Sửa chuyến' }] : [{ label: 'Chuyến tàu', to: '/voyages' }, { label: 'Tạo chuyến tàu' }]}
      title={isEdit ? 'Sửa chuyến tàu' : 'Tạo chuyến tàu'}
      description={isEdit ? `${voyage.vessel_name} · ${voyage.code}` : 'Thông tin chung của chuyến và các vị trí cần người. Hợp đồng tạo sau, từ từng vị trí.'}
      tile={<FleetTile large />}
      name={selectedVessel?.label.split(' · IMO')[0] || (isEdit ? voyage.vessel_name : 'Chuyến mới')}
      sub={isEdit ? voyage.code : selectedOwner?.label}
      sections={sections}
      stats={metas}
      done={infoDone + positions.filter((p) => p?.rank_id).length}
      total={infoFields.length + positions.length}
    >
      <Form form={form} layout="vertical" requiredMark className="sf-sections" initialValues={initial} onFinish={submit} onValuesChange={onValuesChange} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <FormSection index={0} section={sections[0]} meta={metas[0]}>
          <div className="sf-grid">
            <Form.Item name="vessel_id" className={cn('vessel_id', 'sf-c6')} label={label('vessel_id', 'Tàu')} rules={[{ required: true, message: 'Chọn tàu' }]}>
              <Select {...selectProps} allowClear={false} filterOption={false} onSearch={setVesselSearch} onChange={onVesselChange} loading={vessels.isLoading} options={vesselOptions} placeholder="Chọn tàu" />
            </Form.Item>
            <Form.Item name="ship_owner_id" className={cn('ship_owner_id', 'sf-c6')} label={label('ship_owner_id', 'Chủ tàu')} rules={[{ required: true, message: 'Chọn chủ tàu' }]} extra={ownerFromVessel ? 'Lấy theo tàu' : undefined}>
              <Select {...selectProps} allowClear={false} loading={owners.isLoading} options={ownerOptions} placeholder="Chọn chủ tàu" onChange={() => setOwnerFromVessel(false)} />
            </Form.Item>
            <Form.Item name="planned_embark_date" className={cn('planned_embark_date', gridCol)} label={label('planned_embark_date', 'Ngày xuống tàu dự kiến')} rules={dateRules('start')} dependencies={['planned_disembark_date']}>
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
            </Form.Item>
            {started ? (
              <Form.Item name="actual_embark_date" className={cn('actual_embark_date', gridCol)} label={label('actual_embark_date', 'Ngày xuống tàu thực tế')} extra="Ghi khi bấm Bắt đầu chuyến">
                <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
            ) : null}
            <Form.Item name="embark_port_id" className={cn('embark_port_id', gridCol)} label={label('embark_port_id', 'Nơi xuống tàu')}>
              <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="planned_disembark_date" className={cn('planned_disembark_date', gridCol)} label={label('planned_disembark_date', 'Ngày rời tàu dự kiến')} rules={dateRules('end')} dependencies={['planned_embark_date']} extra={months != null ? formatMonths(months) : undefined}>
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
            </Form.Item>
            {started ? (
              <Form.Item name="actual_disembark_date" className={cn('actual_disembark_date', gridCol)} label={label('actual_disembark_date', 'Ngày rời tàu thực tế')} extra="Ghi khi bấm Kết thúc chuyến">
                <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
              </Form.Item>
            ) : null}
            <Form.Item name="disembark_port_id" className={cn('disembark_port_id', gridCol)} label={label('disembark_port_id', 'Nơi rời tàu')}>
              <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="notes" className={cn('notes')} label={label('notes', 'Ghi chú')}>
              <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Yêu cầu của chủ tàu, lịch bay…" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={1} section={sections[1]} meta={`${positions.length} vị trí`}>
          <div className={`vp${changed.has('positions') ? ' vp--changed' : ''}`}>
            <div className="vp__head" role="row">
              <span>#</span>
              <span>Chức danh<span className="vp__req">*</span></span>
              <span>Cả chuyến<span className="vp__req">*</span></span>
              <span>Mỗi tháng<span className="vp__req">*</span></span>
              <span />
            </div>
            <Form.List name="positions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => {
                    const row = positions[index]
                    const locked = !!row?.hasContract
                    return (
                      <div className="vp__row" key={field.key}>
                        {/* id và hasContract không có ô nhập nên phải đăng ký, nếu không useWatch và onFinish làm rơi chúng. */}
                        <Form.Item name={[field.name, 'id']} hidden noStyle><Input /></Form.Item>
                        <Form.Item name={[field.name, 'hasContract']} hidden noStyle><Input /></Form.Item>
                        <span className="vp__n">{index + 1}</span>
                        <Form.Item className="vp__rank" name={[field.name, 'rank_id']} rules={[{ required: true, message: 'Chọn chức danh' }]}>
                          <Select {...selectProps} allowClear={false} loading={ranks.isLoading} options={rankOptions} placeholder="Chọn chức danh" aria-label={`Chức danh dòng ${index + 1}`} />
                        </Form.Item>
                        <Form.Item className="vp__m1" name={[field.name, 'budget_total_usd']} rules={[{ required: true, message: 'Nhập budget' }]}>
                          <MoneyInput aria-label={`Tổng chuyến dòng ${index + 1}`} />
                        </Form.Item>
                        <Form.Item className="vp__m2" name={[field.name, 'budget_monthly_usd']} rules={[{ required: true, message: 'Nhập budget' }]}>
                          <MoneyInput aria-label={`Mỗi tháng dòng ${index + 1}`} />
                        </Form.Item>
                        <span className="vp__actions">
                          <Tooltip title="Nhân đôi dòng">
                            <Button type="text" icon={<CopyOutlined />} aria-label={`Nhân đôi dòng ${index + 1}`} onClick={() => add({ rank_id: row?.rank_id, budget_total_usd: row?.budget_total_usd ?? null, budget_monthly_usd: row?.budget_monthly_usd ?? null }, index + 1)} />
                          </Tooltip>
                          <Tooltip title={locked ? 'Vị trí đã có hợp đồng, không xoá được' : fields.length === 1 ? 'Chuyến cần ít nhất một vị trí' : 'Xoá dòng'}>
                            <span>
                              <Button type="text" icon={<CloseOutlined />} aria-label={`Xoá dòng ${index + 1}`} disabled={locked || fields.length === 1} onClick={() => remove(field.name)} />
                            </span>
                          </Tooltip>
                        </span>
                      </div>
                    )
                  })}
                  <div className="vp__add">
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ ...BLANK_POSITION })}>Thêm vị trí</Button>
                  </div>
                </>
              )}
            </Form.List>
            <p className="vp__total">
              {positions.length} vị trí · budget dự kiến{months != null ? ` · ${formatMonths(months)}` : ''}
              <b>{formatUsd(budgetTotal)} USD · {formatUsd(budgetMonthly)} USD/tháng</b>
            </p>
          </div>
        </FormSection>

        <div className="sf-savebar">
          {isEdit ? (
            <div className="sf-savebar__count">
              <b>{changeLabels.length ? `${changeLabels.length} thay đổi` : 'Chưa có thay đổi'}</b>
              {changeLabels.length ? <span title={changeLabels.join(', ')}>{changeLabels.join(', ')}</span> : null}
            </div>
          ) : (
            <div className={`sf-savebar__msg${ready ? ' sf-savebar__msg--ok' : ''}`}>
              {ready ? <CheckCircleFilled aria-hidden /> : <InfoCircleOutlined aria-hidden />}
              <span>{ready ? 'Lưu xong sang trang chuyến để tạo hợp đồng cho từng vị trí.' : 'Chọn tàu, chủ tàu, ngày và ít nhất một vị trí để tạo chuyến.'}</span>
            </div>
          )}
          <div className="sf-savebar__actions">
            <Button onClick={() => navigate(isEdit ? `/voyages/${voyage.id}` : '/voyages')}>Huỷ</Button>
            {isEdit ? null : (
              <Button
                loading={save.isPending && again}
                disabled={save.isPending}
                onClick={() => {
                  againRef.current = true
                  setAgain(true)
                  form.submit()
                }}
              >
                Lưu & tạo chuyến khác
              </Button>
            )}
            <Button
              type="primary"
              htmlType="submit"
              icon={isEdit ? undefined : <PlusOutlined />}
              loading={save.isPending && !again}
              disabled={isEdit && !changed.size}
              onClick={() => {
                againRef.current = false
                setAgain(false)
              }}
            >
              {isEdit ? 'Lưu thay đổi' : 'Tạo chuyến tàu'}
            </Button>
          </div>
        </div>
      </Form>
    </FormFrame>
  )
}

export default function VoyageFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useVoyage(id)

  if (id && isLoading) {
    return (
      <div className="ds-page">
        <div className="crew-panel crew-panel__body"><Skeleton active paragraph={{ rows: 8 }} /></div>
      </div>
    )
  }
  if (id && (isError || !data)) {
    return (
      <EmptyState
        isError={isError}
        title={isError ? 'Không tải được chuyến tàu' : 'Không tìm thấy chuyến tàu'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/voyages')}>Về danh sách</Button>}
      />
    )
  }
  return <VoyageForm key={data?.id || 'new'} voyage={id ? data : null} />
}
