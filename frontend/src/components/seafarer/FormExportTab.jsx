import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Row, Col, Spin, Typography, message, Divider } from 'antd'
import { DownloadOutlined, FileExcelOutlined, IdcardOutlined } from '@ant-design/icons'
import { seafarerApi } from '../../api'

const { Text } = Typography

export default function FormExportTab({ seafarerId, seafarerName }) {
  const [loading, setLoading] = useState({})
  const [cvCnLoading, setCvCnLoading] = useState(false)

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['seafarer-forms'],
    queryFn: () => seafarerApi.listForms().then((r) => r.data),
  })

  const handleDownloadCVCn = async () => {
    setCvCnLoading(true)
    try {
      const res = await seafarerApi.exportCV(seafarerId)
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CV TQ - ${seafarerName}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      message.success('Đã tải CV (tiếng Trung)')
    } catch {
      // error handled by axios interceptor
    } finally {
      setCvCnLoading(false)
    }
  }

  const handleDownload = async (formKey, label) => {
    setLoading((prev) => ({ ...prev, [formKey]: true }))
    try {
      const res = await seafarerApi.exportForm(seafarerId, formKey)
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${label} - ${seafarerName}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      message.success(`Đã tải: ${label}`)
    } catch {
      // error handled by axios interceptor
    } finally {
      setLoading((prev) => ({ ...prev, [formKey]: false }))
    }
  }

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 40 }} />

  return (
    <div>
      {/* ── CV Export block ── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #D9D9D9',
          borderRadius: 2,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #D9D9D9',
            fontWeight: 600,
            fontSize: 13,
            color: '#003366',
            background: '#FAFAFA',
          }}
        >
          Xuất CV
        </div>
        <div style={{ padding: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} lg={10}>
              <Card
                size="small"
                hoverable
                style={{ borderRadius: 4, border: '1px solid #D9D9D9', height: '100%' }}
                styles={{ body: { padding: '12px 14px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <IdcardOutlined style={{ fontSize: 22, color: '#531dab', marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                      CV tiếng Trung (CV china.xlsx)
                    </Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={cvCnLoading}
                      onClick={handleDownloadCVCn}
                      style={{ background: '#c41d7f', borderColor: '#c41d7f' }}
                    >
                      Xuất CV (tiếng Trung)
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      <Divider orientation="left" style={{ fontSize: 13, color: '#595959' }}>
        Biểu mẫu hợp đồng & thủ tục
      </Divider>

      <Row gutter={[12, 12]}>
        {forms.map(({ key, label }) => (
          <Col key={key} xs={24} sm={12} md={8} lg={6}>
            <Card
              size="small"
              hoverable
              style={{ borderRadius: 4, border: '1px solid #D9D9D9' }}
              styles={{ body: { padding: '12px 14px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <FileExcelOutlined style={{ fontSize: 22, color: '#217346', marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                    {label}
                  </Text>
                  <Button
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    loading={loading[key]}
                    onClick={() => handleDownload(key, label)}
                  >
                    Tải xuống
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
