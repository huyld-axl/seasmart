import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import ProductBrand from '../../components/common/ProductBrand'
import useAuthStore from '../../stores/authStore'
import './ErrorPage.css'

// Tài khoản đăng nhập được nhưng chưa được gán vai trò nên chưa có quyền nào.
export default function NoRolePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  return (
    <main className="err-page">
      <div className="err-page__brand"><ProductBrand /></div>
      <div className="err-block" role="alert">
        <h1 className="err-block__title">Tài khoản chưa được gán vai trò</h1>
        <p className="err-block__desc">Tài khoản chưa được gán vai trò. Liên hệ quản trị viên.</p>
        <div className="err-block__actions">
          <Button type="primary" onClick={() => { logout(); navigate('/login') }}>Đăng xuất</Button>
        </div>
        {user?.email && <p className="err-block__foot">Bạn đang đăng nhập bằng {user.email}.</p>}
      </div>
    </main>
  )
}
