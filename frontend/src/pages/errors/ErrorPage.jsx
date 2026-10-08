import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import useAuthStore from '../../stores/authStore'
import './ErrorPage.css'

// Trang lỗi (D5, UI Kit): 403 / 404 / 500. Nằm trong khung app khi đã đăng nhập.
export default function ErrorPage({ code = 404, errorId }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [copied, setCopied] = useState(false)
  const home = () => navigate(user?.role === 'training_center' ? '/courses' : '/seafarers')
  const homeLabel = user?.role === 'training_center' ? 'Về trang Khóa học' : 'Về trang Thuyền viên'

  async function copy() {
    try { await navigator.clipboard.writeText(errorId); setCopied(true) } catch { setCopied(false) }
  }

  if (code === 403) {
    return (
      <div className="err-block" role="alert">
        <h1 className="err-block__title">Bạn chưa có quyền xem trang này</h1>
        <p className="err-block__desc">Trang này chỉ dành cho một số vai trò. Nếu cần, nhờ Quản trị cấp quyền cho tài khoản của bạn.</p>
        <div className="err-block__actions">
          <Button type="primary" onClick={home}>{homeLabel}</Button>
          <Button onClick={() => navigate(-1)}>Quay lại trang trước</Button>
        </div>
        {user?.email && <p className="err-block__foot">Bạn đang đăng nhập bằng {user.email}.</p>}
      </div>
    )
  }
  if (code === 500) {
    return (
      <div className="err-block" role="alert">
        <h1 className="err-block__title">Trang này đang gặp lỗi</h1>
        <p className="err-block__desc">Lỗi nằm ở phía hệ thống, không phải do bạn. Thử tải lại; nếu vẫn lỗi, gửi mã bên dưới cho quản trị.</p>
        <div className="err-block__actions">
          <Button type="primary" onClick={() => window.location.reload()}>Tải lại trang</Button>
          <Button onClick={home}>{homeLabel}</Button>
        </div>
        {errorId && (
          <p className="err-block__foot">
            <span className="err-block__code-line">Mã lỗi: <span className="ds-mono" style={{ userSelect: 'all' }}>{errorId}</span>
              <Button size="small" type="text" icon={<CopyOutlined />} aria-label="Sao chép mã lỗi" onClick={copy} />
              {copied && <span role="status">Đã chép</span>}
            </span>
          </p>
        )}
      </div>
    )
  }
  return (
    <div className="err-block">
      <p className="err-block__code ds-num">404</p>
      <h1 className="err-block__title">Không tìm thấy trang</h1>
      <p className="err-block__desc">Đường dẫn có thể bị gõ sai, hoặc trang đã được chuyển sang chỗ khác.</p>
      <div className="err-block__actions">
        <Button type="primary" onClick={home}>{homeLabel}</Button>
        <Button onClick={() => navigate(-1)}>Quay lại trang trước</Button>
      </div>
    </div>
  )
}
