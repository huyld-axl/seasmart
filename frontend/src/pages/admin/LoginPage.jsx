import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button } from 'antd'
import useAuthStore from '../../stores/authStore'
import ProductBrand from '../../components/common/ProductBrand'
import './LoginPage.css'

// Đăng nhập (D2, UI Kit): chỉ email, mật khẩu, nút. Lỗi hiện ngay dưới ô mật khẩu, không dùng toast.
export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async ({ email, password }) => {
    setLoading(true)
    setError('')
    try {
      const user = await login(email, password)
      if (user.role === 'seafarer') navigate('/seafarer/profile')
      else if (user.role === 'training_center') navigate('/courses')
      else navigate('/seafarers')
    } catch (err) {
      const status = err.response?.status
      if (!err.response) setError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
      else if (status === 429) setError('Đăng nhập sai quá nhiều lần. Chờ vài phút rồi thử lại.')
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
        <Form layout="vertical" onFinish={onFinish} onValuesChange={() => error && setError('')} requiredMark={false}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ, ví dụ ban@congty.vn' }]}>
            <Input id="email" type="email" size="large" placeholder="ban@congty.vn" autoComplete="username" autoFocus status={error ? 'error' : undefined} />
          </Form.Item>
          <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]} help={error || undefined} validateStatus={error ? 'error' : undefined}>
            <Input.Password id="password" size="large" placeholder="Nhập mật khẩu" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Đăng nhập
          </Button>
        </Form>
      </div>
    </main>
  )
}
