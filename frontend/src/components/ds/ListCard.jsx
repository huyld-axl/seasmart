import './ds.css'

// Thẻ danh sách ở điện thoại (kế hoạch danh sách mobile mục 3). Trang vẫn tự rẽ nhánh isMobile và truyền chuỗi đã định dạng.
//   title: tên chính, một dòng · sub: dòng phụ (mã, chức danh, kỳ) · badge: trạng thái · media: ảnh 40px trước tiêu đề
//   figure: { value, unit, tone: 'pos' | 'neg' | 'muted' } con số chính góc phải
//   fields: [{ label, value, tone: 'err' | 'warn', wide }] tối đa 4 ô có nhãn; value rỗng thì bỏ ô
//   extra: khối dưới các ô (MoneyStrip) · alert: { text, tone: 'err' | 'warn' } dải cảnh báo
//   actions: [{ label, onClick, danger, disabled }] tối đa 2 nút, bấm nút không mở thẻ
//   onOpen + openLabel: bấm phần thân mở bản ghi; nút phủ riêng để thẻ đọc được bằng trình đọc màn hình.
export function ListCardList({ children, label }) {
  return <ul className="ds-lcards" aria-label={label}>{children}</ul>
}

const filled = (value) => value != null && value !== ''

export default function ListCard({ title, sub, badge, media, figure, fields = [], extra, alert, actions = [], onOpen, openLabel }) {
  const shown = fields.filter((field) => filled(field.value)).slice(0, 4)
  const buttons = actions.slice(0, 2)
  return (
    <li className="ds-lcard">
      <div className="ds-lcard__main">
        {onOpen ? <button type="button" className="ds-lcard__open" aria-label={openLabel || (typeof title === 'string' ? `Mở ${title}` : 'Mở')} onClick={onOpen} /> : null}
        <div className={`ds-lcard__head${media ? ' ds-lcard__head--media' : ''}${figure ? '' : ' ds-lcard__head--nofig'}`}>
          {media ? <span className="ds-lcard__media">{media}</span> : null}
          <span className="ds-lcard__title">{title}</span>
          {figure ? (
            <span className={`ds-lcard__fig${figure.tone ? ` ds-lcard__fig--${figure.tone}` : ''}`}>
              {figure.value}
              {figure.unit ? <small>{figure.unit}</small> : null}
            </span>
          ) : null}
          {sub ? <span className="ds-lcard__sub">{sub}</span> : null}
          {badge ? <span className="ds-lcard__badge">{badge}</span> : null}
        </div>
        {shown.length ? (
          <dl className="ds-lcard__fields">
            {shown.map((field) => (
              <div key={field.label} className={field.wide ? 'ds-lcard__wide' : undefined}>
                <dt>{field.label}</dt>
                <dd className={field.tone ? `ds-lcard__tone--${field.tone}` : undefined}>{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {extra}
      </div>
      {alert?.text ? <div className={`ds-lcard__alert ds-lcard__alert--${alert.tone || 'warn'}`} role="status">{alert.text}</div> : null}
      {buttons.length ? (
        <div className="ds-lcard__actions">
          {buttons.map((button) => (
            <button key={button.label} type="button" className={button.danger ? 'ds-lcard__action--danger' : undefined} disabled={button.disabled} onClick={button.onClick}>{button.label}</button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

// Dải Thu − Chi = Chênh lệch của hợp đồng (chuỗi đã định dạng). Cả thu và chi trống thì ghi "Chưa nhập tiền".
export function MoneyStrip({ income, expense, result, resultTone, empty = 'Chưa nhập tiền' }) {
  if (!filled(income) && !filled(expense)) {
    return <div className="ds-lcard__money"><span className="ds-lcard__money-eq ds-lcard__tone--muted">{empty}</span></div>
  }
  return (
    <div className="ds-lcard__money">
      <span>Thu</span><b>{income ?? '—'}</b>
      <span>− Chi</span><b>{expense ?? '—'}</b>
      <span className={`ds-lcard__money-eq${resultTone ? ` ds-lcard__tone--${resultTone}` : ''}`}>= {result}</span>
    </div>
  )
}
