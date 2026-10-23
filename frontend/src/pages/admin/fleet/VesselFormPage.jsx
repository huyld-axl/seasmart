import { withFlag } from '../../../utils/flag'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Select, Skeleton } from 'antd'
import { CheckCircleFilled, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { vesselApi, shipOwnerApi } from '../../../api/fleetApi'
import { useFleetItem, useFleetMutations } from '../../../hooks/useFleet'
import { isValidImo } from '../../../utils/imo'
import { ChoiceGroup } from '../seafarers/SeafarerFormParts'
import {
  VESSEL_STATUS_OPTIONS,
  CLASS_STATUS_OPTIONS,
  DP_CLASS_OPTIONS,
  vesselToFormValues,
  vesselToPayload,
  changedKeys,
  filled,
} from './fleetView'
import ToggleRow from '../../../components/ds/ToggleRow'
import { FleetTile, FormFrame, FormSection, SegmentedPick } from './FleetParts'
import changedLabel from './changedLabel'

const SECTIONS = [
  {
    key: 'id',
    title: 'Nhận dạng',
    desc: 'Ghi tên đúng như trên sổ thuyền viên để AI khớp được chuyến đi tàu.',
    fields: ['vessel_name', 'vessel_name_prev', 'imo_number', 'call_sign', 'mmsi'],
  },
  {
    key: 'reg',
    title: 'Đăng ký và phân loại',
    fields: ['vessel_type_id', 'flag_country_id', 'year_built', 'port_of_registry_id', 'classification_society', 'status', 'class_status'],
  },
  {
    key: 'spec',
    title: 'Thông số',
    desc: 'GRT, DWT đi vào CV. Để trống thì ô tương ứng trong CV xuất ra sẽ trống.',
    fields: ['gross_tonnage', 'net_tonnage', 'deadweight', 'length_overall', 'passenger_capacity', 'crew_capacity'],
  },
  { key: 'eng', title: 'Máy và thiết bị', fields: ['engine_power_kw', 'engine_type', 'dp_class'] },
  { key: 'mgmt', title: 'Quản lý', fields: ['ship_owner_id', 'technical_manager', 'commercial_manager'] },
  { key: 'notes', title: 'Ghi chú', fields: ['notes'] },
]

const FIELD_LABELS = {
  vessel_name: 'Tên tàu', vessel_name_prev: 'Tên cũ', imo_number: 'Số IMO', call_sign: 'Call Sign', mmsi: 'MMSI',
  vessel_type_id: 'Loại tàu', flag_country_id: 'Cờ quốc gia', year_built: 'Năm đóng', port_of_registry_id: 'Cảng đăng ký',
  classification_society: 'Tổ chức đăng kiểm', status: 'Trạng thái', class_status: 'Trạng thái đăng kiểm',
  gross_tonnage: 'GRT', net_tonnage: 'NT', deadweight: 'DWT', length_overall: 'LOA',
  passenger_capacity: 'Sức chứa hành khách', crew_capacity: 'Định biên thuyền viên',
  engine_power_kw: 'Công suất máy', engine_type: 'Loại động cơ', dp_class: 'DP Class', has_boiler: 'Nồi hơi', has_refrigeration: 'Lạnh',
  ship_owner_id: 'Chủ tàu', technical_manager: 'Quản lý kỹ thuật', commercial_manager: 'Quản lý thương mại', notes: 'Ghi chú',
}
const toOptions = (rows, label) => (rows || []).map((row) => ({ value: row.id, label: label(row) }))
const errorText = (error, fallback) => error?.response?.data?.error || error?.response?.data?.message || fallback
const imoRule = {
  validator: (_, value) => (!value || isValidImo(value) ? Promise.resolve() : Promise.reject(new Error('IMO có 7 chữ số và chữ số cuối phải đúng số kiểm tra'))),
}
const digitsOnly = (value) => value?.replace(/\D/g, '') || null
const selectProps = { allowClear: true, showSearch: true, optionFilterProp: 'label' }

function VesselForm({ vessel }) {
  const isEdit = !!vessel
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const initial = useMemo(() => vesselToFormValues(vessel), [vessel])
  const values = Form.useWatch([], form) || initial
  const { save } = useFleetMutations(vesselApi)
  const againRef = useRef(false)
  const [again, setAgain] = useState(false)

  const types = useQuery({ queryKey: ['lookup', 'vessel-types'], queryFn: () => lookupApi.vesselTypes().then((r) => r.data) })
  const countries = useQuery({ queryKey: ['lookup', 'countries'], queryFn: () => lookupApi.countries().then((r) => r.data) })
  const ports = useQuery({ queryKey: ['lookup', 'ports'], queryFn: () => lookupApi.ports().then((r) => r.data) })
  const owners = useQuery({ queryKey: ['fleet', 'owner-options'], queryFn: () => shipOwnerApi.list({ limit: 100 }) })

  const ownerRows = owners.data?.data || []
  const ownerOptions = toOptions(ownerRows, (row) => row.company_name)
  if (vessel?.ship_owner_id && !ownerRows.some((row) => row.id === vessel.ship_owner_id)) {
    ownerOptions.push({ value: vessel.ship_owner_id, label: vessel.ship_owner_name })
  }

  const changed = new Set(isEdit ? changedKeys(initial, values, vesselToPayload) : [])
  const stats = SECTIONS.map((section) => section.fields.filter((name) => filled(values[name])).length)
  const done = stats.reduce((sum, count) => sum + count, 0)
  const total = SECTIONS.reduce((sum, section) => sum + section.fields.length, 0)
  const cn = (name, base) => [base, changed.has(name) && 'sf-changed'].filter(Boolean).join(' ') || undefined
  const label = (name, text) => changedLabel(text, changed.has(name))
  const hasName = filled(values.vessel_name?.trim?.() ?? values.vessel_name)

  async function submit(formValues) {
    const payload = vesselToPayload(formValues)
    try {
      const row = await save.mutateAsync({ id: vessel?.id, ...payload })
      toast.success(isEdit ? `Đã lưu ${row.vessel_name}` : `Đã thêm ${row.vessel_name}`)
      if (againRef.current) {
        form.resetFields()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate(`/vessels/${row.id}`)
      }
    } catch (error) {
      toast.error(isEdit ? 'Không lưu được tàu' : 'Không thêm được tàu', { description: errorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const sectionMeta = (index) => `${stats[index]}/${SECTIONS[index].fields.length}`
  const cancelTo = isEdit ? `/vessels/${vessel.id}` : '/vessels'
  const changeLabels = [...changed].map((key) => FIELD_LABELS[key] || key)

  return (
    <FormFrame
      crumbs={isEdit ? [{ label: 'Tàu', to: '/vessels' }, { label: vessel.vessel_name, to: `/vessels/${vessel.id}` }, { label: 'Sửa' }] : [{ label: 'Tàu', to: '/vessels' }, { label: 'Thêm tàu' }]}
      title={isEdit ? 'Sửa thông tin tàu' : 'Thêm tàu'}
      description="Thông tin tàu dùng để đối chiếu chuyến đi tàu và điền vùng SERVICE RECORDS khi xuất CV."
      tile={<FleetTile large />}
      name={values.vessel_name || (isEdit ? vessel.vessel_name : 'Tàu mới')}
      sub={[types.data?.find((t) => t.id === values.vessel_type_id)?.name_vi, ((country) => country ? withFlag(country.code, country.name_vi || country.name_en, country.flag_emoji) : null)(countries.data?.find((c) => c.id === values.flag_country_id))].filter(Boolean).join(' · ')}
      sections={SECTIONS}
      stats={SECTIONS.map((_, index) => sectionMeta(index))}
      done={done}
      total={total}
    >
      <Form form={form} layout="vertical" requiredMark className="sf-sections" initialValues={initial} onFinish={submit} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <FormSection index={0} section={SECTIONS[0]} meta={sectionMeta(0)}>
          <div className="sf-grid">
            <Form.Item name="vessel_name" label={label('vessel_name', 'Tên tàu')} className={cn('vessel_name', 'sf-c6')} rules={[{ required: true, whitespace: true, message: 'Nhập tên tàu, ví dụ GEIYO K' }]}>
              <Input maxLength={150} autoFocus={!isEdit} />
            </Form.Item>
            <Form.Item name="vessel_name_prev" label={label('vessel_name_prev', <>Tên cũ<span className="sf-opt">Nếu tàu đã đổi tên</span></>)} className={cn('vessel_name_prev', 'sf-c6')}>
              <Input maxLength={150} placeholder="Ví dụ Fortune Island" />
            </Form.Item>
            <Form.Item name="imo_number" label={label('imo_number', 'Số IMO')} className={cn('imo_number', 'sf-c4')} rules={[imoRule]} normalize={digitsOnly} extra="Để trống nếu tàu không có IMO.">
              <Input inputMode="numeric" maxLength={7} placeholder="7 chữ số" />
            </Form.Item>
            <Form.Item name="call_sign" label={label('call_sign', 'Call Sign')} className={cn('call_sign', 'sf-c4')}>
              <Input maxLength={10} placeholder="Hô hiệu" />
            </Form.Item>
            <Form.Item name="mmsi" label={label('mmsi', 'MMSI')} className={cn('mmsi', 'sf-c4')} normalize={digitsOnly} rules={[{ pattern: /^\d{9}$/, message: 'MMSI có 9 chữ số' }]}>
              <Input inputMode="numeric" maxLength={9} placeholder="9 chữ số" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={1} section={SECTIONS[1]} meta={sectionMeta(1)}>
          <div className="sf-grid">
            <Form.Item name="vessel_type_id" label={label('vessel_type_id', 'Loại tàu')} className={cn('vessel_type_id', 'sf-c4')} extra="Lấy từ danh mục Loại tàu.">
              <Select {...selectProps} loading={types.isLoading} options={toOptions(types.data, (row) => row.name_vi)} placeholder="Chọn loại tàu" />
            </Form.Item>
            <Form.Item name="flag_country_id" label={label('flag_country_id', 'Cờ quốc gia')} className={cn('flag_country_id', 'sf-c4')} extra="Lấy từ danh mục Quốc gia.">
              <Select {...selectProps} loading={countries.isLoading} options={toOptions(countries.data, (row) => withFlag(row.code, row.name_vi || row.name_en, row.flag_emoji))} placeholder="Chọn quốc gia" />
            </Form.Item>
            <Form.Item name="year_built" label={label('year_built', 'Năm đóng')} className={cn('year_built', 'sf-c4')}>
              <InputNumber min={1900} max={2100} precision={0} controls={false} style={{ width: '100%' }} placeholder="2016" />
            </Form.Item>
            <Form.Item name="port_of_registry_id" label={label('port_of_registry_id', 'Cảng đăng ký')} className={cn('port_of_registry_id', 'sf-c6')}>
              <Select {...selectProps} loading={ports.isLoading} options={toOptions(ports.data, (row) => `${row.name}${row.country_name ? ` (${withFlag(row.country_code, row.country_name, row.country_flag_emoji)})` : ''}`)} placeholder="Chọn cảng" />
            </Form.Item>
            <Form.Item name="classification_society" label={label('classification_society', 'Tổ chức đăng kiểm')} className={cn('classification_society', 'sf-c6')}>
              <Input maxLength={50} placeholder="Ví dụ ClassNK" />
            </Form.Item>
            <Form.Item name="status" className={cn('status')} label={label('status', 'Trạng thái')}>
              <SegmentedPick options={VESSEL_STATUS_OPTIONS} label="Trạng thái" />
            </Form.Item>
            <Form.Item name="class_status" className={cn('class_status')} label={label('class_status', 'Trạng thái đăng kiểm')}>
              <ChoiceGroup options={CLASS_STATUS_OPTIONS} label="Trạng thái đăng kiểm" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={2} section={SECTIONS[2]} meta={sectionMeta(2)}>
          <div className="sf-grid">
            <Form.Item name="gross_tonnage" label={label('gross_tonnage', <>GRT<span className="sf-opt">Tổng dung tích đăng ký</span></>)} className={cn('gross_tonnage', 'sf-c4')}>
              <InputNumber min={0} controls={false} style={{ width: '100%' }} suffix="GT" />
            </Form.Item>
            <Form.Item name="net_tonnage" label={label('net_tonnage', <>NT<span className="sf-opt">Dung tích thực</span></>)} className={cn('net_tonnage', 'sf-c4')}>
              <InputNumber min={0} controls={false} style={{ width: '100%' }} suffix="NT" />
            </Form.Item>
            <Form.Item name="deadweight" label={label('deadweight', <>DWT<span className="sf-opt">Trọng tải toàn phần</span></>)} className={cn('deadweight', 'sf-c4')}>
              <InputNumber min={0} controls={false} style={{ width: '100%' }} suffix="tấn" />
            </Form.Item>
            <Form.Item name="length_overall" label={label('length_overall', <>LOA<span className="sf-opt">Chiều dài toàn bộ</span></>)} className={cn('length_overall', 'sf-c4')}>
              <InputNumber min={0} controls={false} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
            <Form.Item name="passenger_capacity" label={label('passenger_capacity', 'Sức chứa hành khách')} className={cn('passenger_capacity', 'sf-c4')}>
              <InputNumber min={0} precision={0} controls={false} style={{ width: '100%' }} suffix="người" />
            </Form.Item>
            <Form.Item name="crew_capacity" label={label('crew_capacity', 'Định biên thuyền viên')} className={cn('crew_capacity', 'sf-c4')}>
              <InputNumber min={0} precision={0} controls={false} style={{ width: '100%' }} suffix="người" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={3} section={SECTIONS[3]} meta={sectionMeta(3)}>
          <div className="sf-grid">
            <Form.Item name="engine_power_kw" label={label('engine_power_kw', 'Công suất máy')} className={cn('engine_power_kw', 'sf-c4')}>
              <InputNumber min={0} controls={false} style={{ width: '100%' }} suffix="kW" />
            </Form.Item>
            <Form.Item name="engine_type" label={label('engine_type', 'Loại động cơ')} className={cn('engine_type', 'sf-c4')}>
              <Input maxLength={100} placeholder="Ví dụ MAN B&W 6S50MC-C" />
            </Form.Item>
            <Form.Item name="dp_class" label={label('dp_class', <>DP Class<span className="sf-opt">Cấp định vị động học</span></>)} className={cn('dp_class', 'sf-c4')}>
              <Select allowClear options={DP_CLASS_OPTIONS} placeholder="Chọn cấp" />
            </Form.Item>
            <Form.Item name="has_boiler" className="sf-c6">
              <ToggleRow label="Nồi hơi" />
            </Form.Item>
            <Form.Item name="has_refrigeration" className="sf-c6">
              <ToggleRow label="Lạnh (Refrigeration)" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={4} section={SECTIONS[4]} meta={sectionMeta(4)}>
          <div className="sf-grid">
            <Form.Item name="ship_owner_id" label={label('ship_owner_id', 'Chủ tàu')} className={cn('ship_owner_id')} extra={<Link to="/partners/new" target="_blank">Chưa có trong danh sách? Thêm đối tác mới</Link>}>
              <Select {...selectProps} loading={owners.isLoading} options={ownerOptions} placeholder="Chọn chủ tàu" />
            </Form.Item>
            <Form.Item name="technical_manager" label={label('technical_manager', 'Quản lý kỹ thuật')} className={cn('technical_manager', 'sf-c6')}>
              <Input maxLength={200} placeholder="Công ty quản lý kỹ thuật" />
            </Form.Item>
            <Form.Item name="commercial_manager" label={label('commercial_manager', 'Quản lý thương mại')} className={cn('commercial_manager', 'sf-c6')}>
              <Input maxLength={200} placeholder="Công ty quản lý thương mại" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={5} section={SECTIONS[5]} meta={sectionMeta(5)}>
          <Form.Item name="notes" className={cn('notes')} label={label('notes', 'Ghi chú')} style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </FormSection>

        <div className="sf-savebar">
          {isEdit ? (
            <div className="sf-savebar__count">
              <b>{changeLabels.length ? `${changeLabels.length} thay đổi` : 'Chưa có thay đổi'}</b>
              {changeLabels.length ? <span title={changeLabels.join(', ')}>{changeLabels.join(', ')}</span> : null}
            </div>
          ) : (
            <div className={`sf-savebar__msg${hasName ? ' sf-savebar__msg--ok' : ''}`}>
              {hasName ? <CheckCircleFilled aria-hidden /> : <InfoCircleOutlined aria-hidden />}
              <span>{hasName ? 'Đã đủ thông tin bắt buộc. Các mục khác điền sau cũng được.' : 'Nhập tên tàu để thêm tàu.'}</span>
            </div>
          )}
          <div className="sf-savebar__actions">
            <Button onClick={() => navigate(cancelTo)}>Huỷ</Button>
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
                Lưu & thêm tàu khác
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
              {isEdit ? 'Lưu thay đổi' : 'Thêm tàu'}
            </Button>
          </div>
        </div>
      </Form>
    </FormFrame>
  )
}

export default function VesselFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useFleetItem('vessels', vesselApi, id)

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
        title={isError ? 'Không tải được thông tin tàu' : 'Không tìm thấy tàu'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/vessels')}>Về danh sách</Button>}
      />
    )
  }
  return <VesselForm key={data?.id || 'new'} vessel={id ? data : null} />
}
