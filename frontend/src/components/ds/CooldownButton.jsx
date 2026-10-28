import { Button } from 'antd'
import { formatCountdown } from '../../utils/countdown'
import './ds.css'

// Nút có thời gian chờ: `seconds` > 0 thì khoá và đếm ngược "Lấy lại sau 1:45", hết giờ tự mở lại.
// Bên gọi giữ số giây (hook useCooldown); nút chỉ hiển thị. `waitLabel` là chữ đứng trước số đếm ngược.
export default function CooldownButton({ seconds = 0, waitLabel = 'Lấy lại sau', loading = false, disabled = false, icon, children, ...rest }) {
  const waiting = seconds > 0
  return (
    <Button {...rest} icon={icon} loading={loading} disabled={disabled || waiting}>
      {waiting ? (
        <>
          {waitLabel} <span className="ds-num ds-cooldown">{formatCountdown(seconds)}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
