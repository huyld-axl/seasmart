import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Select, Switch, Space, Spin, message, Grid } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { vesselApi, lookupApi } from '../../../api'

const { useBreakpoint } = Grid

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

/** Giá trị ban đầu cho form: trade_area hoặc fallback từ notes JSON */
function initialTradeArea(vessel) {
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
    /* ignore */
  }
  return ''
}

function Section({ title, children }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>{title}</div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

export default function VesselEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [form] = Form.useForm()

  const { data: vessel, isLoading } = useQuery({
    queryKey: ['vessel', id],
    queryFn: () => vesselApi.getById(id).then((r) => r.data),
  })

  useEffect(() => {
    if (!vessel) return
    form.setFieldsValue({
      vessel_name: vessel.vessel_name,
      vessel_name_prev: vessel.vessel_name_prev,
      imo_number: vessel.imo_number,
      mmsi: vessel.mmsi,
      call_sign: vessel.call_sign,
      trade_area: initialTradeArea(vessel),
      vessel_type: vessel.vessel_type ?? null,
      flag_country: vessel.flag_country ?? null,
      ship_owner_name: vessel.ship_owner_name || '',
      ship_owner_code: vessel.ship_owner_code || '',
      gross_tonnage: vessel.gross_tonnage,
      net_tonnage: vessel.net_tonnage,
      deadweight: vessel.deadweight,
      length_overall: vessel.length_overall,
      year_built: vessel.year_built,
      status: vessel.status,
      engine_power_kw: vessel.engine_power_kw,
      engine_type: vessel.engine_type,
      dp_class: vessel.dp_class,
      has_boiler: !!vessel.has_boiler,
      has_refrigeration: !!vessel.has_refrigeration,
      passenger_capacity: vessel.passenger_capacity,
      crew_capacity: vessel.crew_capacity,
      classification_society: vessel.classification_society,
      class_status: vessel.class_status,
      technical_manager: vessel.technical_manager,
      commercial_manager: vessel.commercial_manager,
      notes: vessel.notes,
    })
  }, [vessel, form])

  const { data: vesselTypes } = useQuery({
    queryKey: ['vessel-types-distinct'],
    queryFn: () => vesselApi.vesselTypes().then((r) => r.data),
  })

  const { data: countries } = useQuery({
    queryKey: ['countries-lookup'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (values) => vesselApi.update(id, values),
    onSuccess: () => {
      message.success('Cập nhật thành công')
      queryClient.invalidateQueries({ queryKey: ['vessel', id] })
      queryClient.invalidateQueries({ queryKey: ['partner-vessels'] })
      navigate(`/partners/vessels/${id}`)
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
    gap: '0 16px',
  }

  const vesselTypeOptions = (vesselTypes || []).map((t) => ({ value: t, label: t }))
  const countryOptions = (countries || [])
    .map((c) => ({
      value: (c.name_vi || c.name_en || c.code || '').trim() || String(c.id),
      label: c.name_vi || c.name_en,
    }))
    .filter((o) => o.value)

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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/partners/vessels/${id}`)} />
        <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: '#262626', flex: 1 }}>
          Chỉnh sửa: {vessel.vessel_name}
        </span>
        <Space>
          <Button onClick={() => navigate(`/partners/vessels/${id}`)}>Hủy</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={updateMutation.isPending}
            onClick={() => form.submit()}
          >
            Lưu
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical" onFinish={(v) => updateMutation.mutate(v)}>
        <Section title="Nhận diện tàu">
          <div style={gridStyle}>
            <Form.Item name="vessel_name" label="Tên tàu">
              <Input placeholder="Không bắt buộc" />
            </Form.Item>
            <Form.Item
              name="imo_number"
              label="Số IMO"
              rules={[
                { required: true, message: 'Nhập số IMO' },
                { pattern: /^\d{7}$/, message: 'IMO phải gồm đúng 7 chữ số' },
              ]}
            >
              <Input placeholder="Ví dụ: 9551052" />
            </Form.Item>
            <Form.Item name="mmsi" label="MMSI">
              <Input />
            </Form.Item>
            <Form.Item name="call_sign" label="Call Sign">
              <Input />
            </Form.Item>
            <Form.Item name="year_built" label="Năm đóng">
              <Input type="number" placeholder="2005" />
            </Form.Item>
            <Form.Item name="vessel_type" label="Loại tàu">
              <Select options={vesselTypeOptions} allowClear placeholder="Chọn loại" />
            </Form.Item>
            <Form.Item name="flag_country" label="Cờ quốc gia">
              <Select
                options={countryOptions}
                allowClear
                showSearch
                placeholder="Chọn quốc gia"
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item name="trade_area" label="Vùng hoạt động">
              <Input placeholder="Ví dụ: Châu Á – Thái Bình Dương" maxLength={255} showCount />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select
                options={[
                  { value: 'IN_SERVICE', label: 'Đang hoạt động' },
                  { value: 'LAID_UP', label: 'Nằm bờ' },
                  { value: 'UNDER_CONSTRUCTION', label: 'Đang đóng' },
                  { value: 'SCRAPPED', label: 'Phá dỡ' },
                ]}
              />
            </Form.Item>
          </div>
        </Section>

        <Section title="Thông số kỹ thuật">
          <div style={gridStyle}>
            <Form.Item name="gross_tonnage" label="GRT">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="net_tonnage" label="NRT">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="deadweight" label="DWT">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="length_overall" label="Chiều dài LOA (m)">
              <Input type="number" />
            </Form.Item>
            <Form.Item name="engine_power_kw" label="Công suất máy (kW)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="engine_type" label="Loại động cơ">
              <Input placeholder="Diesel / Steam / Gas Turbine" />
            </Form.Item>
            <Form.Item name="dp_class" label="DP Class">
              <Select
                allowClear
                placeholder="Không có DP"
                options={[
                  { value: 'DPS-1', label: 'DPS-1' },
                  { value: 'DPS-2', label: 'DPS-2' },
                  { value: 'DPS-3', label: 'DPS-3' },
                ]}
              />
            </Form.Item>
            <Form.Item name="passenger_capacity" label="Sức chứa hành khách">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="crew_capacity" label="Định biên thuyền viên">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>
          <Space size="large">
            <Form.Item
              name="has_boiler"
              label="Nồi hơi"
              valuePropName="checked"
              style={{ margin: 0 }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="has_refrigeration"
              label="Lạnh / Refrigeration"
              valuePropName="checked"
              style={{ margin: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        </Section>

        <Section title="Đăng kiểm">
          <div style={gridStyle}>
            <Form.Item name="classification_society" label="Tổ chức đăng kiểm">
              <Input placeholder="VD: DNV, Lloyd's, BV..." />
            </Form.Item>
            <Form.Item name="class_status" label="Trạng thái đăng kiểm">
              <Select
                allowClear
                options={[
                  { value: 'CLASSED', label: 'Còn class' },
                  { value: 'SUSPENDED', label: 'Tạm dừng' },
                  { value: 'WITHDRAWN', label: 'Rút đăng kiểm' },
                  { value: 'NOT_CLASSED', label: 'Không đăng kiểm' },
                ]}
              />
            </Form.Item>
          </div>
        </Section>

        <Section title="Ghi chú">
          <Form.Item name="notes" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Section>
      </Form>
    </div>
  )
}
