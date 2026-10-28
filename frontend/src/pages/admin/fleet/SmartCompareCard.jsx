import { useState } from 'react'
import { Button, Checkbox } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import SparkIcon from '../../../components/ds/SparkIcon'

// Sửa tàu: kết quả Lấy thông tin thông minh không ghi đè. Liệt kê ô trống (chọn sẵn) và ô khác giá trị hiện tại (để người dùng quyết định).
// onApply(rows): các dòng được chọn; form đặt giá trị và hiện chip "Đã sửa", chỉ ghi vào tàu khi bấm Lưu thay đổi.
export default function SmartCompareCard({ compare, onApply, onClose }) {
  const [picked, setPicked] = useState(() => new Set(compare.rows.filter((row) => row.on).map((row) => row.key)))
  const toggle = (key) => setPicked((previous) => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  return (
    <section className="fl-compare" aria-label="Thông tin thông minh">
      <div className="fl-compare__head">
        <b><SparkIcon aria-hidden /> Thông tin thông minh <span className="fl-compare__at">lấy lúc {compare.at}</span></b>
        <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Đóng" onClick={onClose} />
      </div>
      <p className="fl-compare__hint">Chọn trường muốn áp dụng. Ô đang trống được chọn sẵn; ô khác giá trị hiện tại thì để bạn quyết định.</p>
      <table className="fl-compare__table">
        <thead><tr><th scope="col" /><th scope="col">Trường</th><th scope="col">Hiện tại</th><th scope="col">Thông minh</th></tr></thead>
        <tbody>
          {compare.rows.map((row) => (
            <tr key={row.key}>
              <td><Checkbox checked={picked.has(row.key)} onChange={() => toggle(row.key)} aria-label={`Áp dụng ${row.label}`} /></td>
              <td>{row.label}</td>
              <td>{row.current ?? <span className="fl-compare__empty">Trống</span>}</td>
              <td><b>{row.next}</b>{row.current != null ? <span className="fl-compare__diff">Khác</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fl-compare__foot">
        <Button size="small" onClick={onClose}>Bỏ qua</Button>
        <Button size="small" type="primary" disabled={!picked.size} onClick={() => onApply(compare.rows.filter((row) => picked.has(row.key)))}>
          Áp dụng {picked.size} trường
        </Button>
      </div>
    </section>
  )
}
