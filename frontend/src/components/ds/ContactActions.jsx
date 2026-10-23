import { Tooltip } from 'antd'
import { MailOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons'
import ZaloButton from '../common/ZaloButton'
import CopyButton from './CopyButton'
import './ds.css'

function LinkButton({ href, label, children }) {
  return (
    <Tooltip title={label}>
      <a className="ds-copy" href={href} aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</a>
    </Tooltip>
  )
}

const digits = (phone) => String(phone).replace(/[^\d+]/g, '')

// Thao tác nhanh cho một số điện thoại: sao chép, gọi, nhắn SMS, nhắn Zalo. Kiểu duy nhất của MCAH, đặt ngay sau số.
export function PhoneActions({ phone }) {
  if (!phone) return null
  return (
    <>
      <CopyButton value={phone} />
      <LinkButton href={`tel:${digits(phone)}`} label="Gọi điện"><PhoneOutlined /></LinkButton>
      <LinkButton href={`sms:${digits(phone)}`} label="Nhắn SMS"><MessageOutlined /></LinkButton>
      <ZaloButton phone={phone} />
    </>
  )
}

// Thao tác nhanh cho một email: sao chép, gửi mail (mở ứng dụng mail của thiết bị).
export function EmailActions({ email }) {
  if (!email) return null
  return (
    <>
      <CopyButton value={email} />
      <LinkButton href={`mailto:${email}`} label="Gửi mail"><MailOutlined /></LinkButton>
    </>
  )
}
