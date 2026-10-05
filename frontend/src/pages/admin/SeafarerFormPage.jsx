import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  message,
  Spin,
  Row,
  Col,
  Table,
  Grid,
  Radio,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons'
import { seafarerApi, lookupApi } from '../../api'
import CccdQrScanModal from '../../components/CccdQrScanModal'
import { parseCccdQr } from '../../utils/cccdQrParser'
import { EDUCATION_LEVEL_OPTIONS } from '../../constants/educationLevels'
import { EDUCATION_DEGREE_RATING_OPTIONS } from '../../constants/educationDegreeRating'
import { ENGLISH_OVERALL_LEVEL_OPTIONS } from '../../constants/englishOverallLevel'
import dayjs from 'dayjs'

function DateInput({ value, onChange, style }) {
  const [digits, setDigits] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value && dayjs.isDayjs(value) && value.isValid()) setDigits(value.format('DDMMYYYY'))
     
    else if (!value) setDigits('')
  }, [value])

  function toDisplay(d) {
    const ph = ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y']
    const c = Array.from({ length: 8 }, (_, i) => (i < d.length ? d[i] : ph[i]))
    return `${c[0]}${c[1]}/${c[2]}${c[3]}/${c[4]}${c[5]}${c[6]}${c[7]}`
  }

  function commit(d) {
    if (d.length === 8) {
      const parsed = dayjs(`${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`, 'DD/MM/YYYY', true)
      onChange?.(parsed.isValid() ? parsed : null)
    } else {
      onChange?.(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      const next = digits.slice(0, -1)
      setDigits(next)
      commit(next)
    } else if (/^\d$/.test(e.key) && digits.length < 8) {
      e.preventDefault()
      const next = digits + e.key
      setDigits(next)
      commit(next)
    } else if (!['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    setDigits(d)
    commit(d)
  }

  return (
    <Input
      value={toDisplay(digits)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={() => {}}
      style={{ ...style, fontFamily: 'monospace' }}
    />
  )
}

const sectionStyle = {
  background: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: 2,
  marginBottom: 16,
}

const sectionHeaderStyle = {
  padding: '10px 16px',
  borderBottom: '1px solid #D9D9D9',
  fontWeight: 600,
  fontSize: 13,
  color: '#003366',
  background: '#FAFAFA',
}

const sectionBodyStyle = {
  padding: 16,
}

const stickyActionBarStyle = {
  position: 'sticky',
  bottom: 0,
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  padding: '12px 16px',
  background: '#fff',
  borderTop: '1px solid #D9D9D9',
  zIndex: 10,
}

/** Đồng bộ với SeafarerDetailPage - tiêu đề phụ học vấn */
const educationGrayHeadingStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#595959',
  marginBottom: 12,
  padding: '8px 10px',
  background: '#FAFAFA',
  borderBottom: '1px solid #D9D9D9',
}

const EMPTY_EDUCATION_TRAINING_ROW = {
  school_name: '',
  major: '',
  enrollment_year: undefined,
  graduation_year: undefined,
  graduation_level: '',
  degree_rating: '',
}

function parseOptionalYear(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number.parseInt(String(v).trim(), 10)
  return Number.isFinite(n) ? n : null
}

function trimNullable(s, maxLen) {
  if (s == null) return null
  if (typeof s !== 'string') return null
  const t = s.trim()
  if (!t) return null
  return maxLen ? t.slice(0, maxLen) : t
}

function buildInitialEducationTrainings(apiRows, seafarerProfile) {
  const list = Array.isArray(apiRows) ? apiRows : []
  if (list.length > 0) {
    return list.map((r) => ({
      school_name: r.school_name || '',
      major: r.major ?? '',
      enrollment_year:
        r.enrollment_year != null && r.enrollment_year !== ''
          ? Number(r.enrollment_year)
          : undefined,
      graduation_year:
        r.graduation_year != null && r.graduation_year !== ''
          ? Number(r.graduation_year)
          : undefined,
      graduation_level: r.graduation_level ?? '',
      degree_rating:
        r.degree_rating != null && String(r.degree_rating).trim()
          ? String(r.degree_rating).trim().toUpperCase()
          : '',
    }))
  }
  const school = seafarerProfile?.education_school?.trim?.() || ''
  const major = seafarerProfile?.education_major?.trim?.() || ''
  if (school || major) {
    return [{ ...EMPTY_EDUCATION_TRAINING_ROW, school_name: school, major }]
  }
  return [{ ...EMPTY_EDUCATION_TRAINING_ROW }]
}

function GraduationLevelSelect({ value, onChange, ...rest }) {
  const hasLegacy =
    value != null && value !== '' && !EDUCATION_LEVEL_OPTIONS.some((o) => o.value === value)
  const legacyOption = hasLegacy ? [{ value, label: `${value} (cũ - chọn lại để chuẩn hóa)` }] : []
  return (
    <Select
      placeholder="Chọn bằng cấp"
      allowClear
      options={[...EDUCATION_LEVEL_OPTIONS, ...legacyOption]}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      {...rest}
    />
  )
}

/** Chuẩn hóa casing cho Select (a → A khi là A/B/C). */
function normalizeEnglishLevelFormValue(raw) {
  if (raw == null || raw === '') return ''
  const t = String(raw).trim()
  const u = t.toUpperCase()
  if (ENGLISH_OVERALL_LEVEL_OPTIONS.some((o) => o.value === u)) return u
  return t
}

function EnglishOverallLevelSelect({ value, onChange, ...rest }) {
  const hasLegacy =
    value != null &&
    value !== '' &&
    !ENGLISH_OVERALL_LEVEL_OPTIONS.some((o) => o.value === String(value).trim().toUpperCase())
  const legacyOption = hasLegacy ? [{ value, label: `${value} (cũ - chọn A / B / C cho CV)` }] : []
  return (
    <Select
      placeholder="A / B / C"
      allowClear
      options={[...ENGLISH_OVERALL_LEVEL_OPTIONS, ...legacyOption]}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      {...rest}
    />
  )
}

function DegreeRatingSelect({ value, onChange, ...rest }) {
  const hasLegacy =
    value != null && value !== '' && !EDUCATION_DEGREE_RATING_OPTIONS.some((o) => o.value === value)
  const legacyOption = hasLegacy
    ? [{ value, label: `${value} (cũ - chọn EXCELLENT/GOOD/FAIR/POOR)` }]
    : []
  return (
    <Select
      placeholder="Degree…"
      allowClear
      options={[...EDUCATION_DEGREE_RATING_OPTIONS, ...legacyOption]}
      style={{ width: '100%' }}
      value={value}
      onChange={onChange}
      {...rest}
    />
  )
}

function normalizeDegreeRatingForPayload(v) {
  if (v == null || v === '') return undefined
  const t = String(v).trim().toUpperCase().slice(0, 20)
  if (!t) return undefined
  return EDUCATION_DEGREE_RATING_OPTIONS.some((o) => o.value === t) ? t : undefined
}

function normalizeTrainingForApi(rows) {
  return (rows || [])
    .map((r) => ({
      school_name: String(r?.school_name ?? '').trim(),
      major: trimNullable(r?.major, 200),
      graduation_level: trimNullable(r?.graduation_level, 50),
      degree_rating: normalizeDegreeRatingForPayload(r?.degree_rating),
      enrollment_year: parseOptionalYear(r?.enrollment_year),
      graduation_year: parseOptionalYear(r?.graduation_year),
    }))
    .filter((r) => r.school_name)
}

function Section({ title, children }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>{title}</div>
      <div style={sectionBodyStyle}>{children}</div>
    </div>
  )
}

function buildFileUrl(apiOrigin, url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${apiOrigin}${url}`
  return `${apiOrigin}/${url}`
}

const { useBreakpoint } = Grid

export default function SeafarerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const isEdit = Boolean(id)
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  )

  const { data: seafarer, isLoading: loadingSeafarer } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
    enabled: isEdit,
  })

  const { data: educationApiRows, isLoading: loadingEducations } = useQuery({
    queryKey: ['seafarer-educations', id],
    queryFn: () =>
      seafarerApi.getEducations(id).then((res) => {
        const body = res.data
        return Array.isArray(body) ? body : (body?.data ?? [])
      }),
    enabled: isEdit,
  })

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  // Mặc định quốc tịch Việt Nam khi tạo mới
  useEffect(() => {
    if (isEdit || !countries?.length) return
    const vietnam = countries.find((c) => c.name_vi === 'Việt Nam')
    if (vietnam) form.setFieldValue('nationality_id', vietnam.id)
  }, [isEdit, countries, form])

  useEffect(() => {
    if (!isEdit || !seafarer || loadingEducations) return

    const list = Array.isArray(educationApiRows) ? educationApiRows : []
    const education_trainings = buildInitialEducationTrainings(list, seafarer)

    form.setFieldsValue({
      ...seafarer,
      english_level: normalizeEnglishLevelFormValue(seafarer.english_level),
      date_of_birth: seafarer.date_of_birth ? dayjs(seafarer.date_of_birth) : null,
      national_id_issued_date: seafarer.national_id_issued_date
        ? dayjs(seafarer.national_id_issued_date)
        : null,
      passport_issued_date: seafarer.passport_issued_date
        ? dayjs(seafarer.passport_issued_date)
        : null,
      passport_expiry: seafarer.passport_expiry ? dayjs(seafarer.passport_expiry) : null,
      education_graduation_date: seafarer.education_graduation_date
        ? dayjs(seafarer.education_graduation_date)
        : null,
      education_trainings,
    })
  }, [seafarer, educationApiRows, loadingEducations, isEdit, form])

  const effectiveAvatarPreview =
    avatarPreview || (seafarer?.avatar_url ? buildFileUrl(apiOrigin, seafarer.avatar_url) : '')

  const mutation = useMutation({
    mutationFn: async ({ seafarerPayload, trainingPayload }) => {
      const saved = isEdit
        ? await seafarerApi.update(id, seafarerPayload).then((r) => r.data)
        : await seafarerApi.create(seafarerPayload).then((r) => r.data)

      if (avatarFile) {
        await seafarerApi.uploadAvatar(saved.id, avatarFile).then((r) => r.data)
      }

      await seafarerApi.updateEducations(saved.id, trainingPayload)
      return saved
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      queryClient.invalidateQueries({ queryKey: ['seafarer', id] })
      queryClient.invalidateQueries({ queryKey: ['seafarer-educations', String(data.id)] })
      message.success(isEdit ? 'Cập nhật thành công' : 'Tạo thuyền viên thành công')
      navigate(`/seafarers/${data.id}`)
    },
    onError: (err) => {
      message.error(err.response?.data?.error || 'Có lỗi xảy ra')
    },
  })

  const handleCccdScanned = (raw) => {
    const data = parseCccdQr(raw)
    if (!data) {
      message.error('Không đọc được dữ liệu CCCD. Vui lòng thử lại.')
      return
    }
    form.setFieldsValue({
      national_id: data.national_id || undefined,
      full_name: data.full_name || undefined,
      date_of_birth: data.date_of_birth || undefined,
      gender: data.gender,
      permanent_province: data.permanent_province || undefined,
      permanent_district: data.permanent_district || undefined,
      permanent_ward: data.permanent_ward || undefined,
      permanent_address: data.permanent_address || undefined,
      national_id_issued_date: data.national_id_issued_date || undefined,
    })
    message.success('Đã điền thông tin từ CCCD')
  }

  const onFinish = (values) => {
    const { education_trainings, ...rest } = values
    const payload = { ...rest }
    if (payload.date_of_birth) payload.date_of_birth = payload.date_of_birth.format('YYYY-MM-DD')
    if (payload.national_id_issued_date)
      payload.national_id_issued_date = payload.national_id_issued_date.format('YYYY-MM-DD')
    if (payload.passport_issued_date)
      payload.passport_issued_date = payload.passport_issued_date.format('YYYY-MM-DD')
    if (payload.passport_expiry)
      payload.passport_expiry = payload.passport_expiry.format('YYYY-MM-DD')
    if (payload.education_graduation_date)
      payload.education_graduation_date = payload.education_graduation_date.format('YYYY-MM-DD')

    const trainingPayload = normalizeTrainingForApi(education_trainings)
    const first = trainingPayload[0]
    payload.education_school = first ? first.school_name.slice(0, 200) : null
    payload.education_major = first?.major != null ? String(first.major).slice(0, 150) : null
    payload.english_score = null

    mutation.mutate({ seafarerPayload: payload, trainingPayload })
  }

  if (isEdit && (loadingSeafarer || loadingEducations))
    return <Spin style={{ display: 'block', marginTop: 80 }} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(isEdit ? `/seafarers/${id}` : '/seafarers')}
        />
        <span style={{ fontSize: 18, fontWeight: 600, color: '#262626' }}>
          {isEdit ? 'Chỉnh sửa thuyền viên' : 'Thêm thuyền viên mới'}
        </span>
        <Button
          icon={<QrcodeOutlined />}
          onClick={() => setScanOpen(true)}
          style={{ marginLeft: 'auto' }}
        >
          Quét QR CCCD
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={{
          education_trainings: [{ ...EMPTY_EDUCATION_TRAINING_ROW }],
        }}
      >
        <Section title="Hồ sơ cá nhân">
          {/* --- Thông tin từ QR CCCD --- */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Họ và tên"
                name="full_name"
                rules={[{ required: true, message: 'Nhập họ và tên' }]}
              >
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tên tiếng Trung" name="full_name_cn">
                <Input placeholder="李庆光" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Ngày sinh"
                name="date_of_birth"
                rules={[{ required: true, message: 'Chọn ngày sinh' }]}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  placeholder="DD/MM/YYYY"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Giới tính" name="gender">
                <Radio.Group>
                  <Radio value="M">Nam</Radio>
                  <Radio value="F">Nữ</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số CCCD" name="national_id">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày cấp CCCD" name="national_id_issued_date">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Quê quán">
                <Row gutter={8}>
                  <Col xs={8}>
                    <Form.Item name="permanent_ward" noStyle>
                      <Input placeholder="Xã/Phường" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={8}>
                    <Form.Item name="permanent_district" noStyle>
                      <Input placeholder="Quận/Huyện" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={8}>
                    <Form.Item name="permanent_province" noStyle>
                      <Input placeholder="Tỉnh/TP" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Địa chỉ thường trú" name="permanent_address">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nơi sinh" name="place_of_birth">
                <Input placeholder="Hải Phòng" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ borderTop: '1px solid #F0F0F0', margin: '4px 0 16px' }} />

          {/* --- Thông tin bổ sung --- */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Mã thuyền viên" name="seafarer_code">
                <Input placeholder="TV-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Rank hiện tại" name="current_rank_id">
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn rank"
                  filterOption={(input, opt) =>
                    opt.label.toLowerCase().includes(input.toLowerCase())
                  }
                  options={(ranks || []).map((r) => ({
                    value: r.id,
                    label: r.code,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="SĐT chính" name="phone_primary">
                <Input placeholder="0901234567" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tình trạng hôn nhân" name="marital_status">
                <Select
                  allowClear
                  placeholder="Chọn tình trạng"
                  options={[
                    { value: 'Độc thân', label: 'Độc thân' },
                    { value: 'Đã kết hôn', label: 'Đã kết hôn' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Quốc tịch"
                name="nationality_id"
                rules={[{ required: true, message: 'Chọn quốc tịch' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn quốc tịch"
                  filterOption={(input, opt) =>
                    opt.label.toLowerCase().includes(input.toLowerCase())
                  }
                  options={(countries || []).map((c) => ({ value: c.id, label: c.name_vi }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số hộ chiếu" name="passport_number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày cấp hộ chiếu" name="passport_issued_date">
                <DateInput style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày hết hạn hộ chiếu" name="passport_expiry">
                <DateInput style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ảnh thuyền viên">
                <Input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setAvatarFile(file)
                    if (file) {
                      setAvatarPreview(URL.createObjectURL(file))
                    } else if (seafarer?.avatar_url) {
                      setAvatarPreview(buildFileUrl(apiOrigin, seafarer.avatar_url))
                    } else {
                      setAvatarPreview('')
                    }
                  }}
                />
                {effectiveAvatarPreview ? (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={effectiveAvatarPreview}
                      alt="avatar-preview"
                      style={{
                        width: 120,
                        height: 150,
                        objectFit: 'cover',
                        border: '1px solid #d9d9d9',
                      }}
                    />
                  </div>
                ) : null}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Chiều cao (cm)" name="height_cm">
                <Input type="number" placeholder="170" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cân nặng (kg)" name="weight_kg">
                <Input type="number" placeholder="65" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nhóm máu" name="blood_type">
                <Select
                  allowClear
                  showSearch
                  placeholder="A / B / AB / O"
                  options={[
                    { value: 'A', label: 'A' },
                    { value: 'B', label: 'B' },
                    { value: 'AB', label: 'AB' },
                    { value: 'O', label: 'O' },
                    { value: 'A+', label: 'A+' },
                    { value: 'A-', label: 'A-' },
                    { value: 'B+', label: 'B+' },
                    { value: 'B-', label: 'B-' },
                    { value: 'AB+', label: 'AB+' },
                    { value: 'AB-', label: 'AB-' },
                    { value: 'O+', label: 'O+' },
                    { value: 'O-', label: 'O-' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Size giày" name="shoe_size">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Size bảo hộ" name="protective_size">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Section>

        <Section title="Học vấn">
          <div style={educationGrayHeadingStyle}>Đào tạo và tốt nghiệp</div>
          <Form.List name="education_trainings">
            {(fields, { remove }) =>
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: 4,
                        padding: 12,
                        background: '#fafafa',
                      }}
                    >
                      <Form.Item
                        label="Bằng cấp"
                        name={[field.name, 'graduation_level']}
                        style={{ marginBottom: 8 }}
                      >
                        <GraduationLevelSelect />
                      </Form.Item>
                      <Form.Item
                        label="Trường"
                        name={[field.name, 'school_name']}
                        rules={[{ max: 255, message: 'Tối đa 255 ký tự' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="Tên trường…" />
                      </Form.Item>
                      <Form.Item
                        label="Ngành"
                        name={[field.name, 'major']}
                        rules={[{ max: 200, message: 'Tối đa 200 ký tự' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="VD: Điều khiển tàu…" />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item
                            label="Từ"
                            name={[field.name, 'enrollment_year']}
                            style={{ marginBottom: 8 }}
                          >
                            <Input
                              type="number"
                              min={1900}
                              max={2100}
                              placeholder="Năm"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="Đến"
                            name={[field.name, 'graduation_year']}
                            style={{ marginBottom: 8 }}
                          >
                            <Input
                              type="number"
                              min={1900}
                              max={2100}
                              placeholder="Năm"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        label="Degree"
                        name={[field.name, 'degree_rating']}
                        style={{ marginBottom: fields.length > 1 ? 8 : 0 }}
                      >
                        <DegreeRatingSelect />
                      </Form.Item>
                      {fields.length > 1 && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                        >
                          Xóa dòng này
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="key"
                  scroll={{ x: 'max-content' }}
                  dataSource={fields}
                  columns={[
                    {
                      title: 'Bằng cấp',
                      width: 180,
                      render: (_, field) => (
                        <Form.Item
                          name={[field.name, 'graduation_level']}
                          style={{ marginBottom: 0 }}
                        >
                          <GraduationLevelSelect />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Trường',
                      width: 160,
                      ellipsis: true,
                      render: (_, field) => (
                        <Form.Item
                          name={[field.name, 'school_name']}
                          rules={[{ max: 255, message: 'Tối đa 255 ký tự' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Tên trường…" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Ngành',
                      width: 150,
                      ellipsis: true,
                      render: (_, field) => (
                        <Form.Item
                          name={[field.name, 'major']}
                          rules={[{ max: 200, message: 'Tối đa 200 ký tự' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="VD: Điều khiển tàu…" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Từ',
                      width: 80,
                      align: 'center',
                      render: (_, field) => (
                        <Form.Item
                          name={[field.name, 'enrollment_year']}
                          style={{ marginBottom: 0 }}
                        >
                          <Input type="number" min={1900} max={2100} placeholder="Năm" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Đến',
                      width: 80,
                      align: 'center',
                      render: (_, field) => (
                        <Form.Item
                          name={[field.name, 'graduation_year']}
                          style={{ marginBottom: 0 }}
                        >
                          <Input type="number" min={1900} max={2100} placeholder="Năm" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Degree',
                      width: 110,
                      align: 'center',
                      render: (_, field) => (
                        <Form.Item name={[field.name, 'degree_rating']} style={{ marginBottom: 0 }}>
                          <DegreeRatingSelect />
                        </Form.Item>
                      ),
                    },
                    ...(fields.length > 1
                      ? [
                          {
                            title: '',
                            width: 48,
                            align: 'center',
                            render: (_, field) => (
                              <Button
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                aria-label="Xóa dòng"
                                onClick={() => remove(field.name)}
                              />
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              )
            }
          </Form.List>

          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={12}>
              <Form.Item label="Ngày tốt nghiệp (chính)" name="education_graduation_date">
                <DateInput style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ ...educationGrayHeadingStyle, marginTop: 4 }}>Trình độ tiếng Anh</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Level"
                name="english_level"
                extra="Giá trị này được xuất ra file CV tiếng Anh."
              >
                <EnglishOverallLevelSelect />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Listening" name="english_listening">
                <Input placeholder="Good, Fair..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Spoken" name="english_spoken">
                <Input placeholder="Good, Fair..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Reading" name="english_reading">
                <Input placeholder="Good, Fair..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Writing" name="english_writing">
                <Input placeholder="Good, Fair..." />
              </Form.Item>
            </Col>
          </Row>
        </Section>

        <div style={{ height: 72 }} />
        <div style={stickyActionBarStyle}>
          <Button onClick={() => navigate(isEdit ? `/seafarers/${id}` : '/seafarers')}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo thuyền viên'}
          </Button>
        </div>
      </Form>

      <CccdQrScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={handleCccdScanned}
      />
    </div>
  )
}
