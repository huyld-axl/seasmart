import { Button, Modal } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import SparkIcon from '../../../components/ds/SparkIcon'
import CooldownButton from '../../../components/ds/CooldownButton'
import { useCooldown, useVesselLookup } from '../../../hooks/useLookupCooldown'
import { formatCountdown } from '../../../utils/countdown'
import { FleetTile } from './FleetParts'

// Câu lỗi của máy chủ không có dấu chấm cuối; thêm vào để ghép thêm câu sau cho đúng.
const sentence = (text) => (/[.!?…]$/.test(text) ? text : `${text}.`)
const errorText = (error) => sentence(error?.response?.data?.error || 'Nguồn bên ngoài không phản hồi')

// Hộp xác nhận khi bấm Thêm một tàu từ Danh mục tàu thế giới: có lấy thêm thông tin từ nguồn ngoài không.
// onSkip: chỉ dùng thông tin danh mục. onResult(result): đã lấy xong (kể cả khi nguồn không có tàu).
export default function SmartFetchDialog({ row, onCancel, onSkip, onResult }) {
  const lookup = useVesselLookup()
  const imo = row?.imo_number
  const cooldown = useCooldown(imo)
  const pending = lookup.isPending
  const sub = [row?.imo_number && `IMO ${row.imo_number}`, row?.ship_type, row?.flag_name].filter(Boolean).join(' · ')

  async function run() {
    try {
      onResult(await lookup.mutateAsync(imo))
    } catch {
      // Lỗi hiện ngay trong hộp, kèm số giây chờ; nút tự đếm ngược theo trần chung.
    }
  }

  // Chỉ một thông báo mỗi lúc: lỗi vừa xảy ra (đã gồm thời gian chờ), hoặc đang chờ lượt chung.
  let notice = null
  if (lookup.isError) {
    const wait = cooldown > 0 ? ` Có thể thử lại sau ${formatCountdown(cooldown)}.` : ''
    const counted = lookup.error?.response?.status === 502 ? ' Lượt này vẫn tính vào thời gian chờ chung.' : ''
    notice = <Banner tone="error" title="Không lấy được thông tin thông minh" description={`${errorText(lookup.error)}${counted}${wait}`} />
  } else if (cooldown > 0) {
    notice = <Banner tone="warning" title="Chưa lấy được lúc này" description={`Hệ thống chỉ lấy thông tin thông minh 1 lần mỗi 2 phút. Có thể lấy sau ${formatCountdown(cooldown)}.`} />
  }

  return (
    <Modal
      open={!!row}
      width={520}
      title="Lấy thông tin thông minh?"
      onCancel={pending ? undefined : onCancel}
      mask={{ closable: !pending }}
      closable={!pending}
      afterClose={() => lookup.reset()}
      destroyOnHidden
      footer={
        <div className="fl-smart__foot">
          <Button color="default" variant="filled" disabled={pending} onClick={onSkip}>Dùng thông tin danh mục</Button>
          <CooldownButton type="primary" icon={<SparkIcon />} seconds={cooldown} loading={pending} onClick={run}>Lấy thông minh</CooldownButton>
        </div>
      }
    >
      <div className="fl-smart">
        <div className="fl-smart__vessel">
          <FleetTile />
          <div className="fl-smart__who">
            <span className="fl-smart__name">{row?.ship_name}</span>
            <span className="fl-smart__sub">{sub}</span>
          </div>
        </div>
        <p className="fl-smart__text">Tra thêm năm đóng, trọng tải, quản lý, chủ tàu… từ nguồn bên ngoài rồi điền vào form. Có thể mất tới một phút. Bạn vẫn kiểm tra lại trước khi lưu.</p>
        <p className="fl-smart__hint"><ClockCircleOutlined aria-hidden /> Toàn hệ thống chỉ lấy thông tin thông minh 1 lần mỗi 2 phút.</p>
        {notice}
      </div>
    </Modal>
  )
}
