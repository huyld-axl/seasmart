import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, InputNumber, Radio, Select, Skeleton, Switch } from 'antd'
import useToast from '../../../components/ds/useToast'
import api from '../../../api/client'
import apiErrorText from '../../../utils/apiError'
import usePdfComponentStore from '../../../stores/pdfComponentStore'
import { desktop, isDesktop, useDeviceSettings, useSaveDeviceSettings } from '../../../lib/desktop'

const PROVIDERS = [
  { value: 'gmail', label: 'Gmail', hint: 'smtp.gmail.com : 465 (tự điền)' },
  { value: 'outlook', label: 'Outlook / Microsoft 365', hint: 'smtp.office365.com : 587 (tự điền)' },
  { value: 'other', label: 'Khác' },
]
const mailAppName = (desktopFile) => (/thunderbird/i.test(desktopFile || '') ? 'Thunderbird' : /evolution/i.test(desktopFile || '') ? 'Evolution' : /outlook/i.test(desktopFile || '') ? 'Outlook' : desktopFile)
// Lỗi từ app (ipcRenderer.invoke) kèm tiền tố kỹ thuật; bỏ đi cho người dùng đọc.
const bridgeError = (error) => String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

// Cài đặt trên máy này (wireframe 4, docs/mcah-ke-hoach-desktop-gd1.md 3.6): theo từng máy, chỉ có trong app máy tính.
// Cách gửi email (app mail / gửi thẳng SMTP) và thành phần xuất PDF. Mật khẩu SMTP cất trong két hệ điều hành của máy.
export default function DeviceSettingsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const settings = useDeviceSettings()
  const save = useSaveDeviceSettings()
  const pdf = useQuery({ queryKey: ['pdf-component'], queryFn: desktop.pdfComponent, enabled: isDesktop() })
  // Máy chính (giai đoạn 3, wireframe docs/design/wireframes/desktop-gd3.html màn 6): tên, địa chỉ cho máy nhân viên.
  const lan = useQuery({ queryKey: ['lan-status'], queryFn: desktop.lanStatus, enabled: isDesktop() })
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const provider = Form.useWatch('provider', form)

  if (!isDesktop()) return <Navigate to="/dashboard" replace />
  if (settings.isLoading || !settings.data) return <Skeleton active />
  const data = settings.data

  async function setMode(mailMode) {
    try {
      await save.mutateAsync({ mailMode })
    } catch (error) {
      toast.error('Chưa lưu được', { description: bridgeError(error) })
    }
  }

  async function saveSmtp() {
    const values = await form.validateFields()
    const smtp = { provider: values.provider, user: values.user.trim() }
    if (values.provider === 'other') Object.assign(smtp, { host: values.host.trim(), port: values.port, secure: Boolean(values.secure) })
    await save.mutateAsync({ smtp, ...(values.password ? { smtpPassword: values.password } : {}) })
    form.setFieldValue('password', '')
  }

  async function onSave() {
    try {
      await saveSmtp()
      toast.success('Đã lưu email gửi thẳng')
    } catch (error) {
      if (error?.errorFields) return
      toast.error('Chưa lưu được', { description: bridgeError(error) })
    }
  }

  // Lưu rồi gửi thư thử cho chính địa chỉ gửi (app gắn cấu hình đã lưu vào yêu cầu).
  async function onTest() {
    setTesting(true)
    try {
      await saveSmtp()
      await api.post('/system/smtp-test')
      toast.success('Đã gửi thư thử', { description: `Mở hộp thư ${form.getFieldValue('user')} để kiểm.` })
    } catch (error) {
      if (!error?.errorFields) toast.error('Chưa gửi được thư thử', { description: error.response ? apiErrorText(error) : bridgeError(error) })
    } finally {
      setTesting(false)
    }
  }

  async function installPdf() {
    if (await usePdfComponentStore.getState().ask()) {
      queryClient.invalidateQueries({ queryKey: ['pdf-component'] })
      toast.success('Đã cài thành phần xuất PDF')
    }
  }

  const smtp = data.smtp || {}
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
      <Card title="Gửi email">
        <Radio.Group value={data.mailMode} onChange={(e) => setMode(e.target.value)} style={{ display: 'grid', gap: 12 }}>
          <Radio value="app">
            <b>Mở bằng app mail trên máy</b>
            <div className="muted">
              {data.mailApp ? `Đang dùng: ${mailAppName(data.mailApp)}. Thư đi từ email của bạn trong app mail.` : 'Máy chưa có app mail. Cài Thunderbird để dùng cách này.'}
            </div>
          </Radio>
          <Radio value="smtp">
            <b>Gửi thẳng từ app</b>
            <div className="muted">Cần mật khẩu ứng dụng của email (Gmail, Outlook…).</div>
          </Radio>
        </Radio.Group>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.mailApp ? null : <Button onClick={() => desktop.openExternal('thunderbird')}>Cài Thunderbird</Button>}
        </div>
      </Card>

      {data.mailMode === 'smtp' ? (
        <Card title="Gửi thẳng từ app">
          {data.secretStore ? null : (
            <Alert style={{ marginBottom: 16 }} type="warning" showIcon message="Máy chưa có kho mật khẩu an toàn, chỉ dùng được cách app mail." />
          )}
          <Form
            form={form}
            layout="vertical"
            disabled={!data.secretStore}
            initialValues={{ provider: smtp.provider || 'gmail', user: smtp.user || '', host: smtp.host, port: smtp.port || 587, secure: smtp.secure }}
            requiredMark={false}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0 16px' }}>
              <Form.Item name="provider" label="Loại email" extra={PROVIDERS.find((p) => p.value === provider)?.hint}>
                <Select options={PROVIDERS} />
              </Form.Item>
              <Form.Item name="user" label="Email gửi" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
                <Input autoComplete="off" placeholder="ban@congty.vn" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Mật khẩu ứng dụng"
                rules={[{ required: !data.smtpPasswordSaved, message: 'Nhập mật khẩu ứng dụng' }]}
                extra={data.smtpPasswordSaved ? 'Đã lưu. Để trống nếu không đổi.' : undefined}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              {provider === 'other' ? (
                <>
                  <Form.Item name="host" label="Máy chủ SMTP" rules={[{ required: true, message: 'Nhập máy chủ' }]}>
                    <Input placeholder="mail.congty.vn" />
                  </Form.Item>
                  <Form.Item name="port" label="Cổng" rules={[{ required: true, message: 'Nhập cổng' }]}>
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="secure" label="Kết nối mã hoá ngay (SSL, thường cổng 465)" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button loading={testing} onClick={onTest}>Gửi thử cho tôi</Button>
              <Button type="primary" loading={save.isPending && !testing} onClick={onSave}>Lưu</Button>
            </div>
            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>Mật khẩu cất trong két của hệ điều hành trên máy này, không lưu trong dữ liệu văn phòng.</p>
          </Form>
        </Card>
      ) : null}

      <Card title="Tự khoá">
        <p className="muted" style={{ marginTop: 0 }}>Không dùng máy quá thời gian này thì MCAH tự khoá, mở bằng mã PIN.</p>
        <Select
          style={{ width: 200 }}
          value={data.lockMinutes}
          options={[5, 10, 15, 30, 60].map((m) => ({ value: m, label: `${m} phút` }))}
          onChange={async (lockMinutes) => {
            try {
              await save.mutateAsync({ lockMinutes })
            } catch (error) {
              toast.error('Chưa lưu được', { description: bridgeError(error) })
            }
          }}
        />
      </Card>

      <Card title="Xuất PDF">
        {pdf.isLoading ? <Skeleton active paragraph={false} /> : pdf.data?.installed ? (
          <Alert type="success" showIcon message="Đã có thành phần xuất PDF (LibreOffice)." />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="Máy chưa có thành phần xuất PDF. Xuất Excel vẫn được."
            action={<Button size="small" type="primary" onClick={installPdf}>Cài ngay</Button>}
          />
        )}
      </Card>

      {lan.data ? (
        <Card title="Máy chính của văn phòng">
          <p style={{ marginTop: 0 }}>
            Tên trong mạng: <b>{lan.data.name}</b> · Địa chỉ: <b>{lan.data.addresses.join(', ') || '—'}</b> · cổng {lan.data.port}
          </p>
          <p className="muted" style={{ marginTop: 0 }}>Máy nhân viên tự tìm máy này. Không tìm thấy thì gõ tên hoặc địa chỉ trên ở màn nối máy chính.</p>
          {lan.data.keepAwake ? <Alert type="success" showIcon message="Không cho máy ngủ khi MCAH đang mở." /> : null}
        </Card>
      ) : null}
    </div>
  )
}
