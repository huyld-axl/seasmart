import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Form, Input } from 'antd'
import { authApi } from '../../api'
import Banner from '../../components/ds/Banner'
import PasswordField from '../../components/ds/PasswordField'
import { isPasswordValid } from '../../components/ds/passwordRules'
import ProductBrand from '../../components/common/ProductBrand'
import './LoginPage.css'

// Đặt mật khẩu lần đầu: mở từ liên kết trong thư mời (?token=...). Xong thì về đăng nhập.
export default function SetPasswordPage() {
  const [form] = Form.useForm()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(!token)

  useEffect(() => {
    if (!token) return
    authApi.getInvite(token).then(
      (res) => setEmail(res.data.data.email),
      () => setInvalid(true)
    )
  }, [token])

  const onFinish = async ({ password }) => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await authApi.setPassword({ token, password })
      navigate('/login', { state: { passwordSet: true } })
    } catch (err) {
      setError(err.response?.data?.message || 'Không đặt được mật khẩu. Thử lại sau ít phút.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <div className="login__card">
        <div>
          <ProductBrand />
          <h1 className="login__title">Đặt mật khẩu</h1>
        </div>
        {invalid ? (
          <Banner tone="error" title="Liên kết không hợp lệ" description="Mở lại liên kết trong email mời, hoặc nhờ quản trị viên gửi lại." />
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={() => error && setError('')} requiredMark={false}>
            {error ? <Banner tone="error" title={error} /> : null}
            <Form.Item label="Email">
              <Input size="large" value={email} readOnly />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ validator: (_, value) => (isPasswordValid(value, email) ? Promise.resolve() : Promise.reject(new Error('Mật khẩu chưa đạt các yêu cầu bên dưới'))) }]}
            >
              <PasswordField size="large" placeholder="Nhập mật khẩu" email={email} autoFocus />
            </Form.Item>
            <Form.Item
              label="Nhập lại mật khẩu"
              name="confirm"
              dependencies={['password']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_, value) => (value && value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Hai mật khẩu chưa khớp'))),
                }),
              ]}
            >
              <Input.Password size="large" placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Đặt mật khẩu
            </Button>
          </Form>
        )}
        <Link to="/login">Về đăng nhập</Link>
      </div>
    </main>
  )
}
