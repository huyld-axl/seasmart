import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import useAuthStore from '../../stores/authStore'
import ProductBrand from '../../components/common/ProductBrand'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async ({ email, password }) => {
    setLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'seafarer') navigate('/seafarer/profile')
      else if (user.role === 'training_center') navigate('/courses')
      else navigate('/seafarers')
    } catch (err) {
      message.error(err.response?.data?.error || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F5F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            <ProductBrand />
          </div>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Đăng nhập để tiếp tục</p>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 2,
            padding: 24,
            border: '1px solid #D9D9D9',
            boxShadow: 'none',
          }}
        >
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              label="Email"
              name="email"
              style={{ marginBottom: 16 }}
              rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="you@example.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="password"
              style={{ marginBottom: 20 }}
              rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="••••••••"
                size="large"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Đăng nhập
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
