import { useState } from 'react'
import { Button, Dropdown } from 'antd'
import { CheckOutlined, DownOutlined } from '@ant-design/icons'
import './ds.css'

// Đường giai đoạn dạng chevron (kiểu thanh path của Salesforce): mốc đã qua màu xanh có tích, mốc hiện tại màu navy.
// steps: [{ key, label, note, hint, onClick, menu }]
//   onClick: bấm mốc là làm việc luôn · menu: danh sách antd (bấm mốc mở danh sách chọn, ví dụ chọn người) · không có cả hai: mốc chỉ để xem.
//   hint: rê chuột vào mốc thì cho biết bấm sẽ làm gì.
// current: chỉ số mốc hiện tại; mọi mốc trước nó là đã qua. stopped: cơ hội đã đóng, cả đường chuyển xám.
// next: { label, onClick | menu, hint } nút chính bên phải đường, là việc kế tiếp; không có thì không hiện nút.
// info: [[nhãn, giá trị]] khung "Thông tin giai đoạn" · todo: [{ key, label, done }] khung "Việc cần làm"
// Nút mũi tên đầu đường mở / thu gọn hai khung bên dưới (mặc định thu gọn).
// end: nút kết thúc (Không thành, Huỷ…) đặt dưới danh sách việc cần làm.
export default function StageTrack({ steps, current, stopped = false, next = null, info = [], todo = [], end = null, label = 'Giai đoạn' }) {
  const [open, setOpen] = useState(false)
  const hasGuide = Boolean(info.length || todo.length || end)
  const shownInfo = info.filter(([, value]) => value != null && value !== '')
  return (
    <div className={`ds-track${stopped ? ' ds-track--stopped' : ''}`}>
      <div className="ds-track__bar">
        {hasGuide ? (
          <button
            type="button"
            className={`ds-track__toggle${open ? ' ds-track__toggle--open' : ''}`}
            aria-expanded={open}
            aria-label={open ? 'Thu gọn thông tin giai đoạn' : 'Mở thông tin giai đoạn'}
            title={open ? 'Thu gọn' : 'Mở rộng'}
            onClick={() => setOpen((v) => !v)}
          >
            <DownOutlined />
          </button>
        ) : null}
        <ol className="ds-track__list" aria-label={label}>
          {steps.map((step, index) => {
            const state = index < current ? 'done' : index === current ? 'current' : 'todo'
            const body = (
              <>
                {state === 'done' ? <CheckOutlined aria-hidden /> : null}
                <span className="ds-track__label">{step.label}</span>
                {step.note ? <span className="ds-track__note">· {step.note}</span> : null}
              </>
            )
            const className = `ds-track__step ds-track__step--${state}`
            const ariaCurrent = state === 'current' && !stopped ? 'step' : undefined
            let node = <div className={className} aria-current={ariaCurrent}>{body}</div>
            if (step.onClick) {
              node = <button type="button" className={`${className} ds-track__step--action`} title={step.hint} aria-current={ariaCurrent} onClick={step.onClick}>{body}</button>
            } else if (step.menu) {
              node = (
                <Dropdown menu={{ items: step.menu }} trigger={['click']} placement="bottom">
                  <button type="button" className={`${className} ds-track__step--action`} title={step.hint} aria-current={ariaCurrent} aria-haspopup="menu">{body}</button>
                </Dropdown>
              )
            }
            return <li key={step.key} className="ds-track__item">{node}</li>
          })}
        </ol>
        {next?.menu ? (
          <Dropdown menu={{ items: next.menu }} trigger={['click']} placement="bottomRight">
            <Button type="primary" title={next.hint}>{next.label}</Button>
          </Dropdown>
        ) : null}
        {next?.onClick ? <Button type="primary" title={next.hint} onClick={next.onClick}>{next.label}</Button> : null}
      </div>
      {hasGuide && open ? (
        <div className="ds-track__guide">
          <div className="ds-track__col">
            <h3>Thông tin giai đoạn</h3>
            <dl className="ds-track__info">
              {shownInfo.map(([name, value]) => (
                <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </div>
          <div className="ds-track__col">
            <h3>Việc cần làm</h3>
            <ul className="ds-track__todo">
              {todo.map((item) => (
                <li key={item.key} className={item.done ? 'ds-track__todo-done' : undefined}>
                  <span className="ds-track__todo-box" aria-hidden>{item.done ? <CheckOutlined /> : null}</span>
                  {item.label}
                </li>
              ))}
            </ul>
            {end ? <div className="ds-track__end">{end}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
