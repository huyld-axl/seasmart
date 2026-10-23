import { Tooltip } from 'antd'
import { MailOutlined, MessageOutlined, PhoneOutlined, WechatOutlined, WhatsAppOutlined } from '@ant-design/icons'
import ZaloButton from '../common/ZaloButton'
import CopyButton from './CopyButton'
import { chatHref } from '../../utils/chatQr'
import './ds.css'

function LinkButton({ href, label, children, external }) {
  return (
    <Tooltip title={label}>
      <a className="ds-copy" href={href} aria-label={label} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} onClick={(e) => e.stopPropagation()}>{children}</a>
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

const LineIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3C6.8 3 3 6.2 3 10.2c0 3.5 3 6.3 7 6.9.3.1.6.3.5.7l-.2 1.2c0 .4.3.6.6.4 1.6-.8 5.6-3.3 7.4-5.5C19.5 12.600 21 11.500 21 10.200 21 6.200 17.200 3 12 3z" />
  </svg>
)

// Kênh chat của đối tác nước ngoài. WhatsApp: số điện thoại; LINE, WeChat: ID. Sao chép luôn có; mở app khi có đường dẫn.
// WeChat không có đường dẫn mở thẳng theo ID nên chỉ sao chép để dán vào app.
export function WhatsAppActions({ number }) {
  if (!number) return null
  return (
    <>
      <CopyButton value={number} />
      <LinkButton href={chatHref('whatsapp', number)} label="Nhắn WhatsApp" external><WhatsAppOutlined /></LinkButton>
    </>
  )
}

export function LineActions({ id }) {
  if (!id) return null
  return (
    <>
      <CopyButton value={id} label="Sao chép LINE ID" />
      <LinkButton href={chatHref('line', id)} label="Mở LINE" external><LineIcon /></LinkButton>
    </>
  )
}

export function WeChatActions({ id }) {
  if (!id) return null
  const href = chatHref('wechat', id)
  return (
    <>
      <CopyButton value={id} label="Sao chép WeChat ID" />
      {href ? <LinkButton href={href} label="Mở WeChat" external><WechatOutlined /></LinkButton> : null}
    </>
  )
}

// Hàng nút liên hệ nhanh cho một người: gọi, SMS, Zalo, WhatsApp, LINE, WeChat (sao chép ID), mail. Chỉ hiện kênh người đó có.
export function QuickContact({ phone, email, whatsapp, line, wechat }) {
  const channels = []
  if (phone) {
    channels.push(
      <LinkButton key="tel" href={`tel:${digits(phone)}`} label={`Gọi ${phone}`}><PhoneOutlined /></LinkButton>,
      <LinkButton key="sms" href={`sms:${digits(phone)}`} label="Nhắn SMS"><MessageOutlined /></LinkButton>,
      <ZaloButton key="zalo" phone={phone} />
    )
  }
  if (whatsapp) channels.push(<LinkButton key="wa" href={chatHref('whatsapp', whatsapp)} label="Nhắn WhatsApp" external><WhatsAppOutlined /></LinkButton>)
  if (line) channels.push(<LinkButton key="line" href={chatHref('line', line)} label="Mở LINE" external><LineIcon /></LinkButton>)
  if (wechat) channels.push(chatHref('wechat', wechat) ? <LinkButton key="wc" href={chatHref('wechat', wechat)} label="Mở WeChat" external><WechatOutlined /></LinkButton> : <WeChatQuick key="wc" id={wechat} />)
  if (email) channels.push(<LinkButton key="mail" href={`mailto:${email}`} label="Gửi mail"><MailOutlined /></LinkButton>)
  if (!channels.length) return null
  return <span className="ds-quick" role="group" aria-label="Liên hệ nhanh">{channels}</span>
}

// WeChat trong hàng nhanh: bấm để sao chép ID (không có đường dẫn mở thẳng).
function WeChatQuick({ id }) {
  return (
    <Tooltip title={`WeChat ${id}, bấm để sao chép`}>
      <button type="button" className="ds-copy" aria-label={`Sao chép WeChat ID ${id}`} onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(id) }}>
        <WechatOutlined />
      </button>
    </Tooltip>
  )
}
