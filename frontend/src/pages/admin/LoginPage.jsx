import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import useAuthStore from '../../stores/authStore'
import useTranslation from '../../hooks/useTranslation'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const onFinish = async ({ email, password }) => {
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      message.error(err.response?.data?.error || t('auth.loginFailed'))
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
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            {t('brand.title')}
          </h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>{t('auth.loginSubtitle')}</p>
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
              rules={[{ required: true, type: 'email', message: t('auth.emailInvalid') }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="you@example.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={t('auth.password')}
              name="password"
              style={{ marginBottom: 20 }}
              rules={[{ required: true, message: t('auth.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="••••••••"
                size="large"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {t('auth.login')}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
