import { Button } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import './ds.css'

// Bộ chuyển giấy "Giấy 3/9" ở đầu màn duyệt từng giấy (T2). Duyệt từng giấy một, không có danh sách giấy.
export default function ReviewPager({ index, total, onPrev, onNext }) {
  return (
    <span className="ds-pager" role="group" aria-label="Chuyển giấy">
      <Button type="text" icon={<LeftOutlined />} aria-label="Giấy trước" disabled={index <= 1} onClick={onPrev} />
      <span className="ds-pager__count">Giấy {index}/{total}</span>
      <Button type="text" icon={<RightOutlined />} aria-label="Giấy sau" disabled={index >= total} onClick={onNext} />
    </span>
  )
}
