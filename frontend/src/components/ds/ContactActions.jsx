import { App, Tooltip } from 'antd'
import { MailOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons'
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

// Thao tác nhanh cho một số điện thoại: sao chép, gọi, nhắn SMS. Kiểu duy nhất của MCAH, đặt ngay sau số.
export function PhoneActions({ phone }) {
  if (!phone) return null
  return (
    <span className="ds-contact-actions" role="group" aria-label="Thao tác liên hệ">
      <CopyButton value={phone} />
      <LinkButton href={`tel:${digits(phone)}`} label="Gọi điện"><PhoneOutlined /></LinkButton>
      <LinkButton href={`sms:${digits(phone)}`} label="Nhắn SMS"><MessageOutlined /></LinkButton>
    </span>
  )
}

// Thao tác nhanh cho một email: sao chép, gửi mail (mở ứng dụng mail của thiết bị).
export function EmailActions({ email }) {
  if (!email) return null
  return (
    <span className="ds-contact-actions" role="group" aria-label="Thao tác liên hệ">
      <CopyButton value={email} />
      <LinkButton href={`mailto:${email}`} label="Gửi mail"><MailOutlined /></LinkButton>
    </span>
  )
}

const ChatIcon = ({ channel }) => (
  <img className="ds-chat-logo" src={`/images/contact/${channel}.svg`} alt="" aria-hidden="true" />
)

// Kênh chat của đối tác nước ngoài. WhatsApp: số điện thoại; LINE, WeChat: ID. Sao chép luôn có; mở app khi có đường dẫn.
// WeChat không có đường dẫn mở thẳng theo ID nên chỉ sao chép để dán vào app.
export function WhatsAppActions({ number }) {
  if (!number) return null
  return (
    <span className="ds-contact-actions" role="group" aria-label="Thao tác liên hệ">
      <CopyButton value={number} />
      <LinkButton href={chatHref('whatsapp', number)} label="Nhắn WhatsApp" external><ChatIcon channel="whatsapp" /></LinkButton>
    </span>
  )
}

export function LineActions({ id }) {
  if (!id) return null
  return (
    <span className="ds-contact-actions" role="group" aria-label="Thao tác liên hệ">
      <CopyButton value={id} label="Sao chép LINE ID" />
      <LinkButton href={chatHref('line', id)} label="Mở LINE" external><ChatIcon channel="line" /></LinkButton>
    </span>
  )
}

export function WeChatActions({ id }) {
  if (!id) return null
  const href = chatHref('wechat', id)
  return (
    <span className="ds-contact-actions" role="group" aria-label="Thao tác liên hệ">
      <CopyButton value={id} label="Sao chép WeChat ID" />
      {href ? <LinkButton href={href} label="Mở WeChat" external><ChatIcon channel="wechat" /></LinkButton> : null}
    </span>
  )
}

// Hàng nút liên hệ nhanh cho một người: gọi, SMS, Zalo, WhatsApp, LINE, WeChat (mở ứng dụng), mail. Chỉ hiện kênh người đó có.
export function QuickContact({ phone, zalo, email, whatsapp, line, wechat }) {
  const channels = []
  if (phone) {
    channels.push(
      <LinkButton key="tel" href={`tel:${digits(phone)}`} label={`Gọi ${phone}`}><PhoneOutlined /></LinkButton>,
      <LinkButton key="sms" href={`sms:${digits(phone)}`} label="Nhắn SMS"><MessageOutlined /></LinkButton>,
    )
  }
  if (zalo) channels.push(<ZaloButton key="zalo" phone={zalo} />)
  if (whatsapp) channels.push(<LinkButton key="wa" href={chatHref('whatsapp', whatsapp)} label="Nhắn WhatsApp" external><ChatIcon channel="whatsapp" /></LinkButton>)
  if (line) channels.push(<LinkButton key="line" href={chatHref('line', line)} label="Mở LINE" external><ChatIcon channel="line" /></LinkButton>)
  if (wechat) channels.push(chatHref('wechat', wechat) ? <LinkButton key="wc" href={chatHref('wechat', wechat)} label="Mở WeChat" external><ChatIcon channel="wechat" /></LinkButton> : <WeChatQuick key="wc" id={wechat} />)
  if (email) channels.push(<LinkButton key="mail" href={`mailto:${email}`} label="Gửi mail"><MailOutlined /></LinkButton>)
  if (!channels.length) return null
  return <span className="ds-quick" role="group" aria-label="Liên hệ nhanh">{channels}</span>
}

// WeChat không hỗ trợ mở cuộc trò chuyện trực tiếp từ ID.
function WeChatQuick({ id }) {
  const { modal } = App.useApp()
  return (
    <Tooltip title={`Mở WeChat · ${id}`}>
      <a href="weixin://" className="ds-copy" aria-label={`Mở WeChat để liên hệ ${id}`} onClick={(e) => {
        e.stopPropagation()
        modal.info({
          title: 'Liên hệ qua WeChat',
          content: <p>Trong WeChat, chọn + → Thêm bạn bè và tìm ID: <strong>{id}</strong>. Để mở trực tiếp hồ sơ, hãy lưu đường dẫn từ mã QR kết bạn của người này.</p>,
          okText: 'Đã hiểu',
          closable: true,
          maskClosable: true,
        })
      }}>
        <ChatIcon channel="wechat" />
      </a>
    </Tooltip>
  )
}

export function ZaloActions({ value }) {
  if (!value) return null
  return <span className="ds-contact-actions" role="group" aria-label="Liên hệ Zalo"><CopyButton value={value} label="Sao chép Zalo" /><ZaloButton phone={value} /></span>
}
