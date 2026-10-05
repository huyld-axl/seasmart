import { useState } from 'react'
import { Button, Upload, Table, Alert, Progress, message, Space } from 'antd'
import { UploadOutlined, DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { seafarerApi } from '../../api'

export default function SeafarerImportPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [fileList, setFileList] = useState([])

  const handleImport = async () => {
    if (!fileList[0]) return message.warning('Chọn file Excel trước')
    setLoading(true)
    setResult(null)
    try {
      const res = await seafarerApi.importFile(fileList[0].originFileObj)
      setResult(res.data)
      setFileList([])
      message.success(`Import thành công ${res.data.success} thuyền viên`)
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Import thất bại' })
      setFileList([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setLoading(true)
    try {
      const res = await seafarerApi.downloadTemplate()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'seafarer_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.response?.data?.error || 'Tải file mẫu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const errorColumns = [
    { title: 'Dòng', dataIndex: 'row', width: 70 },
    { title: 'Lỗi', dataIndex: 'error' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/seafarers')} />
        <span style={{ fontSize: 20, fontWeight: 600, color: '#262626' }}>Import Excel</span>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          border: '1px solid #f0f0f0',
          maxWidth: 640,
        }}
      >
        <p style={{ color: '#8c8c8c', marginBottom: 20, fontSize: 14 }}>
          Upload file Excel (.xlsx, .xls) theo đúng định dạng cột. Hệ thống sẽ bỏ qua các dòng trùng
          CCCD.
        </p>

        <Upload
          accept=".xlsx,.xls"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList }) => setFileList(fileList)}
        >
          <Button icon={<UploadOutlined />}>Chọn file Excel</Button>
        </Upload>

        <Space style={{ marginTop: 16 }}>
          <Button
            type="primary"
            loading={loading}
            disabled={!fileList.length}
            onClick={handleImport}
          >
            Import
          </Button>
          <Button loading={loading} onClick={handleDownloadTemplate}>
            Tải file mẫu
          </Button>
        </Space>

        {result && !result.error && (
          <div style={{ marginTop: 24 }}>
            <Alert
              type={result.errors?.length ? 'warning' : 'success'}
              message={`Import xong: ${result.success} thành công${result.errors?.length ? `, ${result.errors.length} lỗi` : ''}`}
              style={{ marginBottom: 16 }}
            />
            {result.errors?.length > 0 && (
              <Table
                rowKey="row"
                size="small"
                columns={errorColumns}
                dataSource={result.errors}
                pagination={false}
                style={{ border: '1px solid #f0f0f0', borderRadius: 6 }}
              />
            )}
          </div>
        )}

        {result?.error && <Alert type="error" message={result.error} style={{ marginTop: 16 }} />}
      </div>
    </div>
  )
}
