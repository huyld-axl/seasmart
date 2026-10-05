import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Tag, message, Typography, Space } from 'antd'
import { UploadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { formTemplateApi } from '../../api'

const { Title } = Typography

export default function FormTemplatePage() {
  const queryClient = useQueryClient()
  const inputRefs = useRef({})

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['form-templates'],
    queryFn: () => formTemplateApi.list().then((r) => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ formKey, file }) => formTemplateApi.upload(formKey, file),
    onSuccess: (_, { label }) => {
      message.success(`Đã cập nhật template: ${label}`)
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
    },
    onError: (err) => {
      message.error(err.response?.data?.message || 'Upload thất bại')
    },
  })

  function handleFileChange(formKey, label, e) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate({ formKey, file, label })
    e.target.value = ''
  }

  const columns = [
    {
      title: 'Tên biểu mẫu',
      dataIndex: 'label',
      key: 'label',
      width: '40%',
    },
    {
      title: 'File',
      dataIndex: 'file',
      key: 'file',
      width: '30%',
      render: (file, record) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {record.originalName || file}
        </Typography.Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'exists',
      key: 'exists',
      width: '15%',
      render: (exists) =>
        exists ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Có sẵn
          </Tag>
        ) : (
          <Tag icon={<WarningOutlined />} color="warning">
            Chưa có file
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Space>
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            ref={(el) => (inputRefs.current[record.key] = el)}
            onChange={(e) => handleFileChange(record.key, record.label, e)}
          />
          <Button
            size="small"
            icon={<UploadOutlined />}
            loading={uploadMutation.isPending && uploadMutation.variables?.formKey === record.key}
            onClick={() => inputRefs.current[record.key]?.click()}
          >
            {record.exists ? 'Cập nhật' : 'Upload'}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Quản lý biểu mẫu Excel
      </Title>
      <div
        style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0' }}
      >
        <Table
          rowKey="key"
          columns={columns}
          dataSource={templates}
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </div>
    </div>
  )
}
