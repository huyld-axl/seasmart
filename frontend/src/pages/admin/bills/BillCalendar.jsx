import { useState } from 'react'
import { Button } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { formatDate } from '../../../utils/format'
import './bills.css'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const STATUS_TEXT = { UPCOMING: 'chưa đến kỳ', TO_SEND: 'cần gửi', SENT: 'đã gửi', OVERDUE: 'quá hạn', PAID: 'đã thu' }

// Các tháng từ tháng bắt đầu kỳ đầu tới tháng của hạn thanh toán cuối.
function monthsOf(periods) {
  const first = dayjs(periods[0].period_start).startOf('month')
  const lastDue = periods.reduce((max, p) => (dayjs(p.due_date).isAfter(max) ? dayjs(p.due_date) : max), dayjs(periods.at(-1).period_end))
  const out = []
  for (let m = first; !m.isAfter(lastDue, 'month'); m = m.add(1, 'month')) out.push(m)
  return out
}

// Lịch một tháng, có ‹ › chuyển tháng: dải tô từ ngày bắt đầu tới ngày kết thúc của từng kỳ (xen hai màu, kỳ đang xem đậm hơn),
// số kỳ ở ngày bắt đầu, hạn thanh toán khoanh tròn theo trạng thái. Bấm vào kỳ để mở bill kỳ đó.
export default function BillCalendar({ periods, currentId, onOpen }) {
  const months = monthsOf(periods)
  const current = periods.find((p) => p.id === currentId) || periods[0]
  const startIndex = Math.max(0, months.findIndex((m) => m.isSame(dayjs(current.period_start), 'month')))
  // Trang cha đặt key theo bill: sang bill khác thì lịch mở lại tháng bắt đầu của kỳ đó.
  const [index, setIndex] = useState(startIndex)
  const month = months[index]
  const dues = new Map(periods.map((p) => [p.due_date, p]))
  const lead = (month.day() + 6) % 7

  const cells = Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)
  for (let d = 1; d <= month.daysInMonth(); d += 1) {
    const day = month.date(d)
    const iso = day.format('YYYY-MM-DD')
    const col = (lead + d - 1) % 7
    const period = periods.find((p) => iso >= p.period_start && iso <= p.period_end)
    const due = dues.get(iso)
    const cls = ['bl-day']
    if ([0, 6].includes(day.day())) cls.push('is-off')
    let title = ''
    if (period) {
      cls.push(period.seq % 2 ? 'is-odd' : 'is-even')
      if (period.id === currentId) cls.push('is-cur')
      if (iso === period.period_start) cls.push('is-start')
      if (iso === period.period_end) cls.push('is-end')
      if (col === 0) cls.push('is-rowstart')
      if (col === 6) cls.push('is-rowend')
      title = `Kỳ ${period.seq}: ${formatDate(period.period_start)} → ${formatDate(period.period_end)} · hạn ${formatDate(period.due_date)}`
    }
    if (due) title = `${title ? `${title} · ` : ''}Hạn thanh toán kỳ ${due.seq} (${STATUS_TEXT[due.display_status]})`
    const content = due ? <span className="bl-due" data-status={due.display_status} data-n={due.seq}>{d}</span> : d
    cells.push(
      period ? (
        <button key={iso} type="button" className={cls.join(' ')} data-n={period.seq} title={title} onClick={() => period.id !== currentId && onOpen(period.id)}>{content}</button>
      ) : (
        <span key={iso} className={cls.join(' ')} title={title || undefined}>{content}</span>
      )
    )
  }

  return (
    <section className="crew-panel bl-cal-panel">
      <div className="crew-panel__head">
        <h2 className="crew-panel__title">Các kỳ của hợp đồng</h2>
        <span className="vd-muted">{periods.length} kỳ</span>
      </div>
      <div className="crew-panel__body">
        <dl className="bl-cal-cur">
          <div><dt>Kỳ {current.seq}/{periods.length} bắt đầu</dt><dd>{formatDate(current.period_start)}</dd></div>
          <div><dt>Kết thúc</dt><dd>{formatDate(current.period_end)}</dd></div>
          <div><dt>Hạn thanh toán</dt><dd>{formatDate(current.due_date)} ({WEEKDAY_SHORT[dayjs(current.due_date).day()]})</dd></div>
        </dl>
        <div className="bl-month-head">
          <Button type="text" size="small" icon={<LeftOutlined />} aria-label="Tháng trước" disabled={index === 0} onClick={() => setIndex(index - 1)} />
          <h3>Tháng {month.month() + 1}/{month.year()}</h3>
          <Button type="text" size="small" icon={<RightOutlined />} aria-label="Tháng sau" disabled={index === months.length - 1} onClick={() => setIndex(index + 1)} />
        </div>
        <div className="bl-grid">
          {WEEKDAYS.map((w) => <span key={w} className="bl-wd">{w}</span>)}
          {cells}
        </div>
      </div>
    </section>
  )
}
