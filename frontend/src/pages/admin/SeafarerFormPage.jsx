import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AutoComplete, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Spin } from 'antd'
import { CheckCircleFilled, DeleteOutlined, InfoCircleOutlined, PlusOutlined, RightOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { seafarerApi, lookupApi } from '../../api'
import { documentApi } from '../../api/documentApi'
import ScanButton from '../../components/ds/ScanButton'
import { useCan } from '../../hooks/usePermission'
import AutofillBanner from '../../components/ds/AutofillBanner'
import { FIELD_LABELS } from './seafarers/fieldLabels'
import { ChoiceGroup, KindToggles, PhotoField, PhotoFrame } from './seafarers/SeafarerFormParts'
import { photoProblem } from './seafarers/photoRules'
import { SCAN_BUTTONS, SOURCE_NAMES, matchCountry, mergeScans, sectionSummaries, summaryText } from './seafarers/scanView'
import './seafarers/SeafarerForm.css'
import useToast from '../../components/ds/useToast'

const DATE_FORMAT = 'DD/MM/YYYY'
const DATE_FIELDS = ['date_of_birth', 'passport_issued_date', 'passport_expiry', 'national_id_issued_date']

const MARITAL_OPTIONS = ['Độc thân', 'Đã kết hôn', 'Ly hôn', 'Góa'].map((v) => ({ value: v, label: v }))
const BLOOD_OPTIONS = ['A', 'B', 'AB', 'O'].map((v) => ({ value: v, label: v }))
const YES_NO_OPTIONS = [
  { value: 1, label: 'Có' },
  { value: 0, label: 'Không' },
]
const GENDER_OPTIONS = [
  { value: 'M', label: 'Nam' },
  { value: 'F', label: 'Nữ' },
  { value: 'O', label: 'Khác' },
]
const EDU_OPTIONS = ['Đại học', 'Cao đẳng', 'Trung cấp', 'Cấp 3'].map((v) => ({ value: v, label: v }))
const PPE_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((v) => ({ value: v, label: v }))
const RELATIONSHIPS = ['Vợ', 'Chồng', 'Bố', 'Mẹ', 'Con', 'Anh', 'Chị', 'Em', 'Khác'].map((v) => ({ value: v }))
const CONTACT_KINDS = [
  { value: 'contact', label: 'Liên lạc' },
  { value: 'guarantor', label: 'Bảo lãnh' },
]

// Các khối của form, theo thứ tự từ trên xuống. fields: trường đơn; list: danh sách thêm nhiều.
const SECTIONS = [
  {
    key: 'general',
    title: 'Thông tin chung',
    desc: 'Ghi theo hộ chiếu hoặc CCCD.',
    fields: ['full_name', 'full_name_zh', 'full_name_en', 'date_of_birth', 'gender', 'place_of_origin', 'permanent_address', 'marital_status', 'children_count'],
    photo: true,
    scans: ['cccd', 'passport'],
  },
  {
    key: 'identity',
    title: 'Giấy tờ tùy thân',
    desc: 'Số giấy tờ dùng để đối chiếu khi AI đọc chứng chỉ và sổ thuyền viên.',
    fields: [
      'passport_number', 'passport_issued_date', 'passport_expiry', 'place_of_birth', 'nationality_id',
      'national_id', 'national_id_issued_date', 'national_id_issued_place', 'seaman_book_number',
    ],
    scans: ['passport', 'cccd', 'seaman_book'],
  },
  {
    key: 'physical',
    title: 'Thể chất',
    desc: 'Dùng khi khám sức khỏe và đặt đồ bảo hộ.',
    fields: ['height_cm', 'weight_kg', 'blood_type', 'shoe_size', 'ppe_size', 'shirt_size', 'pants_size'],
  },
  { key: 'contact', title: 'Liên hệ', fields: ['phone_primary', 'email'] },
  {
    key: 'bank',
    title: 'Ngân hàng & BHXH',
    desc: 'Thêm được nhiều tài khoản.',
    fields: ['social_insurance_joined', 'social_insurance_number'],
    list: 'bank_accounts',
    unit: 'tài khoản',
  },
  {
    key: 'family',
    title: 'Gia quyến',
    desc: 'Người liên lạc khi cần và người bảo lãnh. Thêm được nhiều người.',
    fields: [],
    list: 'contacts',
    unit: 'người',
  },
  {
    key: 'education',
    title: 'Học vấn',
    fields: ['education_level', 'education_school', 'education_major', 'english_level'],
    scans: ['diploma'],
  },
  { key: 'notes', title: 'Ghi chú', fields: ['notes'] },
]
const FORM_FIELDS = SECTIONS.flatMap((s) => s.fields)
const BANK_KEYS = ['bank_name', 'account_number', 'account_holder']
const CONTACT_KEYS = ['full_name', 'relationship', 'phone_primary', 'guarantor_id_number', 'guarantor_id_issued_date', 'guarantor_id_issued_place', 'address']

const isFilled = (v) => v !== undefined && v !== null && !(typeof v === 'string' && !v.trim())
const rowFilled = (row, keys) => Boolean(row) && keys.some((k) => isFilled(row[k]))
const toDay = (v) => (v ? dayjs(v) : null)
const toIso = (v) => (dayjs.isDayjs(v) ? v.format('YYYY-MM-DD') : v || null)
const clean = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null)

// "Nguyễn Văn An" → "NGUYEN VAN AN"
function englishName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function toFormValues(seafarer, contacts) {
  const values = {}
  for (const key of FORM_FIELDS) values[key] = DATE_FIELDS.includes(key) ? toDay(seafarer[key]) : seafarer[key] ?? null
  const banks = seafarer.bank_accounts || []
  values.bank_accounts = banks.length
    ? banks.map(({ id, bank_name, account_number, account_holder }) => ({ id, bank_name, account_number, account_holder }))
    : [{}]
  values.contacts = contacts?.length
    ? contacts.map((c) => ({
        id: c.id,
        kinds: [c.is_emergency_contact ? 'contact' : null, c.is_guarantor ? 'guarantor' : null].filter(Boolean),
        full_name: c.full_name,
        relationship: c.relationship || null,
        phone_primary: c.phone_primary,
        guarantor_id_number: c.guarantor_id_number,
        guarantor_id_issued_date: toDay(c.guarantor_id_issued_date),
        guarantor_id_issued_place: c.guarantor_id_issued_place,
        address: c.address,
      }))
    : [{ kinds: ['contact'] }]
  return values
}

// Giá trị form → body gửi API. Dòng tài khoản / người thân để trống thì bỏ.
function toPayload(values) {
  const payload = {}
  for (const key of FORM_FIELDS) payload[key] = DATE_FIELDS.includes(key) ? toIso(values[key]) : clean(values[key])
  payload.bank_accounts = (values.bank_accounts || [])
    .filter((row) => rowFilled(row, BANK_KEYS))
    .map((row) => ({ id: row.id ?? undefined, ...Object.fromEntries(BANK_KEYS.map((k) => [k, clean(row[k])])) }))
  payload.contacts = (values.contacts || [])
    .filter((row) => rowFilled(row, CONTACT_KEYS))
    .map((row) => ({
      id: row.id ?? undefined,
      ...Object.fromEntries(CONTACT_KEYS.map((k) => [k, k.endsWith('_date') ? toIso(row[k]) : clean(row[k])])),
      is_emergency_contact: row.kinds?.includes('contact') ? 1 : 0,
      is_guarantor: row.kinds?.includes('guarantor') ? 1 : 0,
    }))
  return payload
}

function sectionStats(section, values, hasPhoto) {
  const filled = section.fields.filter((k) => isFilled(values[k])).length + (section.photo && hasPhoto ? 1 : 0)
  const total = section.fields.length + (section.photo ? 1 : 0)
  if (section.list) {
    const rows = (values[section.list] || []).filter((row) =>
      rowFilled(row, section.list === 'bank_accounts' ? BANK_KEYS : CONTACT_KEYS)
    ).length
    return { label: `${rows} ${section.unit}`, any: rows > 0 || filled > 0, done: rows > 0 }
  }
  return { label: `${filled}/${total}`, any: filled > 0, done: filled === total }
}

const ChangedContext = createContext(new Set())
// Ô vừa được AI điền và chưa bị sửa: { [tên ô]: { state: 'ok' | 'check', source } }.
const AiMarksContext = createContext({})

// Form.Item đặt trong lưới 12 cột; ở màn sửa, trường đã đổi có viền màu nhấn và chip "Đã sửa".
function Field({ name, label, span, required, children, ...rest }) {
  const changed = useContext(ChangedContext).has(name)
  const ai = useContext(AiMarksContext)[name]
  return (
    <Form.Item
      name={name}
      label={
        <>
          {label}
          {required ? <span className="sf-req" aria-hidden>*</span> : null}
          {changed ? <span className="sf-chip">Đã sửa</span> : null}
          {ai?.state === 'check' ? <span className="sf-aicheck">cần kiểm tra</span> : null}
        </>
      }
      className={[span ? `sf-c${span}` : '', changed ? 'sf-changed' : '', ai ? `sf-ai sf-ai--${ai.state}` : ''].filter(Boolean).join(' ') || undefined}
      {...rest}
    >
      {children}
    </Form.Item>
  )
}

function DateField(props) {
  return (
    <Field {...props}>
      <DatePicker format={DATE_FORMAT} placeholder="DD/MM/YYYY" style={{ width: '100%' }} />
    </Field>
  )
}

const ScanContext = createContext({ busy: null, done: null, run: () => {}, summaries: [], clear: () => {} })

function Section({ index, section, stats, children }) {
  const scan = useContext(ScanContext)
  const can = useCan()
  const summary = scan.summaries.find((row) => row.key === section.key)
  return (
    <section className="sf-panel" id={`sf-${section.key}`} aria-labelledby={`sf-${section.key}-title`}>
      <div className="sf-panel__head">
        <span className="sf-step">{index + 1}</span>
        <div className="sf-panel__text">
          <h3 className="sf-panel__title" id={`sf-${section.key}-title`}>{section.title}</h3>
          {section.desc ? <p className="sf-panel__desc">{section.desc}</p> : null}
        </div>
        {section.scans && can('seafarer.docs') ? (
          <div className="sf-panel__scans">
            {section.scans.map((kind) => (
              <ScanButton
                key={kind}
                label={SCAN_BUTTONS[kind]}
                loading={scan.busy === `${section.key}:${kind}`}
                disabled={Boolean(scan.busy)}
                doneText={scan.done?.id === `${section.key}:${kind}` ? scan.done.text : undefined}
                onPick={(files) => scan.run(kind, files, `${section.key}:${kind}`)}
              />
            ))}
          </div>
        ) : null}
        <span className="sf-panel__meta">{stats.label}</span>
      </div>
      <div className="sf-panel__body">
        {summary ? <AutofillBanner text={summaryText(summary)} onClear={scan.clear} /> : null}
        {children}
      </div>
    </section>
  )
}

function ListItem({ title, onRemove, removeLabel, children }) {
  return (
    <div className="sf-item">
      <div className="sf-item__head">
        <h4 className="sf-item__title">{title}</h4>
        <Button type="text" icon={<DeleteOutlined />} aria-label={removeLabel} onClick={onRemove} />
      </div>
      <div className="sf-item__body sf-grid">{children}</div>
    </div>
  )
}

export default function SeafarerFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)

  const { data: seafarer, isLoading: loadingSeafarer } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
    enabled: isEdit,
  })
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['seafarer-contacts', id],
    queryFn: () => seafarerApi.getContacts(id).then((r) => r.data),
    enabled: isEdit,
  })
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  if (isEdit && (loadingSeafarer || loadingContacts || !seafarer)) {
    return <Spin style={{ display: 'block', marginTop: 80 }} />
  }
  return <SeafarerForm key={id || 'new'} id={id} seafarer={seafarer} contacts={contacts} countries={countries} />
}

function SeafarerForm({ id, seafarer, contacts, countries }) {
  const can = useCan()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form] = Form.useForm()
  const watched = Form.useWatch((all) => all, form)
  const againRef = useRef(false)
  const prevNameRef = useRef(seafarer?.full_name || '')
  const [active, setActive] = useState(SECTIONS[0].key)

  const vnId = countries?.find((c) => String(c.code).toUpperCase() === 'VN')?.id
  const initialValues = useMemo(
    () => (isEdit ? toFormValues(seafarer, contacts) : { gender: 'M', bank_accounts: [{}], contacts: [{ kinds: ['contact'] }] }),
    [isEdit, seafarer, contacts]
  )
  const initialPayload = useMemo(() => (isEdit ? toPayload(initialValues) : null), [isEdit, initialValues])
  // useWatch trả undefined ở lần render đầu: dùng giá trị ban đầu để không nháy "thay đổi".
  const values = watched ?? initialValues

  // Quốc tịch mặc định Việt Nam khi tạo mới.
  useEffect(() => {
    if (!isEdit && vnId && !form.getFieldValue('nationality_id')) form.setFieldValue('nationality_id', vnId)
  }, [isEdit, vnId, form])

  // Ảnh chân dung: ảnh đang có trên máy chủ, ảnh mới chọn (chỉ tải lên khi lưu), hoặc đánh dấu gỡ.
  const { data: savedPhoto } = useQuery({
    queryKey: ['seafarer-photo', id, seafarer?.updated_at],
    queryFn: () => seafarerApi.getPhoto(id).then(readAsDataUrl),
    enabled: isEdit && Boolean(seafarer?.has_photo),
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [pickedPhoto, setPickedPhoto] = useState(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef(null)
  const choosePhoto = (file) => {
    if (!file) return
    const problem = photoProblem(file)
    setPhotoError(problem)
    if (problem) return
    setPhotoFile(file)
    setPhotoRemoved(false)
    readAsDataUrl(file).then(setPickedPhoto)
  }
  const photoSrc = photoFile ? pickedPhoto : photoRemoved ? null : savedPhoto
  const hasPhoto = Boolean(photoSrc)
  const photoChanged = Boolean(photoFile) || (photoRemoved && Boolean(seafarer?.has_photo))

  // Quét giấy tờ: AI đọc tệp rồi điền vào ô còn trống; ô vừa điền được đánh dấu tới khi người dùng sửa ô đó.
  const [marks, setMarks] = useState({})
  const [scanBusy, setScanBusy] = useState(null)
  const [scanDone, setScanDone] = useState(null)
  const doneTimer = useRef(null)
  useEffect(() => () => clearTimeout(doneTimer.current), [])
  const summaries = useMemo(() => sectionSummaries(marks, SECTIONS), [marks])

  const applyScan = (entries) => {
    const rows = entries
      .map((item) => {
        if (item.field === 'nationality') {
          const nid = matchCountry(item.value, countries)
          return nid ? { ...item, field: 'nationality_id', value: nid } : null
        }
        return { ...item, value: DATE_FIELDS.includes(item.field) ? dayjs(item.value) : item.value }
      })
      .filter(Boolean)
    const isEmpty = (field) => {
      const current = form.getFieldValue(field)
      return !isFilled(current) || (!isEdit && !form.isFieldTouched(field) && !marks[field])
    }
    const same = (a, b) => (dayjs.isDayjs(a) && dayjs.isDayjs(b) ? a.isSame(b, 'day') : a === b)
    const todo = rows.filter((row) => !same(form.getFieldValue(row.field), row.value))
    const free = todo.filter((row) => isEmpty(row.field))
    const clash = todo.filter((row) => !isEmpty(row.field))
    const write = (list) => {
      if (!list.length) {
        toast.info('Không có ô nào cần điền', { description: 'Các ô đọc được đã có dữ liệu giống giấy tờ.' })
        return 0
      }
      for (const row of list) form.setFieldValue(row.field, row.value)
      const name = form.getFieldValue('full_name')
      if (list.some((row) => row.field === 'full_name')) {
        const en = form.getFieldValue('full_name_en')
        if (!en || en === englishName(prevNameRef.current)) form.setFieldValue('full_name_en', englishName(name) || null)
        prevNameRef.current = name || ''
      }
      setMarks((current) => ({ ...current, ...Object.fromEntries(list.map((row) => [row.field, { state: row.state, source: row.source }])) }))
      const first = SECTIONS.flatMap((sec) => sec.fields).find((field) => list.some((row) => row.field === field))
      if (first) setTimeout(() => form.scrollToField(first, { behavior: 'smooth', block: 'center' }), 50)
      return list.length
    }
    return new Promise((resolve) => {
      if (!clash.length) return resolve(write(free))
      Modal.confirm({
        title: 'Ghi đè các ô đã có dữ liệu?',
        content: `${clash.length} ô đã có dữ liệu và khác với giấy tờ: ${clash.map((row) => FIELD_LABELS[row.field] || row.field).join(', ')}.`,
        okText: 'Ghi đè',
        cancelText: 'Giữ nguyên',
        onOk: () => resolve(write([...free, ...clash])),
        onCancel: () => resolve(write(free)),
      })
    })
  }

  const runScan = async (kind, files, id) => {
    setScanBusy(id)
    try {
      const results = []
      for (const file of files) results.push(await documentApi.scan(file, kind === 'auto' ? 'auto' : kind))
      const skipped = results.flatMap((r) => r.skipped || [])
      if (skipped.length) toast.warning('Bỏ qua một số giấy', { description: [...new Set(skipped.map((item) => item.reason))].join(' ') })
      const entries = mergeScans(results)
      if (!entries.length) {
        if (!skipped.length) toast.warning('Không đọc được ô nào từ giấy này', { description: 'Thử ảnh rõ hơn hoặc nhập tay.' })
        return
      }
      const count = await applyScan(entries)
      if (count) {
        setScanDone({ id, text: `Đã điền ${count} ô` })
        clearTimeout(doneTimer.current)
        doneTimer.current = setTimeout(() => setScanDone(null), 5000)
      }
    } catch (err) {
      toast.error('Không đọc được giấy tờ', { description: err.response?.data?.error || err.response?.data?.message || 'Thử lại sau ít phút.' })
    } finally {
      setScanBusy(null)
    }
  }
  const scanContext = useMemo(
    () => ({ busy: scanBusy, done: scanDone, run: runScan, summaries, clear: () => setMarks({}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scanBusy, scanDone, summaries, marks, countries]
  )

  // Trường đã đổi so với lúc mở (màn sửa).
  const changedKeys = useMemo(() => {
    if (!initialPayload) return []
    const now = toPayload(values)
    return Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(initialPayload[k]))
  }, [initialPayload, values])
  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys])
  const changeLabels = [...changedKeys.map((k) => FIELD_LABELS[k] || k), ...(photoChanged ? ['Ảnh chân dung'] : [])]

  const stats = SECTIONS.map((s) => sectionStats(s, values, hasPhoto))
  const sectionsWithInfo = stats.filter((s) => s.any).length

  // Mục lục: đánh dấu khối đang xem khi cuộn.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`sf-${s.key}`)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id.slice(3))
      },
      { rootMargin: '-96px 0px -60% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const goTo = (key) => (e) => {
    e.preventDefault()
    setActive(key)
    document.getElementById(`sf-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const resetForNext = () => {
    form.resetFields()
    if (vnId) form.setFieldValue('nationality_id', vnId)
    prevNameRef.current = ''
    setPhotoFile(null)
    setPickedPhoto(null)
    setPhotoRemoved(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const mutation = useMutation({
    mutationFn: async ({ payload, again }) => {
      let saved = seafarer
      if (!isEdit) {
        // POST kiểm tra kiểu từng trường: bỏ ô trống thay vì gửi null.
        const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null))
        saved = (await seafarerApi.create(body)).data
      } else if (changedKeys.length) {
        saved = (await seafarerApi.update(id, payload)).data
      }
      let photoError = null
      try {
        if (photoFile) await seafarerApi.uploadPhoto(saved.id, photoFile)
        else if (photoRemoved && seafarer?.has_photo) await seafarerApi.removePhoto(saved.id)
      } catch (err) {
        photoError = err.response?.data?.error || err.response?.data?.message || 'Không lưu được ảnh chân dung'
      }
      return { saved, photoError, again }
    },
    onSuccess: ({ saved, photoError, again }) => {
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      queryClient.invalidateQueries({ queryKey: ['seafarer'] })
      queryClient.invalidateQueries({ queryKey: ['seafarer-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['seafarer-photo'] })
      if (photoError) toast.warning(`Đã lưu hồ sơ ${saved.full_name}`, { description: photoError })
      else toast.success(isEdit ? `Đã lưu hồ sơ ${saved.full_name}` : `Đã tạo hồ sơ ${saved.full_name}`)
      if (again) resetForNext()
      else navigate(`/seafarers/${saved.id}`)
    },
    onError: (err) => {
      toast.error(isEdit ? 'Không lưu được hồ sơ' : 'Không tạo được hồ sơ', { description: err.response?.data?.error || err.response?.data?.message })
    },
  })

  // Tên tiếng Anh tự điền theo họ tên, tới khi người dùng tự sửa.
  const onValuesChange = (changed, all) => {
    if (changed.social_insurance_joined === 0) form.setFieldValue('social_insurance_number', null)
    // Sửa ô nào thì đánh dấu AI của ô đó mất.
    if (Object.keys(changed).some((key) => marks[key])) {
      setMarks((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in changed))))
    }
    if (!('full_name' in changed)) return
    const current = all.full_name_en || ''
    if (!current || current === englishName(prevNameRef.current)) {
      form.setFieldValue('full_name_en', englishName(changed.full_name) || null)
    }
    prevNameRef.current = changed.full_name || ''
  }

  const onFinish = (formValues) => {
    const payload = toPayload(formValues)
    mutation.mutate({ payload, again: againRef.current })
  }

  const cancelTo = isEdit ? `/seafarers/${id}` : '/seafarers'
  const name = values.full_name?.trim() || seafarer?.full_name || ''
  const canSave = !isEdit || changedKeys.length > 0 || photoChanged

  return (
    <ChangedContext.Provider value={changedSet}>
     <AiMarksContext.Provider value={marks}>
     <ScanContext.Provider value={scanContext}>
      <div className="sf-head">
        <div>
          <nav className="sf-crumb" aria-label="Vị trí">
            <Link to="/seafarers">Thuyền viên</Link>
            <RightOutlined aria-hidden />
            {isEdit ? (
              <>
                <Link to={`/seafarers/${id}`}>{seafarer.full_name}</Link>
                <RightOutlined aria-hidden />
                <span aria-current="page">Chỉnh sửa</span>
              </>
            ) : (
              <span aria-current="page">Thêm mới</span>
            )}
          </nav>
          <h2 className="sf-head__title">{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm thuyền viên mới'}</h2>
        </div>
        <div className="sf-head__actions">
          {can('seafarer.docs') ? (
            <ScanButton
              variant="auto"
              label="Tự điền từ giấy tờ"
              loading={scanBusy === 'auto'}
              disabled={Boolean(scanBusy)}
              doneText={scanDone?.id === 'auto' ? scanDone.text : undefined}
              onPick={(files) => runScan('auto', files, 'auto')}
            />
          ) : null}
        </div>
      </div>

      <div className="sf-layout">
        <aside className="sf-aside" aria-label="Tóm tắt hồ sơ">
          <div className="sf-who">
            <PhotoFrame src={photoSrc} onClick={() => photoInputRef.current?.click()} />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={(e) => {
                choosePhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <div className="sf-who__text">
              <p className="sf-who__name">{name || 'Thuyền viên mới'}</p>
              {values.full_name_en ? <p className="sf-who__sub">{values.full_name_en}</p> : null}
              {hasPhoto ? null : <p className="sf-who__sub">Chưa có ảnh chân dung</p>}
            </div>
          </div>
          <div className="sf-progress">
            <div className="sf-progress__top">
              <span>Mục đã có thông tin</span>
              <span>{sectionsWithInfo} / {SECTIONS.length}</span>
            </div>
            <div className="sf-bar">
              <span style={{ width: `${(sectionsWithInfo / SECTIONS.length) * 100}%` }} />
            </div>
          </div>
          <nav className="sf-toc" aria-label="Các mục của form">
            {SECTIONS.map((s, i) => {
              const changes = changedKeys.filter((k) => s.fields.includes(k) || k === s.list).length + (s.photo && photoChanged ? 1 : 0)
              return (
                <a key={s.key} href={`#sf-${s.key}`} aria-current={active === s.key ? 'true' : undefined} onClick={goTo(s.key)}>
                  <span className={`sf-toc__n${stats[i].done ? ' sf-toc__n--done' : ''}`}>{i + 1}</span>
                  {s.title}
                  {changes ? (
                    <span className="sf-chip sf-toc__chg">{changes} thay đổi</span>
                  ) : (
                    <span className="sf-toc__cnt">{stats[i].label}</span>
                  )}
                </a>
              )
            })}
          </nav>
        </aside>

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={initialValues}
          onValuesChange={onValuesChange}
          onFinish={onFinish}
          scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
          className="sf-sections"
        >
          <Section index={0} section={SECTIONS[0]} stats={stats[0]}>
            <div className="sf-grid">
              <Field name="full_name" label="Họ và tên" span={4} required rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên' }]}>
                <Input placeholder="Nguyễn Văn A" maxLength={150} />
              </Field>
              <Field name="full_name_zh" label="Tên tiếng Trung" span={4}>
                <Input placeholder="VD: 阮文安" maxLength={150} />
              </Field>
              <Field name="full_name_en" label="Tên tiếng Anh" span={4}>
                <Input placeholder="NGUYEN VAN A" maxLength={150} />
              </Field>
              <DateField name="date_of_birth" label="Ngày sinh" span={4} />
              <Field name="gender" label="Giới tính" span={4}>
                <Select options={GENDER_OPTIONS} />
              </Field>
              <Field name="place_of_origin" label="Nguyên quán" span={8}>
                <Input placeholder="VD: Xã Hải Thanh, huyện Tĩnh Gia, Thanh Hóa" maxLength={255} />
              </Field>
              <Field name="permanent_address" label="Địa chỉ thường trú">
                <Input placeholder="Số nhà, đường, xã / phường, quận / huyện, tỉnh / thành phố" />
              </Field>
              <Field name="marital_status" label="Tình trạng hôn nhân" span={8}>
                <ChoiceGroup options={MARITAL_OPTIONS} label="Tình trạng hôn nhân" />
              </Field>
              <Field name="children_count" label="Số con" span={4}>
                <InputNumber min={0} max={30} style={{ width: '100%' }} />
              </Field>
              <div className={photoChanged ? 'sf-changed' : undefined}>
                <p className="sf-label">
                  Ảnh chân dung (4×6)
                  {photoChanged && isEdit ? <span className="sf-chip">Đã sửa</span> : null}
                </p>
                <PhotoField
                  src={photoSrc}
                  error={photoError}
                  onChoose={() => photoInputRef.current?.click()}
                  onDropFile={choosePhoto}
                  onRemove={() => {
                    setPhotoFile(null)
                    setPickedPhoto(null)
                    setPhotoRemoved(true)
                    setPhotoError('')
                  }}
                />
              </div>
            </div>
          </Section>

          <Section index={1} section={SECTIONS[1]} stats={stats[1]}>
            <div className="sf-grid">
              <div className="sf-sub">Hộ chiếu</div>
              <Field name="passport_number" label="Số hộ chiếu" span={4}>
                <Input placeholder="B1234567" maxLength={20} />
              </Field>
              <DateField name="passport_issued_date" label="Ngày cấp hộ chiếu" span={4} />
              <DateField name="passport_expiry" label="Ngày hết hạn hộ chiếu" span={4} />
              <Field name="place_of_birth" label="Nơi sinh" span={6}>
                <Input placeholder="VD: Thanh Hóa" maxLength={200} />
              </Field>
              <Field name="nationality_id" label="Quốc tịch" span={6}>
                <Select
                  showSearch
                  placeholder="Chọn quốc tịch"
                  optionFilterProp="label"
                  options={(countries || []).map((c) => ({ value: c.id, label: c.name_vi || c.name_en }))}
                />
              </Field>
              <div className="sf-sub">Căn cước công dân</div>
              <Field name="national_id" label="Số CCCD" span={4}>
                <Input placeholder="012345678901" inputMode="numeric" maxLength={20} />
              </Field>
              <DateField name="national_id_issued_date" label="Ngày cấp CCCD" span={4} />
              <Field name="national_id_issued_place" label="Nơi cấp" span={4}>
                <Input placeholder="Cục Cảnh sát QLHC về TTXH" maxLength={150} />
              </Field>
              <div className="sf-sub">Sổ thuyền viên</div>
              <Field name="seaman_book_number" label="Số sổ thuyền viên" span={4}>
                <Input maxLength={30} />
              </Field>
            </div>
          </Section>

          <Section index={2} section={SECTIONS[2]} stats={stats[2]}>
            <div className="sf-grid">
              <Field name="height_cm" label="Chiều cao" span={3}>
                <InputNumber min={0} max={300} placeholder="170" suffix="cm" style={{ width: '100%' }} />
              </Field>
              <Field name="weight_kg" label="Cân nặng" span={3}>
                <InputNumber min={0} max={500} placeholder="65" suffix="kg" style={{ width: '100%' }} />
              </Field>
              <Field name="blood_type" label="Nhóm máu" span={6}>
                <ChoiceGroup options={BLOOD_OPTIONS} label="Nhóm máu" />
              </Field>
              <Field name="shoe_size" label="Size giày" span={3}>
                <Input placeholder="42" maxLength={10} />
              </Field>
              <Field name="ppe_size" label="Size bảo hộ" span={3}>
                <Select allowClear placeholder="Chọn size" options={PPE_SIZES} />
              </Field>
              <Field name="shirt_size" label="Size áo" span={3}>
                <Select allowClear placeholder="Chọn size" options={PPE_SIZES} />
              </Field>
              <Field name="pants_size" label="Size quần" span={3}>
                <Input placeholder="30 / 32" maxLength={10} />
              </Field>
            </div>
          </Section>

          <Section index={3} section={SECTIONS[3]} stats={stats[3]}>
            <div className="sf-grid">
              <Field name="phone_primary" label="Số điện thoại" span={6} extra="Dùng để gửi link ký qua SMS.">
                <Input type="tel" placeholder="0901 234 567" maxLength={20} />
              </Field>
              <Field name="email" label="Email" span={6} rules={[{ type: 'email', message: 'Email chưa đúng dạng' }]}>
                <Input type="email" placeholder="ten@email.com" />
              </Field>
            </div>
          </Section>

          <Section index={4} section={SECTIONS[4]} stats={stats[4]}>
            <div className="sf-grid">
              <Form.List name="bank_accounts">
                {(fields, { add, remove }) => (
                  <div className="sf-items">
                    {fields.map(({ key, name }, i) => (
                      <ListItem key={key} title={`Tài khoản ${i + 1}`} removeLabel={`Xóa tài khoản ${i + 1}`} onRemove={() => remove(name)}>
                        <Form.Item name={[name, 'id']} hidden noStyle>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[name, 'bank_name']} label="Tên ngân hàng" className="sf-c4">
                          <Input placeholder="VD: Vietcombank" maxLength={100} />
                        </Form.Item>
                        <Form.Item name={[name, 'account_number']} label="Số tài khoản" className="sf-c4">
                          <Input inputMode="numeric" maxLength={30} />
                        </Form.Item>
                        <Form.Item name={[name, 'account_holder']} label="Tên chủ tài khoản" className="sf-c4">
                          <Input placeholder="NGUYEN VAN AN" maxLength={150} />
                        </Form.Item>
                      </ListItem>
                    ))}
                    <button type="button" className="sf-add" onClick={() => add({})}>
                      <PlusOutlined aria-hidden />
                      Thêm tài khoản
                    </button>
                  </div>
                )}
              </Form.List>
              <div className="sf-sub">Bảo hiểm xã hội</div>
              <Field name="social_insurance_joined" label="Tham gia BHXH" span={4}>
                <ChoiceGroup options={YES_NO_OPTIONS} label="Tham gia BHXH" />
              </Field>
              <Field name="social_insurance_number" label="Số BHXH" span={4}>
                <Input maxLength={20} disabled={values.social_insurance_joined === 0} />
              </Field>
            </div>
          </Section>

          <Section index={5} section={SECTIONS[5]} stats={stats[5]}>
            <Form.List name="contacts">
              {(fields, { add, remove }) => (
                <div className="sf-items">
                  {fields.map(({ key, name }, i) => (
                    <ListItem key={key} title={`Người thân ${i + 1}`} removeLabel={`Xóa người thân ${i + 1}`} onRemove={() => remove(name)}>
                      <Form.Item name={[name, 'id']} hidden noStyle>
                        <Input />
                      </Form.Item>
                      <Form.Item name={[name, 'kinds']} label="Loại">
                        <KindToggles options={CONTACT_KINDS} />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'full_name']}
                        label="Họ tên"
                        className="sf-c4"
                        rules={[
                          ({ getFieldValue }) => ({
                            validator(_, v) {
                              if (isFilled(v) || !rowFilled(getFieldValue(['contacts', name]), CONTACT_KEYS)) return Promise.resolve()
                              return Promise.reject(new Error('Nhập họ tên người thân'))
                            },
                          }),
                        ]}
                      >
                        <Input maxLength={150} />
                      </Form.Item>
                      <Form.Item name={[name, 'relationship']} label="Quan hệ" className="sf-c4">
                        <AutoComplete options={RELATIONSHIPS} placeholder="Chọn hoặc nhập" />
                      </Form.Item>
                      <Form.Item name={[name, 'phone_primary']} label="Số điện thoại" className="sf-c4">
                        <Input type="tel" maxLength={20} />
                      </Form.Item>
                      <Form.Item name={[name, 'guarantor_id_number']} label="Số CCCD" className="sf-c4">
                        <Input inputMode="numeric" maxLength={20} />
                      </Form.Item>
                      <Form.Item name={[name, 'guarantor_id_issued_date']} label="Ngày cấp CCCD" className="sf-c4">
                        <DatePicker format={DATE_FORMAT} placeholder="DD/MM/YYYY" style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name={[name, 'guarantor_id_issued_place']} label="Nơi cấp CCCD" className="sf-c4">
                        <Input maxLength={150} />
                      </Form.Item>
                      <Form.Item
                        name={[name, 'address']}
                        label="Địa chỉ"
                        extra={
                          isFilled(values.permanent_address) ? (
                            <button
                              type="button"
                              className="sf-link"
                              onClick={() => form.setFieldValue(['contacts', name, 'address'], values.permanent_address)}
                            >
                              Dùng địa chỉ thường trú của thuyền viên
                            </button>
                          ) : null
                        }
                      >
                        <Input />
                      </Form.Item>
                    </ListItem>
                  ))}
                  <button type="button" className="sf-add" onClick={() => add({ kinds: ['contact'] })}>
                    <PlusOutlined aria-hidden />
                    Thêm người thân
                  </button>
                </div>
              )}
            </Form.List>
          </Section>

          <Section index={6} section={SECTIONS[6]} stats={stats[6]}>
            <div className="sf-grid">
              <Field name="education_level" label="Bằng cấp">
                <ChoiceGroup options={EDU_OPTIONS} label="Bằng cấp" />
              </Field>
              <Field name="education_school" label="Trường" span={5}>
                <Input placeholder="VD: Đại học Hàng hải Việt Nam" maxLength={200} />
              </Field>
              <Field name="education_major" label="Ngành" span={4}>
                <Input placeholder="VD: Điều khiển tàu biển" maxLength={150} />
              </Field>
              <Field name="english_level" label="Trình độ tiếng Anh" span={3}>
                <Input placeholder="B2" maxLength={50} />
              </Field>
            </div>
          </Section>

          <Section index={7} section={SECTIONS[7]} stats={stats[7]}>
            <div className="sf-grid">
              <Field name="notes" label={<>Ghi chú<span className="sf-opt">Chỉ nội bộ thấy</span></>}>
                <Input.TextArea rows={3} />
              </Field>
            </div>
          </Section>

          <div className="sf-savebar">
            {isEdit ? (
              <>
                <div className="sf-savebar__count">
                  <b>{changeLabels.length ? `${changeLabels.length} thay đổi` : 'Chưa có thay đổi'}</b>
                  {changeLabels.length ? <span title={changeLabels.join(', ')}>{changeLabels.join(', ')}</span> : null}
                </div>
              </>
            ) : (
              <div className={`sf-savebar__msg${isFilled(values.full_name) ? ' sf-savebar__msg--ok' : ''}`}>
                {isFilled(values.full_name) ? <CheckCircleFilled aria-hidden /> : <InfoCircleOutlined aria-hidden />}
                <span>
                  {isFilled(values.full_name)
                    ? 'Đã đủ thông tin bắt buộc. Các mục khác điền sau cũng được.'
                    : 'Nhập họ và tên để tạo hồ sơ.'}
                </span>
              </div>
            )}
            <div className="sf-savebar__actions">
              <Button onClick={() => navigate(cancelTo)}>Hủy</Button>
              {isEdit ? null : (
                <Button
                  loading={mutation.isPending && mutation.variables?.again}
                  disabled={mutation.isPending}
                  onClick={() => {
                    againRef.current = true
                    form.submit()
                  }}
                >
                  Lưu & thêm người khác
                </Button>
              )}
              <Button
                type="primary"
                htmlType="submit"
                disabled={!canSave}
                loading={mutation.isPending && !mutation.variables?.again}
                onClick={() => {
                  againRef.current = false
                }}
              >
                {isEdit ? 'Lưu thay đổi' : 'Tạo thuyền viên'}
              </Button>
            </div>
            {isEdit && changedKeys.length ? (
              <p className="sf-savebar__note">
                <WarningOutlined aria-hidden />
                Mỗi lần sửa được ghi vào lịch sử hồ sơ. Bộ giấy chưa ký xong của người này sẽ chuyển sang Cần làm lại.
              </p>
            ) : null}
          </div>
        </Form>
      </div>
     </ScanContext.Provider>
     </AiMarksContext.Provider>
    </ChangedContext.Provider>
  )
}

// Ảnh (File/Blob) → data URL để hiện trong <img>.
function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
