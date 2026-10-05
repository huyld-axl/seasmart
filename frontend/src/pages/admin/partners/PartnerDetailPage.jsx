import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Descriptions,
  Form,
  Grid,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import { jobApi, partnerApi } from '../../../api'
import useAuthStore from '../../../stores/authStore'

const { useBreakpoint } = Grid

const PAYMENT_CYCLES = [
  { value: 'WEEKLY', label: 'Hàng tuần' },
  { value: 'BIWEEKLY', label: '2 tuần / kỳ' },
  { value: 'MONTHLY', label: 'Hàng tháng' },
  { value: 'YEARLY', label: 'Theo năm' },
  { value: 'PER_VOYAGE', label: 'Theo chuyến' },
]
const PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'OTHER', label: 'Khác' },
]

const paymentCycleLabel = (value) =>
  PAYMENT_CYCLES.find((x) => x.value === value)?.label || value || '-'
const paymentMethodLabel = (value) =>
  PAYMENT_METHOD_OPTIONS.find((x) => x.value === value)?.label || value || '-'

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
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
const sectionBodyStyle = { padding: 16 }

function Section({ title, extra, children }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <span>{title}</span>
        {extra}
      </div>
      <div style={sectionBodyStyle}>{children}</div>
    </div>
  )
}

export default function PartnerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()
  const { user } = useAuthStore()
  const isReadOnly = !['admin', 'operator'].includes(user?.role)
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [isEditing, setIsEditing] = useState(false)
  const [form] = Form.useForm()

  const { data: partner, isLoading } = useQuery({
    queryKey: ['partner-detail', id],
    queryFn: () => partnerApi.getById(id).then((r) => r.data),
  })

  const { data: partnerJobs } = useQuery({
    queryKey: ['partner-jobs', id],
    queryFn: () => jobApi.list({ partner_id: id, limit: 50 }).then((r) => r.data),
  })

  useEffect(() => {
    if (!partner) return
    form.setFieldsValue({
      ...partner,
      is_active: !!partner.is_active,
    })
  }, [partner, form])

  const updateMutation = useMutation({
    mutationFn: (values) => partnerApi.update(id, values),
    onSuccess: () => {
      message.success('Đã cập nhật đối tác')
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['partner-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive) => partnerApi.update(id, { is_active: isActive }),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái')
      queryClient.invalidateQueries({ queryKey: ['partner-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['partners'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => partnerApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa đối tác')
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      navigate('/partners')
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete() {
    modal.confirm({
      title: 'Xác nhận xóa',
      content: `Xóa đối tác "${partner.company_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutateAsync(),
    })
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />
  if (!partner)
    return (
      <div style={{ marginTop: 80, textAlign: 'center', color: '#999' }}>
        Không tìm thấy đối tác.
      </div>
    )

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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/partners')} />
        <span
          style={{
            fontSize: isMobile ? 15 : 18,
            fontWeight: 600,
            color: '#262626',
            flex: 1,
            minWidth: 80,
          }}
        >
          {partner.company_name || '-'}
        </span>
        <Tag color={partner.is_active ? 'green' : 'default'} style={{ margin: 0 }}>
          {partner.is_active ? 'Hoạt động' : 'Ngừng'}
        </Tag>
        {!isReadOnly && !isEditing && (
          <Switch
            size="small"
            checked={!!partner.is_active}
            loading={toggleActiveMutation.isPending}
            onChange={(val) => toggleActiveMutation.mutate(val)}
          />
        )}
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!isEditing ? (
              <Button
                icon={<EditOutlined />}
                size={isMobile ? 'small' : 'middle'}
                onClick={() => setIsEditing(true)}
              >
                Chỉnh sửa
              </Button>
            ) : (
              <>
                <Button size={isMobile ? 'small' : 'middle'} onClick={() => setIsEditing(false)}>
                  Hủy
                </Button>
                <Button
                  type="primary"
                  size={isMobile ? 'small' : 'middle'}
                  loading={updateMutation.isPending}
                  onClick={() => form.submit()}
                >
                  Lưu
                </Button>
              </>
            )}
            {!isEditing && (
              <Button
                danger
                icon={<DeleteOutlined />}
                size={isMobile ? 'small' : 'middle'}
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                Xóa
              </Button>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <Form form={form} layout="vertical" onFinish={(values) => updateMutation.mutate(values)}>
          <Section title="Thông tin công ty">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '0 16px',
              }}
            >
              <Form.Item name="code" label="Mã">
                <Input />
              </Form.Item>
              <Form.Item
                name="company_name"
                label="Tên công ty"
                rules={[{ required: true, message: 'Nhập tên công ty' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="representative" label="Người đại diện">
                <Input />
              </Form.Item>
              <Form.Item name="tax_id" label="Mã số thuế">
                <Input />
              </Form.Item>
            </div>
            <Form.Item name="address" label="Địa chỉ">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Section>

          <Section title="Liên hệ">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '0 16px',
              }}
            >
              <Form.Item name="contact_person" label="Người liên hệ">
                <Input />
              </Form.Item>
              <Form.Item name="contact_phone" label="SĐT liên hệ">
                <Input />
              </Form.Item>
              <Form.Item name="contact_email" label="Email liên hệ">
                <Input />
              </Form.Item>
            </div>
          </Section>

          <Section title="Thanh toán">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '0 16px',
              }}
            >
              <Form.Item name="payment_cycle" label="Kỳ thanh toán">
                <Select options={PAYMENT_CYCLES} allowClear />
              </Form.Item>
              <Form.Item name="payment_method" label="Phương thức thanh toán">
                <Select options={PAYMENT_METHOD_OPTIONS} allowClear />
              </Form.Item>
              <Form.Item name="payment_account_name" label="Tên tài khoản thanh toán">
                <Input />
              </Form.Item>
              <Form.Item name="payment_account_number" label="Số tài khoản thanh toán">
                <Input />
              </Form.Item>
              <Form.Item name="payment_bank_name" label="Ngân hàng">
                <Input />
              </Form.Item>
              <Form.Item name="payment_bank_branch" label="Chi nhánh ngân hàng">
                <Input />
              </Form.Item>
              <Form.Item name="commission_rate" label="Hoa hồng (%)">
                <Input type="number" min={0} max={100} step={0.1} suffix="%" />
              </Form.Item>
            </div>
            <Form.Item name="payment_terms" label="Điều khoản thanh toán">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Section>

          <Section title="Ghi chú">
            <Form.Item name="notes" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </Section>
        </Form>
      ) : (
        <>
          <Section title="Thông tin công ty">
            <Descriptions column={isMobile ? 1 : 2} bordered size="small">
              <Descriptions.Item label="Mã">{partner.code || '-'}</Descriptions.Item>
              <Descriptions.Item label="Tên công ty">
                {partner.company_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Người đại diện">
                {partner.representative || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Mã số thuế">{partner.tax_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={isMobile ? 1 : 2}>
                {partner.address || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Section>

          <Section title="Liên hệ">
            <Descriptions column={isMobile ? 1 : 2} bordered size="small">
              <Descriptions.Item label="Người liên hệ">
                {partner.contact_person || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="SĐT liên hệ">
                {partner.contact_phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Email liên hệ">
                {partner.contact_email || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Section>

          <Section title="Thanh toán">
            <Descriptions column={isMobile ? 1 : 2} bordered size="small">
              <Descriptions.Item label="Kỳ thanh toán">
                {paymentCycleLabel(partner.payment_cycle)}
              </Descriptions.Item>
              <Descriptions.Item label="Phương thức thanh toán">
                {paymentMethodLabel(partner.payment_method)}
              </Descriptions.Item>
              <Descriptions.Item label="Tên tài khoản thanh toán">
                {partner.payment_account_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Số tài khoản thanh toán">
                {partner.payment_account_number || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngân hàng">
                {partner.payment_bank_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Chi nhánh">
                {partner.payment_bank_branch || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Hoa hồng">
                {partner.commission_rate != null ? `${partner.commission_rate}%` : '-'}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6, color: '#595959', fontWeight: 500 }}>
                Điều khoản thanh toán
              </div>
              <div
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  padding: '8px 10px',
                  minHeight: 72,
                  whiteSpace: 'pre-wrap',
                  color: '#595959',
                  background: '#fafafa',
                }}
              >
                {partner.payment_terms || '-'}
              </div>
            </div>
          </Section>

          <Section title="Ghi chú">
            <div style={{ color: '#595959', whiteSpace: 'pre-wrap' }}>{partner.notes || '-'}</div>
          </Section>

          <Section title="Công việc">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={partnerJobs?.data || []}
              columns={[
                {
                  title: 'Rank',
                  dataIndex: 'rank_code',
                  width: 80,
                  render: (v) => v || '-',
                },
                {
                  title: 'Tàu',
                  dataIndex: 'vessel_name',
                  render: (v) => v || '-',
                },
                {
                  title: 'Thuyền viên',
                  dataIndex: 'seafarer_name',
                  render: (v) => v || '-',
                },
                {
                  title: 'Trạng thái',
                  dataIndex: 'status',
                  width: 120,
                  render: (v) => {
                    const map = {
                      OPEN: { color: 'green', label: 'Còn trống' },
                      FILLED: { color: 'blue', label: 'Đã có người' },
                      CANCELLED: { color: 'default', label: 'Hủy' },
                    }
                    const item = map[v] || { color: 'default', label: v }
                    return <Tag color={item.color}>{item.label}</Tag>
                  },
                },
                {
                  title: '',
                  width: 100,
                  render: (_, r) => (
                    <a
                      href={`/jobs/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13 }}
                    >
                      Xem job
                    </a>
                  ),
                },
              ]}
              locale={{ emptyText: 'Chưa có công việc' }}
            />
          </Section>
        </>
      )}
    </div>
  )
}
