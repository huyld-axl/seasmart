import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Row, Col, Spin, Typography, message } from 'antd'
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons'
import { seafarerApi } from '../../api'

const { Text } = Typography

const FORM_ICONS = {
  hd1: '📄',
  bao_hiem: '🛡️',
  don_bh: '📋',
  uy_quyen: '✍️',
  uy_quyen_cn: '✍️',
  qd_dieu_dong: '🚢',
  thu_bao_lanh: '✉️',
  phieu_thu: '💰',
  tb_trung_tuyen: '📢',
  kq_thi_tuyen: '📊',
  qd_roi_tau: '🔄',
  thanh_ly: '📝',
}

export default function FormExportTab({ seafarerId, seafarerName }) {
  const [loading, setLoading] = useState({})

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ['seafarer-forms'],
    queryFn: () => seafarerApi.listForms().then((r) => r.data),
  })

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
      <div style={{ marginBottom: 16, color: '#595959', fontSize: 13 }}>
        Click vào từng biểu mẫu để tải file Excel đã điền sẵn thông tin thuyền viên.
      </div>
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
                    {FORM_ICONS[key] || '📄'} {label}
                  </Text>
                  <Button
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    loading={loading[key]}
                    onClick={() => handleDownload(key, label)}
                    style={{ width: '100%' }}
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
