import { Button, Skeleton } from 'antd'
import KpiBars from '../../../components/ds/KpiBars'
import ProgressMeter from '../../../components/ds/ProgressMeter'
import StatusBadge from '../../../components/ds/StatusBadge'
import { EmptyState } from '../../../components/ds/Controls'
import { monthBars, usd, usdShort } from './attentionRows'

function CardShell({ children }) {
  return <section className="ds-card dash-card">{children}</section>
}

function Loading() {
  return <CardShell><Skeleton active title={{ width: '40%' }} paragraph={{ rows: 4 }} /></CardShell>
}

function Failed({ title, onRetry }) {
  return (
    <CardShell>
      <EmptyState isError title={title} description="Mất kết nối tới máy chủ. Khối khác vẫn dùng được." action={<Button onClick={onRetry}>Thử lại</Button>} />
    </CardShell>
  )
}

function Head({ label, value, unit, sub, badge }) {
  return (
    <div className="dash-kpi">
      <div>
        <p className="dash-kpi__label">{label}</p>
        <p className="dash-kpi__value">{value}{unit ? <small>{unit}</small> : null}</p>
        {sub ? <p className="dash-kpi__sub">{sub}</p> : null}
      </div>
      {badge}
    </div>
  )
}

function Legend({ items }) {
  return <div className="dash-legend">{items.filter(Boolean).map(([kind, text]) => <span key={text}><i className={`dash-legend__${kind}`} />{text}</span>)}</div>
}

// Thẻ Doanh thu: số dự kiến cả tháng, nhãn so với mục tiêu, cột 6 tháng.
export function RevenueCard({ query, own }) {
  if (query.isLoading) return <Loading />
  const title = own ? 'Doanh thu của bạn · tháng này' : 'Doanh thu · tháng này'
  if (query.isError) return <Failed title="Không tải được doanh thu" onRetry={() => query.refetch()} />
  const { revenue } = query.data
  const months = revenue.months
  const now = months[months.length - 1]
  const running = Boolean(now.projected)
  const label = revenue.label
  const badge = label ? (label.kind === 'SHORT'
    ? <StatusBadge group="kpi" value="SHORT" size="lg" label={`Thiếu ${usd(label.short)} USD`} />
    : <StatusBadge group="kpi" value="DONE" size="lg" />) : null
  const sub = [running ? `Dự kiến cả tháng · đã ghi nhận ${usd(revenue.to_date)} USD tới hôm nay` : 'Cả tháng', revenue.target != null ? `mục tiêu ${usd(revenue.target)} USD` : null].filter(Boolean).join(' · ')
  return (
    <CardShell>
      <Head label={title} value={usd(now.value)} unit="USD" sub={sub} badge={badge} />
      <div className="dash-chart">
        <KpiBars data={monthBars(months, running)} target={revenue.target} format={usdShort} label={`Doanh thu 6 tháng: ${months.map((m) => `${m.month} ${usd(m.value)} USD`).join(', ')}`} />
        <Legend items={[['done', 'Đã chốt'], running && ['est', 'Dự kiến'], revenue.target != null && ['tgt', `Mục tiêu ${usdShort(revenue.target)}`]]} />
      </div>
    </CardShell>
  )
}

function contractBadge(label) {
  return label ? <StatusBadge group="kpi" value={label} size="lg" /> : null
}

// Thẻ Hợp đồng mới ký. Quản lý: một dòng mỗi môi giới viên. Môi giới: thanh tiến độ + cột 6 tháng.
export function ContractCard({ query, own }) {
  if (query.isLoading) return <Loading />
  if (query.isError) return <Failed title="Không tải được hợp đồng mới ký" onRetry={() => query.refetch()} />
  const { contracts, revenue, day, days_in_month: days } = query.data
  const { done, target, pace, pending } = contracts
  const sub = target == null ? 'Chưa đặt mục tiêu tháng' : `Còn ${Math.max(0, target - done)} hợp đồng trong ${days - day} ngày`
  const head = <Head label={own ? 'Hợp đồng bạn ký · tháng này' : 'Hợp đồng mới ký · tháng này'} value={done} unit={target != null ? `/ ${target}` : null} sub={sub} badge={contractBadge(contracts.label)} />

  if (own) {
    const sum = pending ? pending.pending + pending.draft + pending.owner_selected : 0
    const parts = pending ? [[pending.pending, 'chờ duyệt'], [pending.draft, 'nháp'], [pending.owner_selected, 'chủ tàu đã chọn']].filter(([n]) => n).map(([n, t]) => `${n} ${t}`) : []
    return (
      <CardShell>
        {head}
        {target != null ? (
          <div className="dash-meter">
            <ProgressMeter done={done} target={target} pace={pace} pending={sum} />
            <p className="dash-meter__legend">{sum ? `Gạch chéo: +${sum} sắp vào (${parts.join(', ')})` : 'Chưa có hợp đồng nào sắp vào'} · vạch đứng: tiến độ cần có hôm nay</p>
          </div>
        ) : null}
        <div className="dash-chart">
          <KpiBars data={monthBars(contracts.months, Boolean(revenue.months.at(-1).projected))} target={target} label={`Hợp đồng ký 6 tháng: ${contracts.months.map((m) => `${m.month} ${m.value}`).join(', ')}`} />
        </div>
      </CardShell>
    )
  }

  const people = query.data.people || []
  return (
    <CardShell>
      {head}
      {people.length ? (
        <ul className="dash-people">
          {people.map((p) => (
            <li key={p.user_id} className={p.label === 'BEHIND' ? 'dash-person dash-person--behind' : 'dash-person'}>
              <span className="dash-person__name">{p.name}</span>
              {p.target != null ? <ProgressMeter done={p.done} target={p.target} pace={p.pace} size="sm" /> : <span className="dash-person__none">Chưa đặt mục tiêu</span>}
              <span className="dash-person__val">{p.done}{p.target != null ? <small> / {p.target}</small> : null}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Chưa có hợp đồng nào tháng này" description="Khi hợp đồng được duyệt lần đầu, số của từng môi giới viên hiện ở đây." />
      )}
      {people.some((p) => p.target != null) ? <Legend items={[['done', 'Đã ký'], ['pace', 'Tiến độ cần có hôm nay'], ['behind', 'Đỏ: đang chậm']]} /> : null}
    </CardShell>
  )
}
