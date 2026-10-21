import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Select, Skeleton } from 'antd'
import { CheckCircleFilled, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { shipOwnerApi, shipOwnerLogoApi } from '../../../api/fleetApi'
import LogoField from '../../../components/ds/LogoField'
import { logoProblem } from '../../../components/ds/logoRules'
import { readAsDataUrl, useFleetItem, useFleetMutations, usePartnerLogo } from '../../../hooks/useFleet'
import { PARTNER_STATUS_OPTIONS, partnerToFormValues, partnerToPayload, changedKeys, filled, initialsOfName } from './fleetView'
import { FleetTile, FormFrame, FormSection, SegmentedPick } from './FleetParts'
import changedLabel from './changedLabel'

const SECTIONS = [
  { key: 'company', title: 'Công ty', desc: 'Tên đối tác hiện ở mục “Nộp cho” của bộ giấy và trên danh sách tàu.', fields: ['company_name', 'company_name_en', 'tax_id', 'country_id', 'logo'] },
  { key: 'contact', title: 'Liên hệ công ty', fields: ['address', 'phone', 'fax', 'email', 'website'] },
  { key: 'person', title: 'Người liên hệ', desc: 'Người nhận bộ giấy tờ phía đối tác.', fields: ['contact_person', 'contact_phone', 'contact_email'] },
  { key: 'notes', title: 'Ghi chú', fields: ['notes'] },
]
const FIELD_LABELS = {
  company_name: 'Tên công ty', company_name_en: 'Tên tiếng Anh', tax_id: 'Mã số thuế', country_id: 'Quốc gia', is_active: 'Tình trạng', logo: 'Logo',
  address: 'Địa chỉ', phone: 'Điện thoại', fax: 'Fax', email: 'Email', website: 'Website',
  contact_person: 'Họ tên người liên hệ', contact_phone: 'Điện thoại người liên hệ', contact_email: 'Email người liên hệ', notes: 'Ghi chú',
}
const errorText = (error, fallback) => error?.response?.data?.error || error?.response?.data?.message || fallback
const emailRule = { type: 'email', message: 'Email phải có dạng ten@congty.com' }

function PartnerForm({ owner }) {
  const isEdit = !!owner
  const navigate = useNavigate()
  const toast = useToast()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const initial = useMemo(() => partnerToFormValues(owner), [owner])
  const values = Form.useWatch([], form) || initial
  const { save } = useFleetMutations(shipOwnerApi)
  const againRef = useRef(false)
  const [again, setAgain] = useState(false)
  const countries = useQuery({ queryKey: ['lookup', 'countries'], queryFn: () => lookupApi.countries().then((r) => r.data) })

  // Logo: ảnh đang có trên máy chủ, ảnh mới chọn (chỉ tải lên khi lưu), hoặc đánh dấu gỡ.
  const savedLogo = usePartnerLogo(owner)
  const [logoFile, setLogoFile] = useState(null)
  const [pickedLogo, setPickedLogo] = useState(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [logoError, setLogoError] = useState('')
  const logoSrc = logoFile ? pickedLogo : logoRemoved ? null : savedLogo
  const logoChanged = Boolean(logoFile) || (logoRemoved && Boolean(owner?.has_logo))
  function chooseLogo(file) {
    const problem = logoProblem(file)
    setLogoError(problem)
    if (problem) return
    setLogoFile(file)
    setLogoRemoved(false)
    readAsDataUrl(file).then(setPickedLogo)
  }

  const changed = new Set(isEdit ? changedKeys(initial, values, partnerToPayload) : [])
  if (isEdit && logoChanged) changed.add('logo')
  const cn = (name, base) => [base, changed.has(name) && 'sf-changed'].filter(Boolean).join(' ') || undefined
  const label = (name, text) => changedLabel(text, changed.has(name))
  const stats = SECTIONS.map((section) => section.fields.filter((name) => (name === 'logo' ? Boolean(logoSrc) : filled(typeof values[name] === 'string' ? values[name].trim() : values[name]))).length)
  const metas = SECTIONS.map((section, index) => `${stats[index]}/${section.fields.length}`)
  const total = SECTIONS.reduce((sum, section) => sum + section.fields.length, 0)
  const ready = filled(values.company_name?.trim?.())
  const changeLabels = [...changed].map((key) => FIELD_LABELS[key] || key)

  async function submit(formValues) {
    try {
      const row = await save.mutateAsync({ id: owner?.id, ...partnerToPayload(formValues) })
      let logoFailed = ''
      try {
        if (logoFile) await shipOwnerLogoApi.upload(row.id, logoFile)
        else if (logoRemoved && owner?.has_logo) await shipOwnerLogoApi.remove(row.id)
      } catch (error) {
        logoFailed = errorText(error, 'Không lưu được logo')
      }
      queryClient.invalidateQueries({ queryKey: ['fleet'] })
      if (logoFailed) toast.warning(`Đã lưu ${row.company_name}`, { description: logoFailed })
      else toast.success(isEdit ? `Đã lưu ${row.company_name}` : `Đã thêm ${row.company_name}`)
      if (againRef.current) {
        form.resetFields()
        setLogoFile(null)
        setPickedLogo(null)
        setLogoRemoved(false)
        setLogoError('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate(`/partners/${row.id}`)
      }
    } catch (error) {
      toast.error(isEdit ? 'Không lưu được đối tác' : 'Không thêm được đối tác', { description: errorText(error, 'Thử lại sau ít phút.') })
    }
  }

  return (
    <FormFrame
      crumbs={isEdit ? [{ label: 'Đối tác', to: '/partners' }, { label: owner.company_name, to: `/partners/${owner.id}` }, { label: 'Sửa' }] : [{ label: 'Đối tác', to: '/partners' }, { label: 'Thêm đối tác' }]}
      title={isEdit ? 'Sửa đối tác' : 'Thêm đối tác'}
      description="Chủ tàu đối tác: dùng để gắn với tàu và chọn ở mục “Nộp cho” khi tạo bộ giấy."
      tile={<FleetTile large text={initialsOfName(values.company_name || '')} src={logoSrc} />}
      name={values.company_name || (isEdit ? owner.company_name : 'Đối tác mới')}
      sub={[countries.data?.find((c) => c.id === values.country_id)?.name_vi].filter(Boolean).join(' · ')}
      sections={SECTIONS}
      stats={metas}
      done={stats.reduce((sum, count) => sum + count, 0)}
      total={total}
    >
      <Form form={form} layout="vertical" requiredMark className="sf-sections" initialValues={initial} onFinish={submit} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <FormSection index={0} section={SECTIONS[0]} meta={metas[0]}>
          <div className="sf-grid">
            <div className={cn('logo', 'sf-field')}>
              <div className="ant-form-item-label"><label>{label('logo', 'Logo công ty')}</label></div>
              <LogoField src={logoSrc} error={logoError} onPick={chooseLogo} onRemove={() => { setLogoFile(null); setPickedLogo(null); setLogoRemoved(true); setLogoError('') }} />
            </div>
            <Form.Item name="company_name" className={cn('company_name', 'sf-c6')} label={label('company_name', 'Tên công ty')} rules={[{ required: true, whitespace: true, message: 'Nhập tên công ty đối tác' }]}>
              <Input maxLength={200} autoFocus={!isEdit} />
            </Form.Item>
            <Form.Item name="company_name_en" className={cn('company_name_en', 'sf-c6')} label={label('company_name_en', 'Tên tiếng Anh')}>
              <Input maxLength={200} />
            </Form.Item>
            <Form.Item name="tax_id" className={cn('tax_id', 'sf-c6')} label={label('tax_id', 'Mã số thuế')}>
              <Input maxLength={50} inputMode="numeric" />
            </Form.Item>
            <Form.Item name="country_id" className={cn('country_id', 'sf-c6')} label={label('country_id', 'Quốc gia')}>
              <Select allowClear showSearch optionFilterProp="label" loading={countries.isLoading} options={(countries.data || []).map((row) => ({ value: row.id, label: row.name_vi }))} placeholder="Chọn quốc gia" />
            </Form.Item>
            <Form.Item
              name="is_active"
              className={cn('is_active')}
              label={label('is_active', 'Tình trạng')}
              extra="Ngừng hợp tác thì đối tác không còn hiện khi chọn “Nộp cho” ở bộ giấy mới."
            >
              <SegmentedPick options={PARTNER_STATUS_OPTIONS} label="Tình trạng" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={1} section={SECTIONS[1]} meta={metas[1]}>
          <div className="sf-grid">
            <Form.Item name="address" className={cn('address')} label={label('address', 'Địa chỉ')}>
              <Input maxLength={500} />
            </Form.Item>
            <Form.Item name="phone" className={cn('phone', 'sf-c4')} label={label('phone', 'Điện thoại')}>
              <Input maxLength={30} inputMode="tel" />
            </Form.Item>
            <Form.Item name="fax" className={cn('fax', 'sf-c4')} label={label('fax', 'Fax')}>
              <Input maxLength={30} inputMode="tel" />
            </Form.Item>
            <Form.Item name="email" className={cn('email', 'sf-c4')} label={label('email', 'Email')} rules={[emailRule]}>
              <Input maxLength={150} inputMode="email" placeholder="ten@congty.com" />
            </Form.Item>
            <Form.Item name="website" className={cn('website')} label={label('website', 'Website')}>
              <Input maxLength={200} inputMode="url" placeholder="https://" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={2} section={SECTIONS[2]} meta={metas[2]}>
          <div className="sf-grid">
            <Form.Item name="contact_person" className={cn('contact_person', 'sf-c4')} label={label('contact_person', 'Họ tên')}>
              <Input maxLength={150} />
            </Form.Item>
            <Form.Item name="contact_phone" className={cn('contact_phone', 'sf-c4')} label={label('contact_phone', 'Điện thoại')}>
              <Input maxLength={30} inputMode="tel" />
            </Form.Item>
            <Form.Item name="contact_email" className={cn('contact_email', 'sf-c4')} label={label('contact_email', 'Email')} rules={[emailRule]}>
              <Input maxLength={150} inputMode="email" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection index={3} section={SECTIONS[3]} meta={metas[3]}>
          <Form.Item name="notes" className={cn('notes')} label={label('notes', 'Ghi chú')} style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} maxLength={2000} showCount />
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
              <span>{ready ? 'Đã đủ thông tin bắt buộc. Các mục khác điền sau cũng được.' : 'Nhập tên công ty để thêm đối tác.'}</span>
            </div>
          )}
          <div className="sf-savebar__actions">
            <Button onClick={() => navigate(isEdit ? `/partners/${owner.id}` : '/partners')}>Huỷ</Button>
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
                Lưu & thêm đối tác khác
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
              {isEdit ? 'Lưu thay đổi' : 'Thêm đối tác'}
            </Button>
          </div>
        </div>
      </Form>
    </FormFrame>
  )
}

export default function PartnerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useFleetItem('ship-owners', shipOwnerApi, id)

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
        title={isError ? 'Không tải được thông tin đối tác' : 'Không tìm thấy đối tác'}
        action={isError ? <Button onClick={() => refetch()}>Thử lại</Button> : <Button onClick={() => navigate('/partners')}>Về danh sách</Button>}
      />
    )
  }
  return <PartnerForm key={data?.id || 'new'} owner={id ? data : null} />
}
