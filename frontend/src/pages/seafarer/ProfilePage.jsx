import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Select, DatePicker, Radio, Button, message, Spin, Divider } from 'antd'
import { seafarerPortalApi, lookupApi } from '../../api'
import dayjs from 'dayjs'

const sectionStyle = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--foreground)',
  borderBottom: '2px solid var(--primary)',
  paddingBottom: 8,
  marginBottom: 16,
}

export default function SeafarerProfilePage() {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['seafarer-portal-profile'],
    queryFn: () => seafarerPortalApi.getProfile().then((r) => r.data),
  })

  const { data: _ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        ...profile,
        date_of_birth: profile.date_of_birth ? dayjs(profile.date_of_birth) : null,
        passport_expiry: profile.passport_expiry ? dayjs(profile.passport_expiry) : null,
        seaman_book_expiry: profile.seaman_book_expiry ? dayjs(profile.seaman_book_expiry) : null,
        medical_cert_expiry: profile.medical_cert_expiry
          ? dayjs(profile.medical_cert_expiry)
          : null,
        social_insurance_date: profile.social_insurance_date
          ? dayjs(profile.social_insurance_date)
          : null,
      })
    }
  }, [profile])

  const mutation = useMutation({
    mutationFn: (values) => seafarerPortalApi.updateProfile(values).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seafarer-portal-profile'] })
      message.success('Cập nhật hồ sơ thành công')
    },
    onError: (err) => message.error(err.response?.data?.error || 'Có lỗi xảy ra'),
  })

  const onFinish = (values) => {
    const payload = { ...values }
    const dateFields = [
      'date_of_birth',
      'passport_expiry',
      'seaman_book_expiry',
      'medical_cert_expiry',
      'social_insurance_date',
    ]
    dateFields.forEach((f) => {
      if (payload[f]) payload[f] = payload[f].format('YYYY-MM-DD')
    })
    mutation.mutate(payload)
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 80 }} />

  if (!profile)
    return (
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          color: 'var(--muted)',
        }}
      >
        Chưa có hồ sơ thuyền viên. Vui lòng liên hệ admin để được liên kết tài khoản.
      </div>
    )

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', marginBottom: 24 }}>
        Hồ sơ cá nhân
      </div>

      <div
        style={{ background: 'var(--surface)', borderRadius: 8, padding: 24, border: '1px solid var(--border-strong)' }}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <div style={sectionStyle}>Thông tin cá nhân</div>
          <Form.Item label="Họ và tên" name="full_name">
            <Input disabled />
          </Form.Item>
          <Form.Item label="Ngày sinh" name="date_of_birth">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item label="CCCD" name="national_id">
            <Input disabled />
          </Form.Item>
          <Form.Item label="Giới tính" name="gender">
            <Radio.Group>
              <Radio value="M">Nam</Radio>
              <Radio value="F">Nữ</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="Quốc tịch" name="nationality_id">
            <Select
              showSearch
              placeholder="Chọn quốc tịch"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              options={(countries || []).map((c) => ({ value: c.id, label: c.name_vi }))}
            />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Giấy tờ</div>
          <Form.Item label="Số hộ chiếu" name="passport_number">
            <Input />
          </Form.Item>
          <Form.Item label="Ngày hết hạn hộ chiếu" name="passport_expiry">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Số sổ thuyền viên" name="seaman_book_number">
            <Input />
          </Form.Item>
          <Form.Item label="Ngày hết hạn sổ thuyền viên" name="seaman_book_expiry">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Liên hệ</div>
          <Form.Item label="SĐT chính" name="phone_primary">
            <Input placeholder="0901234567" />
          </Form.Item>
          <Form.Item label="SĐT phụ" name="phone_secondary">
            <Input />
          </Form.Item>
          <Form.Item label="Email liên hệ" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="Địa chỉ thường trú" name="permanent_address">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
