import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Select, Skeleton } from 'antd'
import { CheckCircleFilled, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { shipOwnerApi, shipOwnerLogoApi } from '../../../api/fleetApi'
import { ListItem } from '../seafarers/SeafarerFormParts'
import LogoField from '../../../components/ds/LogoField'
import PrimaryMark from '../../../components/ds/PrimaryMark'
import ScanButton from '../../../components/ds/ScanButton'
import QrScanButton from '../../../components/ds/QrScanButton'
import { isLink, parseChatQr } from '../../../utils/chatQr'
import { withFlag } from '../../../utils/flag'
import { logoProblem } from '../../../components/ds/logoRules'
import { readAsDataUrl, useFleetItem, useFleetMutations, usePartnerLogo } from '../../../hooks/useFleet'
import { EMPTY_CONTACT, PARTNER_STATUS_OPTIONS, cleanContactList, partnerToFormValues, partnerToPayload, changedKeys, filled, initialsOfName } from './fleetView'
import { FleetTile, FormFrame, FormSection, SegmentedPick } from './FleetParts'
import changedLabel from './changedLabel'

const SECTIONS = [
  { key: 'company', title: 'Công ty', desc: 'Tên đối tác hiện ở mục “Nộp cho” của bộ giấy và trên danh sách tàu.', fields: ['company_name', 'company_name_en', 'tax_id', 'country_id', 'logo'] },
  { key: 'contact', title: 'Liên hệ công ty', fields: ['address', 'phone', 'fax', 'email', 'website'] },
  { key: 'person', title: 'Người liên hệ', desc: 'Có thể thêm nhiều người. Liên hệ chính là người nhận bộ giấy tờ phía đối tác.', fields: ['contacts'] },
  { key: 'notes', title: 'Ghi chú', fields: ['notes'] },
]
const FIELD_LABELS = {
  company_name: 'Tên công ty', company_name_en: 'Tên tiếng Anh', tax_id: 'Mã số thuế', country_id: 'Quốc gia', is_active: 'Tình trạng', logo: 'Logo',
  address: 'Địa chỉ', phone: 'Điện thoại', fax: 'Fax', email: 'Email', website: 'Website',
  contacts: 'Người liên hệ', notes: 'Ghi chú',
}
const QR_FIELD = { whatsapp: 'whatsapp', line: 'line_id', wechat: 'wechat_id', zalo: 'phone' }
const QR_LABEL = { whatsapp: 'WhatsApp', line: 'LINE', wechat: 'WeChat', zalo: 'số điện thoại (Zalo)' }
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

  const logoInput = useRef(null)
  const [scanning, setScanning] = useState(null)

  // Quét danh thiếp. Ở khối Công ty: điền ô công ty đang trống (không ghi đè dữ liệu đã nhập) và thêm người trên danh thiếp.
  // Ở khối Người liên hệ (contactOnly): chỉ thêm người trên danh thiếp, mỗi danh thiếp một người.
  async function scanCard([file], { contactOnly = false } = {}) {
    setScanning(contactOnly ? 'person' : 'company')
    try {
      const { company, contact } = await shipOwnerApi.scanCard(file)
      const current = form.getFieldsValue(true)
      const patch = {}
      let kept = 0
      if (!contactOnly) {
        for (const [key, value] of Object.entries(company)) {
          if (filled(current[key]?.trim?.() ?? current[key])) kept += 1
          else patch[key] = value
        }
      }
      let filledCount = Object.keys(patch).length
      const contacts = current.contacts || []
      const known = contact && contacts.some((c) => c?.name?.trim().toLowerCase() === contact.name.toLowerCase())
      if (contactOnly && !contact) {
        toast.warning('Danh thiếp không có tên người liên hệ', { description: 'Nhập tay hoặc thử danh thiếp khác.' })
        return
      }
      if (contact && !known) {
        patch.contacts = [...contacts, { ...EMPTY_CONTACT, ...Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, v ?? ''])), is_primary: !cleanContactList(contacts).length }]
        filledCount += 1
      }
      form.setFieldsValue(patch)
      if (contactOnly && known) toast.info(`${contact.name} đã có trong danh sách`)
      else toast.success(contactOnly ? `Đã thêm ${contact.name}` : `Đã điền ${filledCount} mục từ danh thiếp`, { description: kept ? `${kept} ô đã có dữ liệu nên giữ nguyên. Kiểm tra lại rồi lưu.` : 'Kiểm tra lại rồi lưu.' })
    } catch (error) {
      toast.error('Không đọc được danh thiếp', { description: errorText(error, 'Thử lại sau ít phút.') })
    } finally {
      setScanning(null)
    }
  }

  // Quét mã QR kết bạn: tự nhận kênh (WhatsApp, LINE, WeChat, Zalo) và điền đúng ô của người đó, dù bấm nút ở ô nào.
  function applyQr(index, text) {
    const hit = parseChatQr(text)
    if (!hit) {
      toast.warning('Mã QR này không phải của WhatsApp, LINE, WeChat hay Zalo', { description: 'Chọn ảnh mã kết bạn của người liên hệ.' })
      return
    }
    form.setFieldValue(['contacts', index, QR_FIELD[hit.channel]], hit.value)
    toast.success(`Đã điền ${QR_LABEL[hit.channel]}`, { description: isLink(hit.value) ? 'Mã QR chỉ chứa đường dẫn kết bạn nên lưu đường dẫn.' : hit.value })
  }
  const qrButton = (index) => <QrScanButton onText={(text) => applyQr(index, text)} onFail={() => toast.warning('Không đọc được mã QR', { description: 'Chọn ảnh rõ nét, có đủ cả mã.' })} />

  const changed = new Set(isEdit ? changedKeys(initial, values, partnerToPayload) : [])
  if (isEdit && logoChanged) changed.add('logo')
  const cn = (name, base) => [base, changed.has(name) && 'sf-changed'].filter(Boolean).join(' ') || undefined
  const label = (name, text) => changedLabel(text, changed.has(name))
  const isFilled = (name) => {
    if (name === 'logo') return Boolean(logoSrc)
    if (name === 'contacts') return cleanContactList(values.contacts).length > 0
    return filled(typeof values[name] === 'string' ? values[name].trim() : values[name])
  }
  const stats = SECTIONS.map((section) => section.fields.filter(isFilled).length)
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
      tile={
        <>
          <FleetTile large text={initialsOfName(values.company_name || '')} src={logoSrc} onClick={() => logoInput.current?.click()} actionLabel={logoSrc ? 'Đổi logo' : 'Chọn logo'} />
          <input
            ref={logoInput}
            type="file"
            accept="image/jpeg,image/png"
            className="ds-sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) chooseLogo(file)
            }}
          />
        </>
      }
      name={values.company_name || (isEdit ? owner.company_name : 'Đối tác mới')}
      sub={withFlag(countries.data?.find((c) => c.id === values.country_id)?.code, countries.data?.find((c) => c.id === values.country_id)?.name_vi)}
      note={logoSrc ? null : 'Chưa có logo'}
      sections={SECTIONS}
      stats={metas}
      done={stats.reduce((sum, count) => sum + count, 0)}
      total={total}
    >
      <Form form={form} layout="vertical" requiredMark className="sf-sections" initialValues={initial} onFinish={submit} scrollToFirstError={{ behavior: 'smooth', block: 'center' }}>
        <FormSection index={0} section={SECTIONS[0]} meta={metas[0]} action={<ScanButton label="Quét danh thiếp" loading={scanning === 'company'} disabled={Boolean(scanning)} onPick={scanCard} accept=".jpg,.jpeg,.png,.pdf" />}>
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
              <Select allowClear showSearch optionFilterProp="label" loading={countries.isLoading} options={(countries.data || []).map((row) => ({ value: row.id, label: withFlag(row.code, row.name_vi) }))} placeholder="Chọn quốc gia" />
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

        <FormSection index={2} section={SECTIONS[2]} meta={metas[2]} action={<ScanButton label="Quét danh thiếp" loading={scanning === 'person'} disabled={Boolean(scanning)} onPick={(files) => scanCard(files, { contactOnly: true })} accept=".jpg,.jpeg,.png,.pdf" />}>
          <Form.List name="contacts">
            {(fields, { add, remove }) => (
              <div className="sf-items">
                {fields.map((field, position) => {
                  const primary = Boolean(values.contacts?.[field.name]?.is_primary)
                  const setPrimary = () => form.setFieldValue('contacts', (form.getFieldValue('contacts') || []).map((c, i) => ({ ...c, is_primary: i === field.name })))
                  const removeRow = () => {
                    const rest = (form.getFieldValue('contacts') || []).filter((_, i) => i !== field.name)
                    remove(field.name)
                    if (primary && rest.length) form.setFieldValue('contacts', rest.map((c, i) => ({ ...c, is_primary: i === 0 })))
                  }
                  return (
                    <ListItem key={field.key} title={`Người liên hệ ${position + 1}`} removeLabel={`Xoá người liên hệ ${position + 1}`} onRemove={removeRow} actions={<PrimaryMark value={primary} onChange={setPrimary} />}>
                      {/* Đăng ký ô liên hệ chính vào form để giá trị có mặt khi lưu và khi so sánh thay đổi; PrimaryMark điều khiển nó. */}
                      <Form.Item name={[field.name, 'is_primary']} hidden noStyle><Input type="hidden" /></Form.Item>
                      <Form.Item name={[field.name, 'name']} className="sf-c4" label="Họ tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên người liên hệ' }]}>
                        <Input maxLength={150} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'position']} className="sf-c4" label="Chức vụ">
                        <Input maxLength={100} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'phone']} className="sf-c4" label="Điện thoại">
                        <Input maxLength={30} inputMode="tel" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'email']} label="Email" rules={[emailRule]}>
                        <Input maxLength={150} inputMode="email" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'whatsapp']} className="sf-c4" label="WhatsApp">
                        <Input maxLength={300} placeholder="+65 9123 4567" suffix={qrButton(field.name)} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'line_id']} className="sf-c4" label="LINE ID">
                        <Input maxLength={300} suffix={qrButton(field.name)} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'wechat_id']} className="sf-c4" label="WeChat ID">
                        <Input maxLength={300} suffix={qrButton(field.name)} />
                      </Form.Item>
                    </ListItem>
                  )
                })}
                <button type="button" className="sf-add" disabled={fields.length >= 20} onClick={() => add({ ...EMPTY_CONTACT, is_primary: fields.length === 0 })}>
                  <PlusOutlined aria-hidden />
                  Thêm người liên hệ
                </button>
              </div>
            )}
          </Form.List>
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
