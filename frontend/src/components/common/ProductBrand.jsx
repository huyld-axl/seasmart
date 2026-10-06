import ProductMark from './ProductMark'
import './ProductBrand.css'

// Logo sản phẩm: ô màu nhấn chứa dấu, tên bên phải. Dùng ở đầu sidebar, màn đăng nhập, trang lỗi.
// `collapsed`: sidebar thu gọn, chỉ còn ô. `inverted`: đặt trên nền tối (sidebar tối hiện tại).
export default function ProductBrand({ name = 'MCAH', collapsed = false, inverted = false }) {
  const classNames = ['product-brand']
  if (collapsed) classNames.push('product-brand--collapsed')
  if (inverted) classNames.push('product-brand--inverted')

  return (
    <span className={classNames.join(' ')}>
      <span className="product-brand__mark">
        <ProductMark />
      </span>
      <span className="product-brand__name">{name}</span>
    </span>
  )
}
