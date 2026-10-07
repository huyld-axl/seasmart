import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Result,
  Spin,
  Typography,
  Divider,
  message,
} from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../api/client'

const { Title, Text } = Typography

export default function QREnrollPage() {
  const { token } = useParams()
  const [submitted, setSubmitted] = useState(false)
  const [form] = Form.useForm()

  const {
    data: linkInfo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['qr-enroll', token],
    queryFn: () => api.get(`/qr-enrollment/${token}`).then((r) => r.data),
    retry: false,
  })

  const { data: ranks = [] } = useQuery({
    queryKey: ['lookup', 'ranks'],
    queryFn: () => api.get('/lookup/ranks').then((r) => r.data),
    enabled: !!linkInfo,
  })

  const submit = useMutation({
    mutationFn: (body) => api.post(`/qr-enrollment/${token}/submit`, body),
    onSuccess: () => setSubmitted(true),
    onError: (e) => message.error(e?.response?.data?.error || 'Đăng ký thất bại'),
  })

  async function handleSubmit() {
    const values = await form.validateFields()
    submit.mutate({
      ...values,
      date_of_birth: values.date_of_birth?.format('YYYY-MM-DD'),
    })
  }

  if (isLoading)
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )

  if (isError)
    return (
      <Result
        status="404"
        title="Link không hợp lệ"
        subTitle="Link đăng ký đã hết hạn hoặc không tồn tại. Vui lòng liên hệ trung tâm đào tạo để nhận link mới."
      />
    )

  if (submitted)
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <Result
          icon={<CheckCircleOutlined style={{ color: 'var(--success)' }} />}
          title="Đăng ký thành công!"
          subTitle={`Thông tin của bạn đã được ghi nhận tại ${linkInfo.training_center.name_vi}. Trung tâm sẽ liên hệ xác nhận sớm nhất.`}
        />
      </div>
    )

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: '0 16px' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 4 }}>
            {linkInfo.training_center.name_vi}
          </Title>
          {linkInfo.course && (
            <Text type="secondary">
              Khóa học: <strong>{linkInfo.course.name}</strong>
            </Text>
          )}
          <Divider />
          <Text>Điền thông tin để đăng ký tham gia khóa học</Text>
        </div>

        <Form form={form} layout="vertical">
          <Form.Item
            name="full_name"
            label="Họ và tên (tiếng Việt)"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="full_name_en" label="Họ và tên (tiếng Anh)">
            <Input placeholder="NGUYEN VAN A" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item
            name="date_of_birth"
            label="Ngày sinh"
            rules={[{ required: true, message: 'Vui lòng chọn ngày sinh' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="phone_primary"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input placeholder="0912345678" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="example@email.com" />
          </Form.Item>
          <Form.Item name="national_id" label="CCCD / CMND">
            <Input placeholder="012345678901" />
          </Form.Item>
          <Form.Item name="seaman_book_number" label="Số sổ thuyền viên">
            <Input placeholder="VN-XXXXXX" />
          </Form.Item>
          <Form.Item name="current_rank_id" label="Chức danh hiện tại">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn chức danh"
              options={ranks.map((r) => ({ value: r.id, label: `${r.code} - ${r.name_vi}` }))}
            />
          </Form.Item>

          <Button
            type="primary"
            block
            size="large"
            onClick={handleSubmit}
            loading={submit.isPending}
            style={{ marginTop: 8 }}
          >
            Đăng ký
          </Button>
        </Form>
      </Card>
    </div>
  )
}
