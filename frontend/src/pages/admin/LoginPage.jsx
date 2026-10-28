import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Form, Input, Button } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import useAuthStore from '../../stores/authStore'
import Banner from '../../components/ds/Banner'
import ProductBrand from '../../components/common/ProductBrand'
import './LoginPage.css'

// Đăng nhập (D2, UI Kit): chỉ email, mật khẩu, nút. Lỗi hiện ngay dưới ô mật khẩu, không dùng toast.
export default function LoginPage() {
  const [form] = Form.useForm()
  const demoEmail = import.meta.env.VITE_LOCAL_DEMO_EMAIL
  const demoPassword = import.meta.env.VITE_LOCAL_DEMO_PASSWORD
  // Mặc định chỉ hiện ở máy local; muốn mở cho máy khác trong LAN thì liệt kê host vào VITE_DEMO_LOGIN_HOSTS (cách nhau bằng dấu phẩy; mục bắt đầu bằng dấu chấm khớp theo đuôi, vd .trycloudflare.com).
  const demoHosts = ['localhost', '127.0.0.1', '[::1]', ...(import.meta.env.VITE_DEMO_LOGIN_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean)]
  const showDemoLogin = demoHosts.some((h) => (h.startsWith('.') ? window.location.hostname.endsWith(h) : window.location.hostname === h)) && demoEmail && demoPassword
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const passwordSet = useLocation().state?.passwordSet

  const onFinish = async ({ email, password }) => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      const status = err.response?.status
      if (!err.response) setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
      else if (status === 429) setError('Đăng nhập sai quá nhiều lần. Chờ vài phút rồi thử lại.')
      else if (status === 403 && err.response.data?.message) setError(err.response.data.message)
      else setError('Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử lần nữa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <div>
          <ProductBrand />
          <h1 className="login__title">Đăng nhập</h1>
        </div>
        {passwordSet ? <Banner tone="neutral" icon={CheckCircleOutlined} title="Đã đặt mật khẩu" description="Đăng nhập bằng email và mật khẩu vừa đặt." /> : null}
        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={() => error && setError('')} requiredMark={false}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ, ví dụ ban@congty.vn' }]}>
            <Input id="email" type="email" size="large" placeholder="ban@congty.vn" autoComplete="username" autoFocus status={error ? 'error' : undefined} />
          </Form.Item>
          <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]} help={error || undefined} validateStatus={error ? 'error' : undefined}>
            <Input.Password id="password" size="large" placeholder="Nhập mật khẩu" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Đăng nhập
          </Button>
          {showDemoLogin && (
            <div className="login__demo">
              <Button type="link" size="small" htmlType="button" disabled={loading} onClick={() => {
                form.setFieldsValue({ email: demoEmail, password: demoPassword })
                form.submit()
              }}>
                Nhập nhanh TK demo
              </Button>
            </div>
          )}
        </Form>
      </div>
    </main>
  )
}
