import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Descriptions, Tag, Spin, Grid, message, App } from 'antd'
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { vesselApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'

const { useBreakpoint } = Grid

const VESSEL_STATUS_COLOR = {
  IN_SERVICE: 'green',
  LAID_UP: 'orange',
  SCRAPPED: 'red',
  UNDER_CONSTRUCTION: 'blue',
}
const VESSEL_STATUS_LABEL = {
  IN_SERVICE: 'Đang hoạt động',
  LAID_UP: 'Nằm bờ',
  SCRAPPED: 'Phá dỡ',
  UNDER_CONSTRUCTION: 'Đang đóng',
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

function Section({ title, children, extra }) {
  return (
    <div style={sectionStyle}>
      <div
        style={{
          ...sectionHeaderStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{title}</span>
        {extra}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function DescList({ fields, isMobile }) {
  return (
    <Descriptions
      column={isMobile ? 1 : 2}
      bordered
      size="small"
      styles={{ label: { width: 180, background: '#fafafa' } }}
    >
      {fields.map(([label, value]) => (
        <Descriptions.Item key={label} label={label}>
          {value ?? '-'}
        </Descriptions.Item>
      ))}
    </Descriptions>
  )
}

const num = (v) => (v != null ? Number(v).toLocaleString() : '-')

/** Hiển thị vùng hoạt động: cột trade_area hoặc fallback JSON trong notes (đồng bộ lookup) */
function displayTradeArea(vessel) {
  const raw = vessel?.trade_area
  if (raw != null && String(raw).trim() !== '') return String(raw).trim()
  try {
    const n = vessel?.notes
    if (typeof n === 'string' && n.trim().startsWith('{')) {
      const j = JSON.parse(n)
      if (j.trade_area != null && String(j.trade_area).trim() !== '')
        return String(j.trade_area).trim()
    }
  } catch {
    /* ignore invalid notes JSON */
  }
  return null
}

export default function VesselDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const { user } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const isReadOnly =
    user?.role !== 'admin' && user?.role !== 'operator' && user?.role !== 'accountant'

  const { data: vessel, isLoading } = useQuery({
    queryKey: ['vessel', id],
    queryFn: () => vesselApi.getById(id).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: () => vesselApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa tàu')
      queryClient.invalidateQueries({ queryKey: ['partner-vessels'] })
      navigate('/vessels')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  const refreshFromInternetMutation = useMutation({
    mutationFn: () => vesselApi.fetchExternalByImo(vessel?.imo_number, true),
    onSuccess: () => {
      message.success('Đã cập nhật thông tin tàu mới nhất từ internet')
      queryClient.invalidateQueries({ queryKey: ['vessel', id] })
      queryClient.invalidateQueries({ queryKey: ['master-vessels'] })
      queryClient.invalidateQueries({ queryKey: ['partner-vessels'] })
    },
    onError: (e) =>
      message.error(e.response?.data?.error || 'Không thể cập nhật thông tin tàu từ internet'),
  })

  function handleDelete() {
    modal.confirm({
      title: 'Xác nhận xóa tàu',
      content: `Bạn có chắc muốn xóa tàu "${vessel?.vessel_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteMutation.mutateAsync(),
    })
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!vessel)
    return (
      <div style={{ marginTop: 80, textAlign: 'center', color: '#999' }}>Không tìm thấy tàu.</div>
    )

  return (
    <div>
      {/* Header */}
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/vessels')} />
        <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: '#262626', flex: 1 }}>
          {vessel.vessel_name}
        </span>
        <Tag color={VESSEL_STATUS_COLOR[vessel.status] || 'default'}>
          {VESSEL_STATUS_LABEL[vessel.status] || vessel.status}
        </Tag>
        {!isReadOnly && (
          <Button
            icon={<ReloadOutlined />}
            loading={refreshFromInternetMutation.isPending}
            onClick={() => refreshFromInternetMutation.mutate()}
          >
            {isMobile ? '' : 'Lấy mới từ internet'}
          </Button>
        )}
        {!isReadOnly && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/partners/vessels/${id}/edit`)}>
            {isMobile ? '' : 'Chỉnh sửa'}
          </Button>
        )}
        {!isReadOnly && (
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            {isMobile ? '' : 'Xóa'}
          </Button>
        )}
      </div>

      <ViewMode vessel={vessel} isMobile={isMobile} />
    </div>
  )
}

function ViewMode({ vessel, isMobile }) {
  return (
    <>
      {/* Block 1: Nhận diện tàu */}
      <Section title="Nhận diện tàu">
        <DescList
          isMobile={isMobile}
          fields={[
            ['Số IMO', vessel.imo_number],
            ['Tên tàu', vessel.vessel_name],
            ['Call Sign', vessel.call_sign],
            ['Loại tàu', vessel.vessel_type_name],
            ['Cờ quốc gia', vessel.flag_country_name],
            ['Năm đóng', vessel.year_built || '-'],
            ['Chủ tàu', vessel.ship_owner_name || '-'],
            ['Vùng hoạt động', displayTradeArea(vessel)],
          ]}
        />
      </Section>

      {/* Block 3: Thông số kỹ thuật */}
      <Section title="Thông số kỹ thuật">
        <DescList
          isMobile={isMobile}
          fields={[
            ['GRT (Gross Tonnage)', num(vessel.gross_tonnage)],
            ['NRT (Net Tonnage)', num(vessel.net_tonnage)],
            ['DWT (Deadweight)', num(vessel.deadweight)],
            ['Chiều dài (LOA)', vessel.length_overall ? `${vessel.length_overall} m` : '-'],
            ['Công suất máy', vessel.engine_power_kw ? `${num(vessel.engine_power_kw)} kW` : '-'],
            ['Loại động cơ', vessel.engine_type],
          ]}
        />
      </Section>
    </>
  )
}
