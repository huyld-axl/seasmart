import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, message, Result } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { authApi } from '../../api'
import useAuthStore from '../../stores/authStore'

export default function SeafarerVerifyPage() {
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const navigate = useNavigate()
  const { user: _user, refreshUser } = useAuthStore()

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await authApi.requestVerify()
      setMaskedEmail(res.data.email_masked)
      setSent(true)
      message.success('OTP đã gửi vào email của bạn')
    } catch (err) {
      message.error(err.response?.data?.error || 'Gửi OTP thất bại')
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    if (otp.length !== 6) return message.warning('Nhập đủ 6 chữ số OTP')
    setVerifying(true)
    try {
      await authApi.confirmVerify({ otp })
      await refreshUser()
      setVerified(true)
    } catch (err) {
      message.error(err.response?.data?.error || 'OTP không đúng')
    } finally {
      setVerifying(false)
    }
  }

  if (verified) {
    return (
      <Result
        status="success"
        title="Xác nhận email thành công"
        subTitle="Tài khoản của bạn đã được xác nhận. Bạn có thể sử dụng đầy đủ tính năng."
        extra={
          <Button type="primary" onClick={() => navigate('/seafarer/profile')}>
            Đến hồ sơ
          </Button>
        }
      />
    )
  }

  return (
    <div style={{ maxWidth: 400, margin: '48px auto' }}>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: 32,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <MailOutlined style={{ fontSize: 40, color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 4px' }}>Xác nhận email</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            {sent
              ? `Mã OTP đã gửi đến ${maskedEmail}`
              : 'Nhấn nút bên dưới để nhận mã OTP qua email'}
          </p>
        </div>

        {!sent ? (
          <Button
            type="primary"
            block
            loading={sending}
            onClick={handleSend}
            style={{ height: 36 }}
          >
            Gửi mã OTP
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              size="large"
              maxLength={6}
              placeholder="Nhập mã 6 chữ số"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20 }}
            />
            <Button
              type="primary"
              block
              loading={verifying}
              onClick={handleVerify}
              style={{ height: 36 }}
            >
              Xác nhận
            </Button>
            <Button
              type="link"
              block
              loading={sending}
              onClick={handleSend}
              style={{ color: 'var(--muted)' }}
            >
              Gửi lại OTP
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
