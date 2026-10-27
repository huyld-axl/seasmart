import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Select } from 'antd'
import { CheckCircleFilled, ExclamationCircleOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import MoneyInput from '../../../components/ds/MoneyInput'
import ToggleRow from '../../../components/ds/ToggleRow'
import useToast from '../../../components/ds/useToast'
import { lookupApi, seafarerApi } from '../../../api'
import { shipOwnerApi, vesselApi } from '../../../api/fleetApi'
import { voyageApi } from '../../../api/voyageApi'
import { useVoyageMutations } from '../../../hooks/useVoyages'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { withFlag } from '../../../utils/flag'
import { MANUAL_REASONS, MANUAL_REASON_LABELS } from '../../../constants/opportunityVoyage'
import { FleetTile, FormFrame, FormSection } from '../fleet/FleetParts'
import { nextVoyageValues, toVoyagePayload, voyagePrefill } from './voyageList'
import '../fleet/fleet.css'

const DATE_FORMAT = 'DD/MM/YYYY'
const selectProps = { allowClear: true, showSearch: { optionFilterProp: 'label' } }
const REASON_OPTIONS = MANUAL_REASONS.map((value) => ({ value, label: MANUAL_REASON_LABELS[value] }))

// Màn 9 · Tạo chuyến không qua cơ hội: chuyển tàu, chủ tàu tự tuyển, nhập chuyến cũ, khác.
// Điền sẵn từ đường dẫn: /voyages/new?seafarer=&vessel=&owner=&rank=&reason= (Chuyển sang tàu khác, + Tạo chuyến trên trang tàu).
export default function VoyageFormPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const initial = useMemo(() => voyagePrefill(params), [params])
  const values = Form.useWatch([], form) || initial
  const { create } = useVoyageMutations()
  const againRef = useRef(false)
  const [again, setAgain] = useState(false)
  const [personSearch, setPersonSearch] = useState('')
  const [vesselSearch, setVesselSearch] = useState('')
  const [ownerFromVessel, setOwnerFromVessel] = useState(false)

  const people = useQuery({
    queryKey: ['seafarer-pick', personSearch],
    queryFn: () => seafarerApi.list({ search: personSearch || undefined, limit: 20 }).then((r) => r.data.data),
  })
  const person = useQuery({
    queryKey: ['seafarer', String(values.seafarer_id)],
    queryFn: () => seafarerApi.getById(values.seafarer_id).then((r) => r.data),
    enabled: !!values.seafarer_id,
  })
  const onboard = useQuery({
    queryKey: ['voyages', 'list', { seafarer_id: values.seafarer_id, tab: 'onboard' }],
    queryFn: () => voyageApi.list({ seafarer_id: values.seafarer_id, tab: 'onboard', limit: 1 }),
    enabled: !!values.seafarer_id,
  })
  const vessels = useQuery({ queryKey: ['fleet', 'vessel-options', vesselSearch], queryFn: () => vesselApi.list({ search: vesselSearch || undefined, limit: 50 }) })
  const owners = useQuery({ queryKey: ['fleet', 'owner-options'], queryFn: () => shipOwnerApi.list({ limit: 100 }) })
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const ranks = useQuery({ queryKey: ['lookup', 'ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data) })

  // Người điền sẵn từ đường dẫn: lấy chức danh hiện tại khi hồ sơ tải xong.
  useEffect(() => {
    if (person.data?.current_rank_id && !form.getFieldValue('rank_id')) form.setFieldsValue({ rank_id: person.data.current_rank_id })
  }, [person.data, form])

  const personRows = people.data || []
  const personOptions = personRows.map((s) => ({ value: s.id, label: s.seafarer_code ? `${s.full_name} · ${s.seafarer_code}` : s.full_name, rankId: s.current_rank_id }))
  if (person.data && !personOptions.some((o) => o.value === person.data.id)) personOptions.unshift({ value: person.data.id, label: person.data.full_name, rankId: person.data.current_rank_id })
  const vesselRows = vessels.data?.data || []
  const vesselOptions = vesselRows.map((row) => ({ value: row.id, label: row.imo_number ? `${row.vessel_name} · IMO ${row.imo_number}` : row.vessel_name, ownerId: row.ship_owner_id }))
  const ownerOptions = (owners.data?.data || []).map((row) => ({ value: row.id, label: row.company_name }))
  const portOptions = (ports.data || []).map((row) => ({ value: row.id, label: row.country_name ? `${row.name} (${withFlag(row.country_code, row.country_name, row.country_flag_emoji)})` : row.name }))
  const rankOptions = (ranks.data || []).map((row) => ({ value: row.id, label: row.name_en ? `${row.name_vi} (${row.name_en})` : row.name_vi }))

  const current = values.seafarer_id ? onboard.data?.data?.[0] : null
  const name = person.data?.full_name || personOptions.find((o) => o.value === values.seafarer_id)?.label?.split(' · ')[0]
  const isTransfer = values.manual_reason === 'TRANSFER'
  const blocked = !!current && !isTransfer && !values.ended
  const joinPort = portOptions.find((o) => o.value === values.join_port_id)?.label
  const today = dayjs().endOf('day')

  const coreFields = ['seafarer_id', 'rank_id', 'manual_reason', 'vessel_id', 'ship_owner_id']
  const timeFields = ['join_date', 'join_port_id', 'planned_leave_date']
  const filled = (names) => names.filter((key) => values[key] != null && values[key] !== '').length
  const sections = [
    { key: 'who', title: 'Người và tàu', desc: 'Chuyến tạo tay không qua cơ hội. Chọn lý do để sau này biết vì sao không qua tuyển.' },
    { key: 'time', title: 'Thời gian', desc: 'Ngày lên tàu không được sau hôm nay. Nhập chuyến cũ thì bật "Chuyến đã kết thúc".' },
  ]
  const metas = [`${filled(coreFields)}/${coreFields.length}`, `${filled(timeFields)}/${timeFields.length}`]
  const ready = filled(coreFields) === coreFields.length && filled(timeFields) === timeFields.length && !blocked
  const selectedVessel = vesselOptions.find((o) => o.value === values.vessel_id)

  function onValuesChange(change) {
    if ('seafarer_id' in change) {
      const rankId = personOptions.find((o) => o.value === change.seafarer_id)?.rankId
      if (rankId) form.setFieldsValue({ rank_id: rankId })
    }
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
    if (blocked) {
      toast.error(`${name} đang trên ${current.vessel_name}`, { description: 'Ghi rời tàu chuyến đó trước, hoặc chọn lý do Chuyển tàu.' })
      return
    }
    try {
      const row = await create.mutateAsync(toVoyagePayload(formValues))
      const closed = row.closed_voyage ? ` · đã ghi rời ${row.closed_voyage.code}` : ''
      if (againRef.current) {
        toast.success(`Đã tạo ${row.code} · ${row.seafarer_name}${closed}`)
        form.resetFields()
        form.setFieldsValue(nextVoyageValues(form.getFieldsValue(true), formValues))
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        toast.success(`Đã tạo ${row.code} · ${row.seafarer_name}${closed}`)
        navigate(`/voyages/${row.id}`)
      }
    } catch (error) {
      toast.error('Không tạo được chuyến', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const afterJoin = (message) => ({
    validator: (_, value) => {
      const start = form.getFieldValue('join_date')
      return !value || !start || !value.isBefore(start, 'day') ? Promise.resolve() : Promise.reject(new Error(message))
    },
  })

  return (
    <FormFrame
      crumbs={[{ label: 'Chuyến tàu', to: '/voyages' }, { label: 'Tạo chuyến' }]}
      title="Tạo chuyến"
      description="Mỗi chuyến là một thuyền viên đi một tàu."
      tile={<FleetTile large />}
      name={name || 'Chuyến mới'}
      sub={[rankOptions.find((o) => o.value === values.rank_id)?.label.split(' (')[0], selectedVessel?.label.split(' · IMO')[0]].filter(Boolean).join(' · ') || undefined}
      sections={sections}
      stats={metas}
      done={filled(coreFields) + filled(timeFields)}
      total={coreFields.length + timeFields.length}
    >
      <Form form={form} layout="vertical" requiredMark className="sf-sections" initialValues={initial} onFinish={submit} onValuesChange={onValuesChange} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <FormSection index={0} section={sections[0]} meta={metas[0]}>
          <div className="sf-grid">
            <Form.Item name="seafarer_id" className="sf-c4" label="Thuyền viên" rules={[{ required: true, message: 'Chọn thuyền viên' }]}>
              <Select {...selectProps} filterOption={false} onSearch={setPersonSearch} loading={people.isFetching} options={personOptions} placeholder="Tìm tên, mã thuyền viên" />
            </Form.Item>
            <Form.Item name="rank_id" className="sf-c4" label="Chức danh" rules={[{ required: true, message: 'Chọn chức danh' }]} extra="Mặc định chức danh hiện tại">
              <Select {...selectProps} allowClear={false} loading={ranks.isLoading} options={rankOptions} placeholder="Chọn chức danh" />
            </Form.Item>
            <Form.Item name="manual_reason" className="sf-c4" label="Lý do tạo không qua cơ hội" rules={[{ required: true, message: 'Chọn lý do' }]}>
              <Select {...selectProps} allowClear={false} options={REASON_OPTIONS} placeholder="Chọn lý do" />
            </Form.Item>
            {current ? (
              <div className={`ds-banner ds-banner--${blocked ? 'warning' : 'neutral'}`} role="status" style={{ gridColumn: '1 / -1' }}>
                {blocked ? <ExclamationCircleOutlined className="ds-banner__icon" aria-hidden /> : <InfoCircleOutlined className="ds-banner__icon" aria-hidden />}
                <div className="ds-banner__body">
                  <p className="ds-banner__text">
                    {values.ended
                      ? `${name} đang trên ${current.vessel_name} (${current.code}). Chuyến đã kết thúc phải nằm trước ngày lên ${formatDate(current.join_date)}.`
                      : isTransfer
                        ? `${name} đang trên ${current.vessel_name} (${current.code}). Lưu chuyến này sẽ ghi rời tàu chuyến đó ngày ${values.join_date ? dayjs(values.join_date).format(DATE_FORMAT) : '{ngày lên}'} tại ${joinPort || '{nơi lên}'} và nối hai chuyến.`
                        : `${name} đang trên ${current.vessel_name}. Ghi rời tàu chuyến đó trước, hoặc chọn lý do Chuyển tàu.`}
                  </p>
                </div>
              </div>
            ) : null}
            <Form.Item name="vessel_id" className="sf-c4" label="Tàu" rules={[{ required: true, message: 'Chọn tàu' }]}>
              <Select {...selectProps} filterOption={false} onSearch={setVesselSearch} onChange={onVesselChange} loading={vessels.isLoading} options={vesselOptions} placeholder="Chọn tàu" />
            </Form.Item>
            <Form.Item name="ship_owner_id" className="sf-c4" label="Chủ tàu" rules={[{ required: true, message: 'Chọn chủ tàu' }]} extra={ownerFromVessel ? 'Lấy theo tàu' : undefined}>
              <Select {...selectProps} allowClear={false} loading={owners.isLoading} options={ownerOptions} placeholder="Chọn chủ tàu" onChange={() => setOwnerFromVessel(false)} />
            </Form.Item>
            <Form.Item name="budget_monthly_usd" className="sf-c4" label="Budget/tháng (USD)" extra="Không bắt buộc">
              <MoneyInput aria-label="Budget mỗi tháng" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={1} section={sections[1]} meta={metas[1]}>
          <div className="sf-grid">
            <Form.Item name="join_date" className="sf-c3" label="Ngày lên tàu" rules={[{ required: true, message: 'Chọn ngày lên tàu' }]} extra="Không được sau hôm nay">
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(today)} />
            </Form.Item>
            <Form.Item name="join_port_id" className="sf-c3" label="Nơi lên tàu" rules={[{ required: true, message: 'Chọn nơi lên tàu' }]}>
              <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="planned_leave_date" className="sf-c3" label="Ngày rời dự kiến" dependencies={['join_date']} rules={[{ required: true, message: 'Chọn ngày rời dự kiến' }, afterJoin('Ngày rời dự kiến phải sau hoặc bằng ngày lên tàu')]}>
              <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="planned_leave_port_id" className="sf-c3" label="Nơi rời dự kiến">
              <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="ended" valuePropName="value" style={{ gridColumn: '1 / -1' }}>
              <ToggleRow label="Chuyến đã kết thúc" hint="Nhập chuyến cũ đã rời tàu: thêm ngày và nơi rời thực tế." />
            </Form.Item>
            {values.ended ? (
              <>
                <Form.Item name="leave_date" className="sf-c3" label="Ngày rời tàu" dependencies={['join_date']} rules={[{ required: true, message: 'Chọn ngày rời tàu' }, afterJoin('Ngày rời tàu phải sau hoặc bằng ngày lên tàu')]}>
                  <DatePicker format={DATE_FORMAT} placeholder="dd/mm/yyyy" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(today)} />
                </Form.Item>
                <Form.Item name="leave_port_id" className="sf-c3" label="Nơi rời tàu" rules={[{ required: true, message: 'Chọn nơi rời tàu' }]}>
                  <Select {...selectProps} loading={ports.isLoading} options={portOptions} placeholder="Chọn cảng" />
                </Form.Item>
                <Form.Item name="leave_note" className="sf-c6" label="Ghi chú rời">
                  <Input maxLength={500} placeholder="Ví dụ: hết hợp đồng" />
                </Form.Item>
              </>
            ) : null}
            <Form.Item
              name="notes"
              label="Ghi chú"
              style={{ gridColumn: '1 / -1' }}
              rules={[{ required: values.manual_reason === 'OTHER', whitespace: true, message: 'Lý do Khác cần ghi chú' }]}
              extra={values.manual_reason === 'OTHER' ? 'Bắt buộc khi lý do là Khác' : undefined}
            >
              <Input.TextArea rows={2} maxLength={2000} showCount placeholder="Ví dụ: chủ tàu tự tuyển qua đại lý khác" />
            </Form.Item>
          </div>
        </FormSection>

        <div className="sf-savebar">
          <div className={`sf-savebar__msg${ready ? ' sf-savebar__msg--ok' : ''}`}>
            {ready ? <CheckCircleFilled aria-hidden /> : <InfoCircleOutlined aria-hidden />}
            <span>
              {ready
                ? `${name} · ${selectedVessel?.label.split(' · IMO')[0] || ''} · lên ${dayjs(values.join_date).format(DATE_FORMAT)}`
                : blocked ? `${name} đang trên tàu khác. Chọn lý do Chuyển tàu hoặc ghi rời trước.` : 'Chọn thuyền viên, chức danh, lý do, tàu, chủ tàu, ngày lên, nơi lên và ngày rời dự kiến.'}
            </span>
          </div>
          <div className="sf-savebar__actions">
            <Button onClick={() => navigate('/voyages')}>Huỷ</Button>
            <Button
              loading={create.isPending && again}
              disabled={create.isPending}
              onClick={() => {
                againRef.current = true
                setAgain(true)
                form.submit()
              }}
            >
              Lưu & tạo chuyến khác
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<PlusOutlined />}
              loading={create.isPending && !again}
              onClick={() => {
                againRef.current = false
                setAgain(false)
              }}
            >
              Tạo chuyến
            </Button>
          </div>
        </div>
      </Form>
    </FormFrame>
  )
}
