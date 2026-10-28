import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { App, Button, DatePicker, Form, Input, Select, Skeleton } from 'antd'
import { CheckCircleFilled, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { EmptyState } from '../../../components/ds/Controls'
import MoneyInput from '../../../components/ds/MoneyInput'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { usersApi } from '../../../api/usersApi'
import { shipOwnerApi, vesselApi } from '../../../api/fleetApi'
import { opportunityApi } from '../../../api/opportunityApi'
import { useOpportunity, useOpportunityMutations } from '../../../hooks/useOpportunities'
import { useCan } from '../../../hooks/usePermission'
import useAuthStore from '../../../stores/authStore'
import apiErrorText from '../../../utils/apiError'
import { formatUsd } from '../../../utils/format'
import { withFlag } from '../../../utils/flag'
import { FleetTile, TargetSvg, FormFrame, FormSection } from '../fleet/FleetParts'
import changedLabel from '../fleet/changedLabel'
import { monthsBetween, splitBudget } from '../voyages/voyageView'
import RequirementTable from './RequirementTable'
import { EMPTY_FORM, nextPositionValues, toFormValues, toPayload, toRequirementRows } from './opportunityView'
import '../fleet/fleet.css'
import './opportunities.css'

const DATE_FORMAT = 'DD/MM/YYYY'
const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' } }
const FIELD_LABELS = {
  ship_owner_id: 'Chủ tàu', vessel_id: 'Tàu', rank_id: 'Chức danh', budget_monthly_usd: 'Budget/tháng', budget_total_usd: 'Budget cả chuyến',
  planned_join_date: 'Ngày xuống tàu', planned_join_port_id: 'Nơi xuống tàu', planned_leave_date: 'Ngày rời tàu', planned_leave_port_id: 'Nơi rời tàu',
  deadline: 'Hạn chốt', owner_user_id: 'Người phụ trách', notes: 'Ghi chú', requirements: 'Hồ sơ yêu cầu',
}
const PRESET_SOURCE = { VESSEL: 'Điền sẵn từ yêu cầu chứng chỉ của tàu cho chức danh này.', RANK: 'Điền sẵn từ mẫu của chức danh.', NONE: 'Chưa có mẫu cho chức danh này.' }

function safeMonths(start, end) {
  if (!start || !end) return null
  try {
    return monthsBetween(dayjs(start).format('YYYY-MM-DD'), dayjs(end).format('YYYY-MM-DD'))
  } catch {
    return null
  }
}
const formatMonths = (months) => `${String(months).replace('.', ',')} tháng`

function OpportunityForm({ opportunity, prefill }) {
  const isEdit = !!opportunity
  const can = useCan()
  const navigate = useNavigate()
  const toast = useToast()
  const { modal } = App.useApp()
  const me = useAuthStore((state) => state.user)
  const [form] = Form.useForm()
  const initial = useMemo(() => (opportunity ? toFormValues(opportunity) : { ...EMPTY_FORM, owner_user_id: me?.id, ...prefill }), [opportunity, prefill, me])
  const values = Form.useWatch([], form) || initial
  const { save } = useOpportunityMutations()
  const againRef = useRef(false)
  const [again, setAgain] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [ownerFromVessel, setOwnerFromVessel] = useState(false)
  const [presetSource, setPresetSource] = useState(null)

  const vessels = useQuery({ queryKey: ['fleet', 'vessel-options', vesselSearch, values.ship_owner_id], queryFn: () => vesselApi.list({ search: vesselSearch || undefined, ship_owner_id: values.ship_owner_id || undefined, limit: 50 }) })
  const owners = useQuery({ queryKey: ['fleet', 'owner-options'], queryFn: () => shipOwnerApi.list({ limit: 100 }) })
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const ranks = useQuery({ queryKey: ['lookup', 'ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data) })
  const certTypes = useQuery({ queryKey: ['lookup', 'certificate-types'], queryFn: () => lookupApi.certificateTypes().then((r) => r.data) })
  const vesselTypes = useQuery({ queryKey: ['lookup', 'vessel-types'], queryFn: () => lookupApi.vesselTypes().then((r) => r.data) })
  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list({ limit: 100 }).then((r) => r.data), enabled: can('account.view') })

  const categoryOf = (id) => (certTypes.data || []).find((c) => c.id === id)?.category
  const vesselRows = vessels.data?.data || []
  const vesselOptions = vesselRows.map((row) => ({ value: row.id, label: row.imo_number ? `${row.vessel_name} · IMO ${row.imo_number}` : row.vessel_name, ownerId: row.ship_owner_id }))
  if (opportunity?.vessel_id && !vesselRows.some((row) => row.id === opportunity.vessel_id)) vesselOptions.unshift({ value: opportunity.vessel_id, label: opportunity.vessel_name, ownerId: opportunity.ship_owner_id })
  const ownerOptions = (owners.data?.data || []).map((row) => ({ value: row.id, label: row.company_name }))
  const portOptions = (ports.data || []).map((row) => ({ value: row.id, label: row.country_name ? `${row.name} (${withFlag(row.country_code, row.country_name, row.country_flag_emoji)})` : row.name }))
  const rankOptions = (ranks.data || []).map((row) => ({ value: row.id, label: row.name_en ? `${row.name_vi} (${row.name_en})` : row.name_vi }))
  const userRows = users.data?.data || users.data || []
  const userOptions = Array.isArray(userRows) ? userRows.map((u) => ({ value: u.id, label: u.email })) : []
  if (!userOptions.some((u) => u.value === values.owner_user_id)) {
    const email = opportunity?.owner_user_email || (values.owner_user_id === me?.id ? me?.email : null)
    if (email) userOptions.unshift({ value: values.owner_user_id, label: email })
  }

  const months = safeMonths(values.planned_join_date, values.planned_leave_date)
  const requirements = values.requirements || []
  const rankName = (ranks.data || []).find((r) => r.id === values.rank_id)?.name_vi

  const changed = useMemo(() => {
    if (!isEdit) return new Set()
    const before = toPayload(initial, categoryOf)
    const after = toPayload(values, categoryOf)
    return new Set(Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])))
    // categoryOf đổi theo certTypes; so sánh lại khi danh mục tải xong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initial, values, certTypes.data])
  const cn = (name, base) => [base, changed.has(name) && 'sf-changed'].filter(Boolean).join(' ') || undefined
  const label = (name, text) => changedLabel(text, changed.has(name))
  const changeLabels = [...changed].map((key) => FIELD_LABELS[key] || key)

  const coreFields = ['ship_owner_id', 'vessel_id', 'rank_id', 'budget_monthly_usd', 'owner_user_id']
  const timeFields = ['planned_join_date', 'planned_join_port_id', 'planned_leave_date', 'planned_leave_port_id', 'deadline']
  const filled = (names) => names.filter((name) => values[name] != null && values[name] !== '').length
  const sections = [
    { key: 'position', title: 'Vị trí', desc: 'Một cơ hội là một vị trí. Cần nhiều vị trí thì dùng "Lưu & thêm vị trí khác".' },
    { key: 'time', title: 'Thời gian dự kiến', desc: 'Bốn mốc dự kiến và hạn chủ tàu cần danh sách.' },
    { key: 'requirements', title: 'Hồ sơ yêu cầu', desc: presetSource ? PRESET_SOURCE[presetSource] : 'Giấy tờ ứng viên phải có, biểu mẫu phải nộp và kinh nghiệm. Chọn chức danh thì tự điền sẵn.' },
  ]
  const metas = [`${filled(coreFields)}/${coreFields.length}`, `${filled(timeFields)}/${timeFields.length}`, `${requirements.length}`]
  const ready = !!(values.ship_owner_id && values.rank_id && values.budget_monthly_usd != null && values.planned_join_date && values.planned_leave_date && values.deadline)
  const selectedVessel = vesselOptions.find((o) => o.value === values.vessel_id)
  const vesselHasNoOwner = Boolean(selectedVessel) && !selectedVessel.ownerId
  const selectedOwner = ownerOptions.find((o) => o.value === values.ship_owner_id)

  // Hồ sơ yêu cầu điền sẵn khi chọn chức danh (và tàu). Bảng đã có dòng thì hỏi trước khi thay.
  async function loadPreset(all) {
    if (!all.rank_id) return
    const preset = await opportunityApi.presets({ rank_id: all.rank_id, vessel_id: all.vessel_id || undefined }).catch(() => null)
    if (!preset) return
    const apply = () => {
      form.setFieldsValue({ requirements: toRequirementRows(preset.requirements) })
      setPresetSource(preset.source)
    }
    if (!(all.requirements || []).length) return apply()
    if (!preset.requirements.length) return setPresetSource(preset.source)
    modal.confirm({
      title: `Thay hồ sơ yêu cầu theo ${(ranks.data || []).find((r) => r.id === all.rank_id)?.name_vi || 'chức danh mới'}?`,
      content: `${PRESET_SOURCE[preset.source]} Bảng hiện có ${all.requirements.length} dòng sẽ được thay.`,
      okText: 'Thay',
      cancelText: 'Giữ bảng hiện tại',
      onOk: apply,
    })
  }

  // Sửa ô budget nào thì ô kia tự tính; đổi ngày thì giữ budget/tháng, tính lại cả chuyến.
  function onValuesChange(change, all) {
    const m = safeMonths(all.planned_join_date, all.planned_leave_date)
    if (('rank_id' in change || 'vessel_id' in change) && !isEdit) loadPreset(all)
    if ('budget_monthly_usd' in change && m) {
      form.setFieldsValue({ budget_total_usd: change.budget_monthly_usd == null ? null : splitBudget({ monthly: change.budget_monthly_usd, months: m }).total })
    } else if ('budget_total_usd' in change && m) {
      form.setFieldsValue({ budget_monthly_usd: change.budget_total_usd == null ? null : splitBudget({ total: change.budget_total_usd, months: m }).monthly })
    } else if (('planned_join_date' in change || 'planned_leave_date' in change) && m && all.budget_monthly_usd != null) {
      form.setFieldsValue({ budget_total_usd: splitBudget({ monthly: all.budget_monthly_usd, months: m }).total })
    }
  }

  function onOwnerChange(ownerId) {
    setOwnerFromVessel(false)
    const current = vesselOptions.find((o) => o.value === form.getFieldValue('vessel_id'))
    if (ownerId && current?.ownerId && current.ownerId !== ownerId) form.setFieldsValue({ vessel_id: undefined })
  }

  function onVesselChange(_, option) {
    if (option?.ownerId) {
      form.setFieldsValue({ ship_owner_id: option.ownerId })
      setOwnerFromVessel(true)
    } else {
      // Tàu vô chủ: không có chủ tàu để chọn, bỏ chủ tàu đang chọn (nếu có) để khỏi lưu lệch.
      if (option) form.setFieldsValue({ ship_owner_id: undefined })
      setOwnerFromVessel(false)
    }
  }

  async function submit(formValues) {
    try {
      const row = await save.mutateAsync({ id: opportunity?.id, ...toPayload(formValues, categoryOf) })
      if (againRef.current) {
        toast.success(`Đã tạo ${row.code} · ${row.rank_name}`)
        form.setFieldsValue(nextPositionValues(form.getFieldsValue(true)))
        setPresetSource(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        toast.success(isEdit ? `Đã lưu cơ hội ${row.code}` : `Đã tạo ${row.code} · ${row.rank_name}`)
        navigate(`/opportunities/${row.id}`)
      }
    } catch (error) {
      toast.error(isEdit ? 'Không lưu được cơ hội' : 'Không tạo được cơ hội', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const leaveRule = {
    validator: (_, value) => {
      const start = form.getFieldValue('planned_join_date')
      return !value || !start || !value.isBefore(start, 'day') ? Promise.resolve() : Promise.reject(new Error('Ngày rời tàu phải sau hoặc bằng ngày xuống tàu'))
    },
  }

  return (
    <FormFrame
      crumbs={isEdit ? [{ label: 'Cơ hội', to: '/opportunities' }, { label: opportunity.code, to: `/opportunities/${opportunity.id}` }, { label: 'Sửa cơ hội' }] : [{ label: 'Cơ hội', to: '/opportunities' }, { label: 'Tạo cơ hội' }]}
      title={isEdit ? 'Sửa cơ hội' : 'Tạo cơ hội'}
      description={isEdit ? `${opportunity.rank_name} · ${opportunity.code}` : undefined}
      tile={<FleetTile large icon={TargetSvg} />}
      name={rankName || (isEdit ? opportunity.rank_name : 'Cơ hội mới')}
      sub={[selectedVessel?.label.split(' · IMO')[0], selectedOwner?.label].filter(Boolean).join(' · ') || undefined}
      sections={sections}
      stats={metas}
      done={filled(coreFields) + filled(timeFields)}
      total={coreFields.length + timeFields.length}
    >
      <Form form={form} layout="vertical" requiredMark className="sf-sections" initialValues={initial} onFinish={submit} onValuesChange={onValuesChange} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <FormSection index={0} section={sections[0]} meta={metas[0]}>
          <div className="sf-grid">
            <Form.Item name="ship_owner_id" className={cn('ship_owner_id', 'sf-c4')} label={label('ship_owner_id', 'Chủ tàu')} rules={[{ required: true, message: vesselHasNoOwner ? 'Tàu này chưa có chủ tàu. Gán chủ tàu cho tàu trước khi dùng.' : 'Chọn chủ tàu' }]} extra={vesselHasNoOwner ? 'Tàu chưa có chủ tàu' : ownerFromVessel ? 'Lấy theo tàu' : undefined}>
              <Select {...selectProps} loading={owners.isLoading} options={vesselHasNoOwner ? [] : ownerOptions} disabled={vesselHasNoOwner} placeholder="Chọn chủ tàu" onChange={onOwnerChange} />
            </Form.Item>
            <Form.Item name="vessel_id" className={cn('vessel_id', 'sf-c4')} label={label('vessel_id', 'Tàu')} extra="Để trống nếu chủ tàu chưa báo tàu. Phải có khi chốt.">
              <Select {...selectProps} filterOption={false} onSearch={setVesselSearch} onChange={onVesselChange} loading={vessels.isLoading} options={vesselOptions} placeholder="Chọn tàu" />
            </Form.Item>
            <Form.Item name="rank_id" className={cn('rank_id', 'sf-c4')} label={label('rank_id', 'Chức danh')} rules={[{ required: true, message: 'Chọn chức danh' }]}>
              <Select {...selectProps} loading={ranks.isLoading} options={rankOptions} placeholder="Chọn chức danh" />
            </Form.Item>
            <Form.Item name="budget_monthly_usd" className={cn('budget_monthly_usd', 'sf-c4')} label={label('budget_monthly_usd', 'Budget/tháng (USD)')} rules={[{ required: true, message: 'Nhập budget/tháng' }]}>
              <MoneyInput aria-label="Budget mỗi tháng" />
            </Form.Item>
            <Form.Item name="budget_total_usd" className={cn('budget_total_usd', 'sf-c4')} label={label('budget_total_usd', 'Budget cả chuyến (USD)')} extra={months != null ? `Tính theo ngày xuống → rời: ${formatMonths(months)}. Sửa ô nào ô kia tự tính.` : 'Nhập ngày xuống và rời để tự tính.'}>
              <MoneyInput aria-label="Budget cả chuyến" />
            </Form.Item>
            <Form.Item name="owner_user_id" className={cn('owner_user_id', 'sf-c4')} label={label('owner_user_id', 'Người phụ trách')} extra={can('account.view') ? undefined : 'Mặc định là bạn'}>
              <Select {...selectProps} disabled={!can('account.view')} loading={users.isLoading} options={userOptions} placeholder="Chọn người phụ trách" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={1} section={sections[1]} meta={metas[1]}>
          <div className="sf-grid">
            <Form.Item name="planned_join_date" className={cn('planned_join_date', 'sf-c3')} label={label('planned_join_date', 'Ngày xuống tàu')} rules={[{ required: true, message: 'Chọn ngày xuống tàu' }]} dependencies={['planned_leave_date']}>
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="planned_join_port_id" className={cn('planned_join_port_id', 'sf-c3')} label={label('planned_join_port_id', 'Nơi xuống tàu')}>
              <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="planned_leave_date" className={cn('planned_leave_date', 'sf-c3')} label={label('planned_leave_date', 'Ngày rời tàu')} rules={[{ required: true, message: 'Chọn ngày rời tàu' }, leaveRule]} dependencies={['planned_join_date']}>
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="planned_leave_port_id" className={cn('planned_leave_port_id', 'sf-c3')} label={label('planned_leave_port_id', 'Nơi rời tàu')}>
              <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="deadline" className={cn('deadline', 'sf-c3')} label={label('deadline', 'Hạn chốt')} rules={[{ required: true, message: 'Chọn hạn chốt' }]} extra="Ngày chủ tàu cần danh sách">
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="notes" className={cn('notes')} label={label('notes', 'Ghi chú')}>
              <Input.TextArea rows={2} maxLength={2000} showCount placeholder="Yêu cầu riêng của chủ tàu, ưu tiên…" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={2} section={sections[2]} meta={`${requirements.length} yêu cầu`}>
          <Form.Item name="requirements" noStyle>
            <RequirementTable
              certTypes={certTypes.data || []}
              ranks={ranks.data || []}
              vesselTypes={vesselTypes.data || []}
              changed={changed.has('requirements')}
            />
          </Form.Item>
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
              <span>
                {ready
                  ? `${rankName || 'Vị trí'} · ${formatUsd(values.budget_monthly_usd)} USD/tháng · ${values.planned_join_date ? dayjs(values.planned_join_date).format(DATE_FORMAT) : ''} → ${values.planned_leave_date ? dayjs(values.planned_leave_date).format(DATE_FORMAT) : ''}`
                  : 'Chọn chủ tàu, chức danh, budget, ngày xuống, ngày rời và hạn chốt để tạo cơ hội.'}
              </span>
            </div>
          )}
          <div className="sf-savebar__actions">
            <Button onClick={() => navigate(isEdit ? `/opportunities/${opportunity.id}` : '/opportunities')}>Huỷ</Button>
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
                Lưu & thêm vị trí khác
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
              {isEdit ? 'Lưu thay đổi' : 'Tạo cơ hội'}
            </Button>
          </div>
        </div>
      </Form>
    </FormFrame>
  )
}

// Điền sẵn từ đường dẫn: /opportunities/new?owner=&vessel=&rank=&join= (Tạo cơ hội tìm người thay, Tạo cơ hội thay).
function prefillFrom(params) {
  const num = (key) => (params.get(key) ? Number(params.get(key)) : undefined)
  const join = params.get('join')
  return Object.fromEntries(Object.entries({
    ship_owner_id: num('owner'),
    vessel_id: num('vessel'),
    rank_id: num('rank'),
    planned_join_date: join ? dayjs(join) : undefined,
  }).filter(([, v]) => v !== undefined))
}

export default function OpportunityFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useOpportunity(id)
  const prefill = useMemo(() => prefillFrom(params), [params])

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
        title={isError ? 'Không tải được cơ hội' : 'Không tìm thấy cơ hội'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/opportunities')}>Về danh sách</Button>}
      />
    )
  }
  if (id && data.status !== 'OPEN') {
    return (
      <EmptyState
        title={`Cơ hội ${data.code} đã đóng, không sửa được`}
        action={<Button onClick={() => navigate(`/opportunities/${data.id}`)}>Mở cơ hội</Button>}
      />
    )
  }
  return <OpportunityForm key={data?.id || 'new'} opportunity={id ? data : null} prefill={prefill} />
}
