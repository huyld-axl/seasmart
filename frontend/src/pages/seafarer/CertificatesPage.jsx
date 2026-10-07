import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  Tag,
  Empty,
  Grid,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Space,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { seafarerPortalApi, lookupApi } from '../../api'
import useAuthStore from '../../stores/authStore'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

export default function SeafarerCertificatesPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form] = Form.useForm()
  const [certFile, setCertFile] = useState(null)

  const { data: certResponse, isLoading } = useQuery({
    queryKey: ['portal-certificates'],
    queryFn: () => seafarerPortalApi.getCertificates().then((r) => r.data),
  })
  const list = certResponse?.data || []

  const { data: certTypesRes } = useQuery({
    queryKey: ['lookup-certificate-types'],
    queryFn: () => lookupApi.certificateTypes().then((r) => r.data),
  })
  const certTypes = (Array.isArray(certTypesRes) ? certTypesRes : certTypesRes?.data) || []

  const createMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        certificate_type_id: values.certificate_type_id,
        certificate_number: values.certificate_number || undefined,
        issued_date: values.issued_date?.format?.('YYYY-MM-DD'),
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD'),
      }
      return seafarerPortalApi.createCertificate(payload, certFile).then((r) => r.data)
    },
    onSuccess: () => {
      message.success('Thêm chứng chỉ thành công')
      setAddOpen(false)
      form.resetFields()
      setCertFile(null)
      queryClient.invalidateQueries({ queryKey: ['portal-certificates'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm chứng chỉ thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => seafarerPortalApi.deleteCertificate(id),
    onSuccess: () => {
      message.success('Đã xóa chứng chỉ')
      queryClient.invalidateQueries({ queryKey: ['portal-certificates'] })
    },
    onError: (e) => message.error(e.response?.data?.error || 'Xóa thất bại'),
  })

  function handleDelete(row) {
    if (Number(row.created_by) !== Number(user?.id)) return
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa chứng chỉ "${row.certificate_type_name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      onOk: () => deleteMutation.mutate(row.id),
    })
  }

  const screens = useBreakpoint()
  const isMobile = !screens.md

  const columns = [
    { title: 'Loại chứng chỉ', dataIndex: 'certificate_type_name' },
    { title: 'Số chứng chỉ', dataIndex: 'certificate_number', width: 160 },
    {
      title: 'Ngày cấp',
      dataIndex: 'issued_date',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expiry_date',
      width: 130,
      render: (v) => {
        if (!v) return '-'
        const expired = dayjs(v).isBefore(dayjs())
        return (
          <span style={{ color: expired ? 'var(--danger)' : 'var(--foreground)' }}>
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 110,
      render: (v) => (
        <Tag
          color={
            v === 'VALID'
              ? 'green'
              : v === 'EXPIRED'
                ? 'red'
                : v === 'PENDING'
                  ? 'orange'
                  : 'default'
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: 'File',
      dataIndex: 'document_url',
      width: 80,
      render: (v) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer">
            Xem
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: '',
      width: 80,
      render: (_, r) =>
        Number(r.created_by) === Number(user?.id) ? (
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
        ) : null,
    },
  ]

  const STATUS_COLOR = { VALID: 'green', EXPIRED: 'red', PENDING: 'orange' }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)' }}>Chứng chỉ của tôi</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Thêm chứng chỉ
        </Button>
      </div>
      <Modal
        title="Thêm chứng chỉ"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
          setCertFile(null)
        }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item
            name="certificate_type_id"
            label="Loại chứng chỉ"
            rules={[{ required: true, message: 'Chọn loại chứng chỉ' }]}
          >
            <Select
              placeholder="Chọn loại"
              options={certTypes.map((c) => ({ value: c.id, label: c.name_vi || c.name }))}
            />
          </Form.Item>
          <Form.Item name="certificate_number" label="Số chứng chỉ">
            <Input />
          </Form.Item>
          <Form.Item name="issued_date" label="Ngày cấp">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="Ngày hết hạn">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="File đính kèm">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setAddOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Thêm
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      {(!list || list.length === 0) && !isLoading ? (
        <Empty
          description="Chưa có chứng chỉ"
          style={{ padding: 40, background: 'var(--surface)', borderRadius: 8 }}
        />
      ) : isMobile ? (
        <div>
          {(list || []).map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--surface)',
                borderRadius: 8,
                border: '1px solid var(--border-strong)',
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, marginRight: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.certificate_type_name}</div>
                  {r.certificate_number && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Số: {r.certificate_number}
                    </div>
                  )}
                </div>
                <Tag color={STATUS_COLOR[r.status] || 'default'} style={{ margin: 0 }}>
                  {r.status}
                </Tag>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--muted)',
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {r.issued_date && <span>Cấp: {dayjs(r.issued_date).format('DD/MM/YYYY')}</span>}
                {r.expiry_date && (
                  <span
                    style={{
                      color: dayjs(r.expiry_date).isBefore(dayjs()) ? 'var(--danger)' : 'var(--muted)',
                    }}
                  >
                    HH: {dayjs(r.expiry_date).format('DD/MM/YYYY')}
                  </span>
                )}
                {r.document_url && (
                  <a href={r.document_url} target="_blank" rel="noreferrer">
                    Xem file
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={list}
            loading={isLoading}
            size="middle"
            pagination={false}
            scroll={{ x: 600 }}
          />
        </div>
      )}
    </div>
  )
}
