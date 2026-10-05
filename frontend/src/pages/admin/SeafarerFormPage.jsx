import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Select, DatePicker, Radio, Button, message, Spin, Divider, Modal } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { seafarerApi, lookupApi } from '../../api'
import dayjs from 'dayjs'

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Sẵn sàng' },
  { value: 'ON_VESSEL', label: 'Đang tàu' },
  { value: 'ON_LEAVE', label: 'Nghỉ phép' },
  { value: 'TRAINING', label: 'Đang đào tạo' },
  { value: 'BLACKLISTED', label: 'Blacklist' },
  { value: 'RETIRED', label: 'Đã nghỉ hưu' },
  { value: 'INACTIVE', label: 'Không hoạt động' },
]

const sectionStyle = {
  fontSize: 15,
  fontWeight: 600,
  color: '#262626',
  borderBottom: '2px solid #1677ff',
  paddingBottom: 8,
  marginBottom: 16,
}

export default function SeafarerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const isEdit = Boolean(id)

  const { data: seafarer, isLoading: loadingSeafarer } = useQuery({
    queryKey: ['seafarer', id],
    queryFn: () => seafarerApi.getById(id).then((r) => r.data),
    enabled: isEdit,
  })

  const { data: ranks } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => lookupApi.ranks().then((r) => r.data),
  })

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => lookupApi.countries().then((r) => r.data),
  })

  useEffect(() => {
    if (seafarer) {
      form.setFieldsValue({
        ...seafarer,
        date_of_birth: seafarer.date_of_birth ? dayjs(seafarer.date_of_birth) : null,
        national_id_issued_date: seafarer.national_id_issued_date
          ? dayjs(seafarer.national_id_issued_date)
          : null,
        passport_issued_date: seafarer.passport_issued_date
          ? dayjs(seafarer.passport_issued_date)
          : null,
        contract_flight_date: seafarer.contract_flight_date
          ? dayjs(seafarer.contract_flight_date)
          : null,
        contract_start_date: seafarer.contract_start_date
          ? dayjs(seafarer.contract_start_date)
          : null,
        contract_end_date: seafarer.contract_end_date ? dayjs(seafarer.contract_end_date) : null,
        contract_return_date: seafarer.contract_return_date
          ? dayjs(seafarer.contract_return_date)
          : null,
      })
    }
  }, [seafarer])

  const mutation = useMutation({
    mutationFn: (values) =>
      isEdit
        ? seafarerApi.update(id, values).then((r) => r.data)
        : seafarerApi.create(values).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      queryClient.invalidateQueries({ queryKey: ['seafarer', id] })
      message.success(isEdit ? 'Cập nhật thành công' : 'Tạo thuyền viên thành công')
      navigate(`/seafarers/${data.id}`)
    },
    onError: (err) => {
      message.error(err.response?.data?.error || 'Có lỗi xảy ra')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => seafarerApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa thuyền viên')
      queryClient.invalidateQueries({ queryKey: ['seafarers'] })
      navigate('/seafarers')
    },
    onError: (err) => message.error(err.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDeleteClick() {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa thuyền viên "${seafarer?.full_name}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: () => deleteMutation.mutate(),
    })
  }

  const onFinish = (values) => {
    const payload = { ...values }
    const dateFields = [
      'date_of_birth',
      'national_id_issued_date',
      'passport_issued_date',
      'contract_flight_date',
      'contract_start_date',
      'contract_end_date',
      'contract_return_date',
    ]
    for (const f of dateFields) {
      if (payload[f]) payload[f] = payload[f].format('YYYY-MM-DD')
    }
    mutation.mutate(payload)
  }

  if (isEdit && loadingSeafarer) return <Spin style={{ display: 'block', marginTop: 80 }} />

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(isEdit ? `/seafarers/${id}` : '/seafarers')}
          />
          <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>
            {isEdit ? 'Chỉnh sửa thuyền viên' : 'Thêm thuyền viên mới'}
          </span>
        </div>
        {isEdit && (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleDeleteClick}
            loading={deleteMutation.isPending}
          >
            Xóa thuyền viên
          </Button>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          border: '1px solid #f0f0f0',
          maxWidth: 680,
        }}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <div style={sectionStyle}>Thông tin cá nhân</div>
          <Form.Item
            label="Họ và tên"
            name="full_name"
            rules={[{ required: true, message: 'Nhập họ và tên' }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item label="Họ tên tiếng Anh" name="full_name_en">
            <Input placeholder="NGUYEN VAN A" />
          </Form.Item>
          <Form.Item label="Trạng thái" name="status" initialValue="AVAILABLE">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="Ngày sinh"
            name="date_of_birth"
            rules={[{ required: true, message: 'Chọn ngày sinh' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Giới tính" name="gender" initialValue="M">
            <Radio.Group>
              <Radio value="M">Nam</Radio>
              <Radio value="F">Nữ</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label="Quốc tịch"
            name="nationality_id"
            rules={[{ required: true, message: 'Chọn quốc tịch' }]}
          >
            <Select
              showSearch
              placeholder="Chọn quốc tịch"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              options={(countries || []).map((c) => ({ value: c.id, label: c.name_vi }))}
            />
          </Form.Item>
          <Form.Item label="Tình trạng hôn nhân" name="marital_status">
            <Select
              allowClear
              placeholder="Chọn"
              options={[
                { value: 'Độc thân', label: 'Độc thân' },
                { value: 'Đã kết hôn', label: 'Đã kết hôn' },
                { value: 'Ly hôn', label: 'Ly hôn' },
                { value: 'Góa', label: 'Góa' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Số con" name="children_count">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item label="Thông tin con" name="children_info">
            <Input placeholder="VD: 2 trai, 1 gái" />
          </Form.Item>
          <Form.Item label="Tuổi con" name="children_ages">
            <Input placeholder="VD: 5, 8, 12" />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Giấy tờ</div>
          <Form.Item label="Mã thuyền viên" name="seafarer_code">
            <Input placeholder="TV-00001" />
          </Form.Item>
          <Form.Item label="CCCD / CMND" name="national_id">
            <Input placeholder="012345678901" />
          </Form.Item>
          <Form.Item label="Ngày cấp CCCD" name="national_id_issued_date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Nơi cấp CCCD" name="national_id_issued_place">
            <Input placeholder="Cục Cảnh sát QLHC về TTXH" />
          </Form.Item>
          <Form.Item label="Số hộ chiếu" name="passport_number">
            <Input placeholder="B1234567" />
          </Form.Item>
          <Form.Item label="Ngày cấp hộ chiếu" name="passport_issued_date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Số sổ thuyền viên" name="seaman_book_number">
            <Input />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Liên hệ & Địa chỉ</div>
          <Form.Item label="SĐT chính" name="phone_primary">
            <Input placeholder="0901234567" />
          </Form.Item>
          <Form.Item label="SĐT phụ" name="phone_secondary">
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input placeholder="example@email.com" />
          </Form.Item>
          <Form.Item label="Địa chỉ thường trú" name="permanent_address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Xã / Phường" name="permanent_ward">
            <Input />
          </Form.Item>
          <Form.Item label="Quận / Huyện" name="permanent_district">
            <Input />
          </Form.Item>
          <Form.Item label="Tỉnh / Thành phố" name="permanent_province">
            <Input />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Thể chất</div>
          <Form.Item label="Chiều cao (cm)" name="height_cm">
            <Input type="number" placeholder="170" />
          </Form.Item>
          <Form.Item label="Cân nặng (kg)" name="weight_kg">
            <Input type="number" placeholder="65" />
          </Form.Item>
          <Form.Item label="Size áo" name="shirt_size">
            <Input placeholder="M / L / XL" />
          </Form.Item>
          <Form.Item label="Size quần" name="pants_size">
            <Input placeholder="30 / 32" />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Học vấn & Nghề nghiệp</div>
          <Form.Item label="Trình độ tiếng Anh" name="english_level">
            <Input placeholder="B2" />
          </Form.Item>
          <Form.Item label="Điểm tiếng Anh" name="english_score">
            <Input type="number" />
          </Form.Item>
          <Form.Item label="Chức danh hiện tại" name="current_rank_id">
            <Select
              showSearch
              placeholder="Chọn chức danh"
              allowClear
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              options={(ranks || []).map((r) => ({ value: r.id, label: r.name_vi }))}
            />
          </Form.Item>
          <Form.Item label="Chức danh (VI)" name="rank_name_vi">
            <Input placeholder="Thuyền trưởng" />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Thông tin tàu & Hợp đồng</div>
          <Form.Item label="Khối" name="vessel_group">
            <Input placeholder="VD: Bulk, Tanker" />
          </Form.Item>
          <Form.Item label="Tên tàu" name="vessel_name_raw">
            <Input placeholder="VD: MV STAR OCEAN" />
          </Form.Item>
          <Form.Item label="Ngày bay" name="contract_flight_date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ngày lên tàu" name="contract_start_date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ngày rời tàu" name="contract_end_date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Ngày về VN" name="contract_return_date">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Thời gian HĐ" name="contract_duration_raw">
            <Input placeholder="VD: 9 tháng" />
          </Form.Item>
          <Form.Item label="Lương HĐ (USD)" name="contract_salary_raw">
            <Input type="number" placeholder="0" />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Ngân hàng & BHXH</div>
          <Form.Item label="Số tài khoản" name="bank_account_number">
            <Input />
          </Form.Item>
          <Form.Item label="Ngân hàng" name="bank_name">
            <Input />
          </Form.Item>
          <Form.Item label="Chủ tài khoản" name="bank_account_holder">
            <Input />
          </Form.Item>
          <Form.Item label="Số BHXH" name="social_insurance_number">
            <Input />
          </Form.Item>
          <Form.Item label="Tham gia BHXH" name="social_insurance_joined">
            <Select
              allowClear
              placeholder="Chọn"
              options={[
                { value: 1, label: 'Có' },
                { value: 0, label: 'Không' },
              ]}
            />
          </Form.Item>

          <Divider />
          <div style={sectionStyle}>Ghi chú</div>
          <Form.Item label="Ghi chú" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => navigate(isEdit ? `/seafarers/${id}` : '/seafarers')}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              {isEdit ? 'Lưu thay đổi' : 'Tạo thuyền viên'}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
