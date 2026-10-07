import ProductBrand from '../../components/common/ProductBrand'
import ErrorPage from './ErrorPage'
import './ErrorPage.css'

// Trang lỗi ngoài khung app: đường dẫn lạ (404) hoặc vai trò không được vào (403).
export default function StandaloneError({ code }) {
  return (
    <main className="err-page">
      <div className="err-page__brand"><ProductBrand /></div>
      <ErrorPage code={code} />
    </main>
  )
}
