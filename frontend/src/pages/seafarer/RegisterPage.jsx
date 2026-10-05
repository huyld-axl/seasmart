import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import useAuthStore from '../../stores/authStore'
import { authApi } from '../../api'

export default function SeafarerRegisterPage() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async ({ email, password }) => {
    setLoading(true)
    try {
      await authApi.registerSeafarer({ email, password })
      // Đăng nhập luôn sau khi đăng ký
      await login(email, password)
      message.success('Đăng ký thành công')
      navigate('/seafarer/verify')
    } catch (err) {
      message.error(err.response?.data?.error || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#262626', margin: '0 0 6px' }}>
            Đăng ký tài khoản thuyền viên
          </h2>
          <p style={{ fontSize: 14, color: '#8c8c8c', margin: 0 }}>
            Đã có tài khoản?{' '}
            <a onClick={() => navigate('/login')} style={{ color: '#1677ff' }}>
              Đăng nhập
            </a>
          </p>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="you@example.com"
              />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="••••••••"
              />
            </Form.Item>
            <Form.Item
              label="Xác nhận mật khẩu"
              name="confirm"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Nhập lại mật khẩu' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve()
                    return Promise.reject('Mật khẩu không khớp')
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="••••••••"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 36 }}>
              Đăng ký
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
