import { useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Descriptions,
  Tag,
  Table,
  Spin,
  Grid,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Space,
  Tabs,
  App,
  Row,
  Col,
  AutoComplete,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  ScanOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { seafarerApi, deploymentApi, lookupApi, vesselApi } from '../../api'
import CertificatesSection from '../../components/seafarer/CertificatesSection'
import SeamanBooksSection from '../../components/seafarer/SeamanBooksSection'
import SeamanBookScanDrawer from '../../components/seafarer/SeamanBookScanDrawer'
import useAuthStore from '../../stores/authStore'
import ZaloButton from '../../components/common/ZaloButton'
import FormExportTab from '../../components/seafarer/FormExportTab'
import { formatEducationLevelLabel } from '../../constants/educationLevels'
import { formatEnglishOverallLevelLabel } from '../../constants/englishOverallLevel'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR = {
  STANDBY: 'green',
  ONBOARD: 'gold',
  OFFSHIFT: 'orange',
  RESERVE: 'blue',
  SIGNOFF: 'red',
}
const STATUS_LABEL = {
  STANDBY: 'Sẵn sàng',
  ONBOARD: 'Đang tàu',
  OFFSHIFT: 'Nghỉ ca',
  RESERVE: 'Dự trữ',
  SIGNOFF: 'Rời tàu',
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

const educationGrayHeadingStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#595959',
  marginBottom: 12,
  padding: '8px 10px',
  background: '#FAFAFA',
  borderBottom: '1px solid #D9D9D9',
}

/** Bảng đào tạo/tốt nghiệp: trường - khoa/ngành - từ năm - đến năm - bằng cấp (tương ứng mẫu CV). */
function buildEducationTrainingRows(apiRows, seafarerProfile) {
  const list = Array.isArray(apiRows) ? apiRows : []
  if (list.length > 0) {
    return list.map((r, idx) => ({
      key: String(r.id ?? `edu-${idx}`),
      school_name: (r.school_name && String(r.school_name).trim()) || '-',
      department: (r.major && String(r.major).trim()) || '-',
      from_year:
        r.enrollment_year != null && r.enrollment_year !== '' ? String(r.enrollment_year) : '-',
      to_year:
        r.graduation_year != null && r.graduation_year !== '' ? String(r.graduation_year) : '-',
      degree: (r.graduation_level && String(r.graduation_level).trim()) || '-',
      degree_rating:
        r.degree_rating && String(r.degree_rating).trim()
          ? String(r.degree_rating).trim().toUpperCase()
          : '-',
    }))
  }
  const school = seafarerProfile?.education_school?.trim?.()
  const major = seafarerProfile?.education_major?.trim?.()
  if (school || major) {
    return [
      {
        key: 'legacy-profile-fields',
        school_name: school || '-',
        department: major || '-',
        from_year: '-',
        to_year: '-',
        degree: '-',
        degree_rating: '-',
      },
    ]
  }
  return []
}

const educationTrainingColumns = [
  {
    title: 'Bằng cấp',
    dataIndex: 'degree',
    key: 'degree',
    width: 168,
    align: 'left',
    render: (v) => formatEducationLevelLabel(v === '-' ? null : v),
  },
  {
    title: 'Trường',
    dataIndex: 'school_name',
    key: 'school_name',
    width: 160,
    ellipsis: { showTitle: true },
  },
  {
    title: 'Ngành',
    dataIndex: 'department',
    key: 'department',
    width: 140,
    ellipsis: true,
  },
  { title: 'Từ', dataIndex: 'from_year', key: 'from_year', width: 72, align: 'center' },
  { title: 'Đến', dataIndex: 'to_year', key: 'to_year', width: 72, align: 'center' },
  {
    title: 'Degree',
    dataIndex: 'degree_rating',
    key: 'degree_rating',
    width: 100,
    align: 'center',
    render: (v) => (v && v !== '-' ? v : '-'),
  },
]

export default function SeafarerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const { user } = useAuthStore()
  const isReadOnly = !['admin', 'operator', 'chuyen_vien'].includes(user?.role)
  const canEditStatus = ['admin', 'operator'].includes(user?.role)

  const screens = useBreakpoint()
  const isMobile = !screens.md
  const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  )

  const { data: seafarer, isLoading } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => seafarerApi.update(id, { status }),
    onSuccess: () => {
      message.success('Cập nhật trạng thái thành công')
      queryClient.invalidateQueries({ queryKey: ['seafarer', id] })
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => seafarerApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa thuyền viên')
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      navigate('/seafarers')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete() {
    modal.confirm({
      title: 'Xác nhận xóa thuyền viên',
      content: `Bạn có chắc muốn xóa "${seafarer?.full_name}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteMutation.mutateAsync(),
    })
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!seafarer)
    return (
      <div style={{ marginTop: 80, textAlign: 'center', color: '#999' }}>
        Không tìm thấy thuyền viên.
      </div>
    )

  const tabKeys = ['profile', 'deployment', 'certificates', 'seaman-books', 'bank', 'forms']
  const activeTab = tabKeys.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'profile'

  const tabItems = [
    {
      key: 'profile',
      label: 'Hồ sơ cá nhân',
      children: (
        <>
          <ProfileSection
            s={seafarer}
            apiOrigin={apiOrigin}
            seafarerId={id}
            isReadOnly={isReadOnly}
          />
          <ContactsSection seafarerId={id} />
        </>
      ),
    },
    {
      key: 'deployment',
      label: 'Quá trình đi biển',
      children: (
        <DeploymentSection seafarerId={id} currentRankId={seafarer.current_rank_id || null} />
      ),
    },
    {
      key: 'certificates',
      label: 'Chứng chỉ',
      children: <CertificatesSection seafarerId={id} />,
    },
    {
      key: 'seaman-books',
      label: 'Sổ thuyền viên',
      children: <SeamanBooksSection seafarerId={id} isReadOnly={isReadOnly} />,
    },
    {
      key: 'bank',
      label: 'Số tài khoản',
      children: <FinanceSection s={seafarer} seafarerId={id} isReadOnly={isReadOnly} />,
    },
    {
      key: 'forms',
      label: (
        <span>
          <FileExcelOutlined /> Xuất biểu mẫu
        </span>
      ),
      children: <FormExportTab seafarerId={parseInt(id)} seafarerName={seafarer.full_name} />,
    },
  ]

  return (
    <div>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#fff',
          borderBottom: '1px solid #E8E8E8',
          padding: isMobile ? '8px 12px' : '10px 0',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/seafarers')} />
        <span
          style={{
            fontSize: isMobile ? 15 : 18,
            fontWeight: 600,
            color: '#262626',
            flex: 1,
            minWidth: 80,
          }}
        >
          {seafarer.full_name}
        </span>
        {canEditStatus ? (
          <Select
            size="small"
            value={seafarer.status}
            loading={statusMutation.isPending}
            onChange={(val) => statusMutation.mutate(val)}
            style={{ width: 110 }}
            options={[
              {
                value: 'STANDBY',
                label: (
                  <Tag color={STATUS_COLOR.STANDBY} style={{ margin: 0 }}>
                    {STATUS_LABEL.STANDBY}
                  </Tag>
                ),
              },
              {
                value: 'ONBOARD',
                label: (
                  <Tag color={STATUS_COLOR.ONBOARD} style={{ margin: 0 }}>
                    {STATUS_LABEL.ONBOARD}
                  </Tag>
                ),
              },
              {
                value: 'OFFSHIFT',
                label: (
                  <Tag color={STATUS_COLOR.OFFSHIFT} style={{ margin: 0 }}>
                    {STATUS_LABEL.OFFSHIFT}
                  </Tag>
                ),
              },
              {
                value: 'RESERVE',
                label: (
                  <Tag color={STATUS_COLOR.RESERVE} style={{ margin: 0 }}>
                    {STATUS_LABEL.RESERVE}
                  </Tag>
                ),
              },
              {
                value: 'SIGNOFF',
                label: (
                  <Tag color={STATUS_COLOR.SIGNOFF} style={{ margin: 0 }}>
                    {STATUS_LABEL.SIGNOFF}
                  </Tag>
                ),
              },
            ]}
          />
        ) : (
          <Tag color={STATUS_COLOR[seafarer.status]} style={{ margin: 0 }}>
            {STATUS_LABEL[seafarer.status] || seafarer.status}
          </Tag>
        )}
        {!isReadOnly && (
          <Button
            danger
            icon={<DeleteOutlined />}
            size={isMobile ? 'small' : 'middle'}
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            {isMobile ? '' : 'Xóa'}
          </Button>
        )}
      </div>

      <Tabs
        items={tabItems}
        activeKey={activeTab}
        onChange={(key) => {
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tab', key)
          setSearchParams(nextParams, { replace: true })
        }}
      />
    </div>
  )
}

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')

function Section({ title, children, noPad, extra }) {
  return (
    <div style={sectionStyle}>
      <div
        style={{
          ...sectionHeaderStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{title}</span>
        {extra}
      </div>
      <div style={{ ...sectionBodyStyle, padding: noPad ? 0 : 16 }}>{children}</div>
    </div>
  )
}

function DescList({ fields, isMobile }) {
  return (
    <Descriptions
      column={isMobile ? 1 : 2}
      bordered
      size="small"
      styles={{ label: { width: 160, background: '#fafafa' } }}
    >
      {fields.map(([label, value]) => (
        <Descriptions.Item key={label} label={label}>
          {value ?? '-'}
        </Descriptions.Item>
      ))}
    </Descriptions>
  )
}

function ProfileSection({ s, apiOrigin, seafarerId, isReadOnly }) {
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const { data: educationApiRows, isLoading: educationLoading } = useQuery({
    queryKey: ['seafarer-educations', seafarerId],
    queryFn: () =>
      seafarerApi.getEducations(seafarerId).then((res) => {
        const body = res.data
        return Array.isArray(body) ? body : (body?.data ?? [])
      }),
  })

  const trainingTableData = buildEducationTrainingRows(educationApiRows, s)

  const langColumns = [
    { title: 'Language', dataIndex: 'language', width: 100 },
    {
      title: 'Level',
      dataIndex: 'level',
      width: 120,
      render: (text) => text || '-',
    },
    { title: 'Listening', dataIndex: 'listening', width: 90 },
    { title: 'Spoken', dataIndex: 'spoken', width: 90 },
    { title: 'Reading', dataIndex: 'reading', width: 90 },
    { title: 'Writing', dataIndex: 'writing', width: 90 },
  ]
  const levelDisplay =
    s.english_level != null && String(s.english_level).trim()
      ? formatEnglishOverallLevelLabel(s.english_level)
      : '-'
  const langData = [
    {
      key: 'en',
      language: 'English',
      level: levelDisplay,
      listening: s.english_listening || '-',
      spoken: s.english_spoken || '-',
      reading: s.english_reading || '-',
      writing: s.english_writing || '-',
    },
  ]
  const avatarSrc = s.avatar_url
    ? /^https?:\/\//i.test(s.avatar_url)
      ? s.avatar_url
      : `${apiOrigin}${s.avatar_url.startsWith('/') ? '' : '/'}${s.avatar_url}`
    : ''
  const queQuan = [s.permanent_ward, s.permanent_district, s.permanent_province]
    .filter(Boolean)
    .join(', ')
  const fields = [
    ['Mã thuyền viên', s.seafarer_code],
    ['Rank', s.rank_code],
    [
      'Ảnh thuyền viên',
      avatarSrc ? (
        <img
          src={avatarSrc}
          alt="avatar"
          style={{ width: 100, height: 130, objectFit: 'cover', border: '1px solid #d9d9d9' }}
        />
      ) : (
        '-'
      ),
    ],
    ['Họ và tên', s.full_name],
    ['Tên tiếng Trung', s.full_name_cn],
    ['Ngày sinh', fmt(s.date_of_birth)],
    ['Giới tính', s.gender === 'M' ? 'Nam' : s.gender === 'F' ? 'Nữ' : '—'],
    [
      'SĐT',
      s.phone_primary ? (
        <span>
          {s.phone_primary}
          <ZaloButton phone={s.phone_primary} />
        </span>
      ) : (
        '-'
      ),
    ],
    ['Tình trạng hôn nhân', s.marital_status],
    ['Quốc tịch', s.nationality_name],
    ['CCCD', s.national_id],
    ['Ngày cấp CCCD', fmt(s.national_id_issued_date)],
    ['Số hộ chiếu', s.passport_number],
    ['Ngày cấp hộ chiếu', fmt(s.passport_issued_date)],
    ['Ngày hết hạn hộ chiếu', fmt(s.passport_expiry)],
    ['Quê quán', queQuan || '-'],
    ['Nơi sinh', s.place_of_birth],
    ['Địa chỉ thường trú', s.permanent_address || '-'],
    ['Chiều cao (cm)', s.height_cm],
    ['Cân nặng (kg)', s.weight_kg],
    ['Nhóm máu', s.blood_type],
    ['Size giày', s.shoe_size],
    ['Size bảo hộ', s.protective_size],
  ]
  return (
    <Section
      title="Hồ sơ cá nhân"
      extra={
        !isReadOnly && (
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/seafarers/${seafarerId}/edit`)}
          >
            Chỉnh sửa
          </Button>
        )
      }
    >
      <DescList fields={fields} isMobile={isMobile} />
      <div style={{ marginTop: 16 }}>
        <div style={educationGrayHeadingStyle}>Đào tạo và tốt nghiệp</div>
        <Table
          rowKey="key"
          columns={educationTrainingColumns}
          dataSource={trainingTableData}
          loading={educationLoading}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Chưa có quá trình đào tạo' }}
          scroll={{ x: 'max-content' }}
        />

        {s.education_graduation_date && (
          <div style={{ padding: '6px 0 4px', fontSize: 13, color: '#595959' }}>
            Ngày tốt nghiệp: <strong>{fmt(s.education_graduation_date)}</strong>
          </div>
        )}

        <div style={{ ...educationGrayHeadingStyle, marginTop: 16 }}>Trình độ tiếng Anh</div>
        <Table
          rowKey="key"
          columns={langColumns}
          dataSource={langData}
          size="small"
          pagination={false}
          showHeader
          scroll={{ x: 'max-content' }}
        />
      </div>
    </Section>
  )
}

function FinanceSection({ s, seafarerId, isReadOnly }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const saveMutation = useMutation({
    mutationFn: (values) => seafarerApi.update(seafarerId, values),
    onSuccess: async () => {
      message.success('Cập nhật tài khoản thành công')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seafarer', seafarerId] }),
        queryClient.invalidateQueries({ queryKey: ['seafarers'] }),
      ])
      setOpen(false)
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  function openModal() {
    form.setFieldsValue({
      personal_bank_account_holder: s.personal_bank_account_holder,
      personal_bank_name: s.personal_bank_name,
      personal_bank_branch: s.personal_bank_branch,
      personal_bank_account_number: s.personal_bank_account_number,
      salary_bank_account_holder: s.salary_bank_account_holder,
      salary_bank_name: s.salary_bank_name,
      salary_bank_branch: s.salary_bank_branch,
      salary_bank_account_number: s.salary_bank_account_number,
    })
    setOpen(true)
  }

  const personalFields = [
    ['Chủ tài khoản', s.personal_bank_account_holder],
    ['Tên ngân hàng', s.personal_bank_name],
    ['Chi nhánh', s.personal_bank_branch],
    ['Số tài khoản', s.personal_bank_account_number],
  ]
  const salaryFields = [
    ['Chủ tài khoản', s.salary_bank_account_holder],
    ['Tên ngân hàng', s.salary_bank_name],
    ['Chi nhánh', s.salary_bank_branch],
    ['Số tài khoản', s.salary_bank_account_number],
  ]

  return (
    <Section
      title="Số tài khoản"
      extra={
        !isReadOnly && (
          <Button size="small" icon={<EditOutlined />} onClick={openModal}>
            Chỉnh sửa
          </Button>
        )
      }
    >
      <div style={{ marginBottom: 8, fontWeight: 500, color: '#595959' }}>Tài khoản cá nhân</div>
      <DescList fields={personalFields} isMobile={isMobile} />
      <div style={{ margin: '12px 0 8px', fontWeight: 500, color: '#595959' }}>
        Tài khoản nhận lương
      </div>
      <DescList fields={salaryFields} isMobile={isMobile} />

      <Modal
        title="Chỉnh sửa số tài khoản"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width="min(560px, 95vw)"
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <div
            style={{
              marginBottom: 12,
              paddingLeft: 8,
              borderLeft: '3px solid #1677ff',
              fontWeight: 600,
              fontSize: 13,
              color: '#262626',
            }}
          >
            Tài khoản cá nhân
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Chủ tài khoản" name="personal_bank_account_holder">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Tên ngân hàng" name="personal_bank_name">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Chi nhánh" name="personal_bank_branch">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Số tài khoản" name="personal_bank_account_number">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <div
            style={{
              marginBottom: 12,
              marginTop: 4,
              paddingLeft: 8,
              borderLeft: '3px solid #1677ff',
              fontWeight: 600,
              fontSize: 13,
              color: '#262626',
            }}
          >
            Tài khoản nhận lương
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Chủ tài khoản" name="salary_bank_account_holder">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Tên ngân hàng" name="salary_bank_name">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Chi nhánh" name="salary_bank_branch">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Số tài khoản" name="salary_bank_account_number">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Section>
  )
}

const DEPLOYMENT_STATUS_COLOR = {
  collecting_docs: 'default',
  confirmed: 'blue',
  pre_boarding: 'orange',
  onboard: 'green',
  signed_off: 'default',
  cancelled: 'red',
}
const DEPLOYMENT_STATUS_LABEL = {
  collecting_docs: 'Thu giấy tờ',
  confirmed: 'Đã chốt tàu',
  pre_boarding: 'Chuẩn bị nhập tàu',
  onboard: 'Đang tàu',
  signed_off: 'Đã rời tàu',
  cancelled: 'Đã hủy',
}

function hasQuickDeploymentData(row) {
  const normalizedRow = normalizeQuickDeploymentRow(row)
  if (!normalizedRow) return false
  return Boolean(
    normalizedRow.join_date ||
      normalizedRow.sign_off_date ||
      normalizedRow.vessel_name ||
      normalizedRow.rank_id != null
  )
}

function normalizeQuickDeploymentRow(row) {
  if (!row) return null
  return {
    vessel_name: typeof row.vessel_name === 'string' ? row.vessel_name.trim() : '',
    rank_id: row.rank_id ?? null,
    join_date: row.join_date || null,
    sign_off_date: row.sign_off_date || null,
  }
}

function DeploymentSection({ seafarerId, currentRankId }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [scanOpen, setScanOpen] = useState(false)
  const [inlineRow, setInlineRow] = useState(null)
  const [vesselSearchOpen, setVesselSearchOpen] = useState(false)
  const [vesselSearchQ, setVesselSearchQ] = useState('')
  const [vesselSearchResults, setVesselSearchResults] = useState([])
  const [vesselSearchLoading, setVesselSearchLoading] = useState(false)
  const vesselSearchTimer = useRef(null) // { vessel_name, rank_id, join_date }
  const inlineSearchTimer = useRef(null)
  const [inlineVesselOptions, setInlineVesselOptions] = useState([])
  const [inlineVesselId, setInlineVesselId] = useState(null)
  const [selectedVesselInfo, setSelectedVesselInfo] = useState(null)
  const [inlineVesselDetail, setInlineVesselDetail] = useState(null)
  const [fetchingVesselDetail, setFetchingVesselDetail] = useState(false)
  const inlineHasData = hasQuickDeploymentData(inlineRow, currentRankId)

  const { data, isLoading } = useQuery({
    queryKey: ['deployments', seafarerId],
    queryFn: () => deploymentApi.list(seafarerId).then((r) => r.data),
  })

  const { data: ranks = [] } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  function handleVesselSearchQ(value) {
    setVesselSearchQ(value)
    clearTimeout(vesselSearchTimer.current)
    if (value.length < 2) {
      setVesselSearchResults([])
      return
    }
    setVesselSearchLoading(true)
    vesselSearchTimer.current = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        setVesselSearchResults(res.data || [])
      } catch {
        setVesselSearchResults([])
      } finally {
        setVesselSearchLoading(false)
      }
    }, 350)
  }

  async function applyVesselSelection(vesselInfo) {
    setInlineRow((p) => ({ ...p, vessel_name: vesselInfo.ship_name || vesselInfo.vessel_name }))
    setInlineVesselId(vesselInfo.vessel_id || null)
    setSelectedVesselInfo(vesselInfo)
    setInlineVesselDetail(null)
    if (vesselInfo.vessel_id) {
      setFetchingVesselDetail(true)
      try {
        const res = await vesselApi.getById(vesselInfo.vessel_id)
        setInlineVesselDetail(res.data)
      } catch {
        /* bỏ qua */
      } finally {
        setFetchingVesselDetail(false)
      }
    }
  }

  function handleVesselSearchSelect(vessel) {
    applyVesselSelection(vessel)
    setVesselSearchOpen(false)
    setVesselSearchQ('')
    setVesselSearchResults([])
  }

  const deleteDeploymentMutation = useMutation({
    mutationFn: (id) => deploymentApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa')
      queryClient.invalidateQueries({ queryKey: ['deployments', seafarerId] })
    },
    onError: () => message.error('Xóa thất bại'),
  })

  const inlineSaveMutation = useMutation({
    mutationFn: async (row) => {
      const normalizedRow = normalizeQuickDeploymentRow(row)
      let vessel_id = inlineVesselId
      if (!vessel_id) {
        const matched = inlineVesselOptions.find((o) => o.value === normalizedRow.vessel_name)
        if (matched?.imo_no && /^\d{7}$/.test(String(matched.imo_no))) {
          try {
            const res = await vesselApi.create({
              vessel_name: normalizedRow.vessel_name,
              imo_number: String(matched.imo_no),
            })
            vessel_id = res.data?.id || null
          } catch {
            /* bỏ qua nếu đã tồn tại */
          }
        }
      }
      const createdDeployment = await deploymentApi.create(seafarerId, {
        vessel_id: vessel_id || undefined,
        vessel_name: normalizedRow.vessel_name || null,
        rank_id: normalizedRow.rank_id,
        join_date: normalizedRow.join_date,
        sign_off_date: normalizedRow.sign_off_date,
      })

      const shouldUpdateCurrentRank =
        normalizedRow.rank_id && normalizedRow.rank_id !== (currentRankId ?? null)
      let currentRankUpdated = true
      let currentRankUpdateError = null
      if (shouldUpdateCurrentRank) {
        try {
          await seafarerApi.update(seafarerId, { current_rank_id: normalizedRow.rank_id })
        } catch (error) {
          currentRankUpdated = false
          currentRankUpdateError = error
        }
      }

      return { createdDeployment, currentRankUpdated, currentRankUpdateError }
    },
    onSuccess: (result) => {
      if (result.currentRankUpdated === false) {
        message.warning(
          result.currentRankUpdateError?.response?.data?.error ||
            'Đã thêm quá trình đi biển nhưng chưa cập nhật rank hiện tại của thuyền viên'
        )
      } else {
        message.success('Thêm quá trình đi biển thành công')
      }
      queryClient.invalidateQueries({ queryKey: ['deployments', seafarerId] })
      queryClient.invalidateQueries({ queryKey: ['seafarer', seafarerId] })
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      setInlineRow(null)
      setInlineVesselOptions([])
      setInlineVesselId(null)
      setSelectedVesselInfo(null)
      setInlineVesselDetail(null)
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm thất bại'),
  })

  function handleInlineVesselSearch(value) {
    setInlineRow((prev) => ({ ...prev, vessel_name: value }))
    setInlineVesselId(null)
    setSelectedVesselInfo(null)
    setInlineVesselDetail(null)
    clearTimeout(inlineSearchTimer.current)
    if (value.length < 2) {
      setInlineVesselOptions([])
      return
    }
    inlineSearchTimer.current = setTimeout(async () => {
      try {
        const res = await vesselApi.nameSearch(value)
        setInlineVesselOptions(
          (res.data || []).map((v) => ({
            value: v.ship_name || '',
            vessel_id: v.vessel_id || null,
            imo_no: v.imo_no,
            ship_type: v.ship_type || null,
            country_name: v.country_name || null,
            label: (
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{v.ship_name}</strong>
                <span style={{ color: '#999', fontSize: 11 }}>
                  {v.vessel_id ? '✅' : '🔍'}
                  {v.imo_no ? ` IMO ${v.imo_no}` : ''}
                </span>
              </span>
            ),
          }))
        )
      } catch {
        setInlineVesselOptions([])
      }
    }, 350)
  }

  const columns = [
    {
      title: 'Tên tàu',
      dataIndex: 'vessel_name',
      render: (v, r) =>
        r._inline ? (
          <div>
            <Space size={4}>
              <AutoComplete
                options={inlineVesselOptions}
                value={inlineRow?.vessel_name}
                onChange={handleInlineVesselSearch}
                onSelect={(_, opt) => {
                  applyVesselSelection({
                    ship_name: opt.value,
                    vessel_id: opt.vessel_id || null,
                    imo_no: opt.imo_no,
                    ship_type: opt.ship_type,
                    country_name: opt.country_name,
                  })
                }}
                dropdownStyle={{ minWidth: 300 }}
                style={{ width: 160 }}
              >
                <Input size="small" placeholder="Tên tàu..." onClick={(e) => e.stopPropagation()} />
              </AutoComplete>
              <Tooltip title="Tìm tàu">
                <Button
                  size="small"
                  icon={<SearchOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setVesselSearchOpen(true)
                    setVesselSearchQ(inlineRow?.vessel_name || '')
                    if (inlineRow?.vessel_name?.length >= 2)
                      handleVesselSearchQ(inlineRow.vessel_name)
                  }}
                />
              </Tooltip>
            </Space>
            {selectedVesselInfo?.imo_no && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.3 }}>
                IMO {selectedVesselInfo.imo_no}
                {selectedVesselInfo.vessel_id ? ' ✅' : ' 🔍'}
              </div>
            )}
          </div>
        ) : (
          v || '-'
        ),
    },
    {
      title: 'Rank',
      dataIndex: 'rank_code',
      render: (v, r) =>
        r._inline ? (
          <Select
            size="small"
            style={{ width: 140 }}
            placeholder="Chức danh"
            value={inlineRow?.rank_id}
            onChange={(val) => setInlineRow((p) => ({ ...p, rank_id: val ?? null }))}
            options={ranks.map((rk) => ({ value: rk.id, label: rk.code }))}
            showSearch
            optionFilterProp="label"
            allowClear
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          v || '-'
        ),
    },
    {
      title: 'Ngày nhập tàu',
      dataIndex: 'join_date',
      render: (v, r) =>
        r._inline ? (
          <DatePicker
            size="small"
            format="DD/MM/YYYY"
            placeholder="Nhập tàu"
            value={inlineRow?.join_date ? dayjs(inlineRow.join_date) : null}
            onChange={(d) =>
              setInlineRow((p) => ({ ...p, join_date: d ? d.format('YYYY-MM-DD') : null }))
            }
            onClick={(e) => e.stopPropagation()}
            style={{ width: 130 }}
          />
        ) : v ? (
          dayjs(v).format('DD/MM/YYYY')
        ) : (
          '-'
        ),
    },
    {
      title: 'Ngày rời tàu',
      dataIndex: 'sign_off_date',
      render: (v, r) =>
        r._inline ? (
          <DatePicker
            size="small"
            format="DD/MM/YYYY"
            placeholder="Rời tàu"
            value={inlineRow?.sign_off_date ? dayjs(inlineRow.sign_off_date) : null}
            onChange={(d) =>
              setInlineRow((p) => ({ ...p, sign_off_date: d ? d.format('YYYY-MM-DD') : null }))
            }
            onClick={(e) => e.stopPropagation()}
            style={{ width: 130 }}
          />
        ) : v ? (
          dayjs(v).format('DD/MM/YYYY')
        ) : (
          '-'
        ),
    },
    {
      title: 'Loại tàu',
      dataIndex: 'vessel_type',
      render: (v, r) =>
        r._inline
          ? inlineVesselDetail?.vessel_type || selectedVesselInfo?.ship_type || null
          : v || '-',
    },
    {
      title: 'GRT/DWT',
      render: (_, r) => {
        if (r._inline) {
          const grt = inlineVesselDetail?.gross_tonnage
          const dwt = inlineVesselDetail?.deadweight
          if (!grt && !dwt) return fetchingVesselDetail ? <Spin size="small" /> : null
          return `${grt ?? '-'}/${dwt ?? '-'}`
        }
        const grt = r.vessel_grt ?? '-'
        const dwt = r.vessel_dwt ?? '-'
        return `${grt}/${dwt}`
      },
    },
    {
      title: 'Loại máy',
      dataIndex: 'vessel_engine_type',
      render: (v, r) => (r._inline ? inlineVesselDetail?.engine_type || null : v || '-'),
    },
    {
      title: 'Công suất (kW)',
      dataIndex: 'main_engine_kw',
      render: (v, r) => (r._inline ? (inlineVesselDetail?.engine_power_kw ?? null) : (v ?? '-')),
    },
    {
      title: 'Cờ tàu',
      dataIndex: 'vessel_flag',
      render: (v, r) =>
        r._inline
          ? inlineVesselDetail?.flag_country || selectedVesselInfo?.country_name || null
          : v || '-',
    },
    {
      title: 'Vùng',
      dataIndex: 'operating_area',
      render: (v, r) => (r._inline ? inlineVesselDetail?.trade_area || null : v || '-'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v, r) => {
        if (r._inline) return null
        if (v === 'onboard') return <Tag color="green">Sign on</Tag>
        if (v === 'signed_off') return <Tag color="default">Sign off</Tag>
        return (
          <Tag color={DEPLOYMENT_STATUS_COLOR[v] || 'default'}>
            {DEPLOYMENT_STATUS_LABEL[v] || v}
          </Tag>
        )
      },
    },
    {
      title: '',
      width: 100,
      render: (_, r) => {
        if (r._inline)
          return (
            <Space size={4}>
              <Button
                size="small"
                type="primary"
                disabled={!inlineHasData}
                loading={inlineSaveMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!hasQuickDeploymentData(inlineRow, currentRankId)) return
                  inlineSaveMutation.mutate(inlineRow)
                }}
              >
                Lưu
              </Button>
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setInlineRow(null)
                  setInlineVesselOptions([])
                  setInlineVesselId(null)
                  setSelectedVesselInfo(null)
                  setInlineVesselDetail(null)
                }}
              >
                Hủy
              </Button>
            </Space>
          )
        return (
          <Space size={2}>
            <Tooltip title="Xóa record này">
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  Modal.confirm({
                    title: 'Xóa record đi biển?',
                    content: `Xóa "${r.vessel_name || 'record này'}"?`,
                    okText: 'Xóa',
                    okType: 'danger',
                    cancelText: 'Hủy',
                    onOk: () => deleteDeploymentMutation.mutateAsync(r.id),
                  })
                }}
              />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  return (
    <Section title="Quá trình đi biển" noPad>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button
          icon={<PlusOutlined />}
          size="small"
          type="primary"
          onClick={() => {
            if (!inlineRow) {
              setInlineRow({
                vessel_name: '',
                rank_id: currentRankId || null,
                join_date: null,
                sign_off_date: null,
              })
              setInlineVesselOptions([])
              setInlineVesselId(null)
            }
          }}
        >
          Thêm nhanh
        </Button>
        <Button icon={<ScanOutlined />} size="small" onClick={() => setScanOpen(true)}>
          Scan sổ thuyền viên
        </Button>
        <Button type="link" onClick={() => navigate('/deployments')}>
          Mở module Điều động
        </Button>
      </div>

      <SeamanBookScanDrawer
        seafarerId={seafarerId}
        open={scanOpen}
        onClose={() => setScanOpen(false)}
      />

      <Modal
        title="Tìm tàu"
        open={vesselSearchOpen}
        onCancel={() => {
          setVesselSearchOpen(false)
          setVesselSearchQ('')
          setVesselSearchResults([])
        }}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Input
          autoFocus
          placeholder="Nhập tên tàu..."
          prefix={<SearchOutlined />}
          value={vesselSearchQ}
          onChange={(e) => handleVesselSearchQ(e.target.value)}
          allowClear
          style={{ marginBottom: 12 }}
        />
        <Table
          rowKey={(r) => r.imo_no || r.vessel_id || r.ship_name}
          size="small"
          loading={vesselSearchLoading}
          dataSource={vesselSearchResults}
          pagination={false}
          scroll={{ y: 320 }}
          onRow={(r) => ({
            onClick: () => handleVesselSearchSelect(r),
            style: { cursor: 'pointer' },
          })}
          columns={[
            {
              title: 'Tên tàu',
              dataIndex: 'ship_name',
              render: (v, r) => (
                <span>
                  {v}
                  {r.vessel_id && (
                    <Tag color="success" style={{ marginLeft: 6, fontSize: 11 }}>
                      Đã có
                    </Tag>
                  )}
                </span>
              ),
            },
            { title: 'IMO', dataIndex: 'imo_no', width: 90, render: (v) => v || '-' },
            { title: 'Loại', dataIndex: 'ship_type', width: 120, render: (v) => v || '-' },
            { title: 'Quốc gia', dataIndex: 'country_name', width: 100, render: (v) => v || '-' },
          ]}
          locale={{
            emptyText: vesselSearchQ.length < 2 ? 'Nhập ít nhất 2 ký tự' : 'Không tìm thấy',
          }}
        />
      </Modal>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={[
          ...(inlineRow ? [{ id: '_inline', _inline: true }] : []),
          ...(data?.data || data || []),
        ]}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={(r) =>
          r._inline
            ? {}
            : {
                onClick: () => navigate(`/deployments/${r.id}`),
                style: { cursor: 'pointer' },
              }
        }
        rowClassName={(r) => (r._inline ? 'ant-table-row-inline-add' : '')}
      />
    </Section>
  )
}

function ContactsSection({ seafarerId }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['seafarer-contacts', seafarerId],
    queryFn: () => seafarerApi.getContacts(seafarerId).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values) =>
      seafarerApi.createContact(seafarerId, {
        ...values,
        date_of_birth: values.date_of_birth?.format?.('YYYY-MM-DD') || undefined,
      }),
    onSuccess: () => {
      message.success('Thêm liên hệ thành công')
      setAddOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['seafarer-contacts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (contactId) => seafarerApi.deleteContact(seafarerId, contactId),
    onSuccess: () => {
      message.success('Đã xóa liên hệ')
      queryClient.invalidateQueries({ queryKey: ['seafarer-contacts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: (values) =>
      seafarerApi.updateContact(seafarerId, editingContact.id, {
        ...values,
        date_of_birth: values.date_of_birth?.format?.('YYYY-MM-DD') || undefined,
      }),
    onSuccess: () => {
      message.success('Cập nhật liên hệ thành công')
      setEditOpen(false)
      setEditingContact(null)
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['seafarer-contacts', seafarerId] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  function handleDelete(row) {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa liên hệ "${row.full_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(row.id),
    })
  }

  function openEdit(row) {
    setEditingContact(row)
    editForm.setFieldsValue({
      full_name: row.full_name,
      relationship: row.relationship,
      date_of_birth: row.date_of_birth ? dayjs(row.date_of_birth) : null,
      address: row.address,
      phone: row.phone,
    })
    setEditOpen(true)
  }

  const columns = [
    { title: 'Họ tên', dataIndex: 'full_name' },
    { title: 'Quan hệ', dataIndex: 'relationship' },
    {
      title: 'Năm sinh',
      dataIndex: 'date_of_birth',
      render: (v) => (v ? dayjs(v).format('YYYY') : '-'),
    },
    { title: 'SĐT', dataIndex: 'phone', render: (v) => v || '-' },
    { title: 'Địa chỉ', dataIndex: 'address', render: (v) => v || '-' },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
        </Space>
      ),
    },
  ]

  return (
    <Section title="Người thân / Bảo lãnh" noPad>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          Thêm liên hệ
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data || []}
        loading={isLoading}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="Thêm người thân / Bảo lãnh"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        footer={null}
        width="min(480px, 95vw)"
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="relationship" label="Quan hệ" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'Vợ', label: 'Vợ' },
                { value: 'Chồng', label: 'Chồng' },
                { value: 'Bố', label: 'Bố' },
                { value: 'Mẹ', label: 'Mẹ' },
                { value: 'Con', label: 'Con' },
                { value: 'Anh/Chị/Em', label: 'Anh/Chị/Em' },
                { value: 'Khác', label: 'Khác' },
              ]}
            />
          </Form.Item>
          <Form.Item name="date_of_birth" label="Năm sinh">
            <DatePicker picker="year" format="YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setAddOpen(false)
                  form.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Sửa người thân / Bảo lãnh"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setEditingContact(null)
          editForm.resetFields()
        }}
        footer={null}
        width="min(480px, 95vw)"
      >
        <Form form={editForm} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="relationship" label="Quan hệ" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'Vợ', label: 'Vợ' },
                { value: 'Chồng', label: 'Chồng' },
                { value: 'Bố', label: 'Bố' },
                { value: 'Mẹ', label: 'Mẹ' },
                { value: 'Con', label: 'Con' },
                { value: 'Anh/Chị/Em', label: 'Anh/Chị/Em' },
                { value: 'Khác', label: 'Khác' },
              ]}
            />
          </Form.Item>
          <Form.Item name="date_of_birth" label="Năm sinh">
            <DatePicker picker="year" format="YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setEditOpen(false)
                  setEditingContact(null)
                  editForm.resetFields()
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                Lưu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Section>
  )
}
