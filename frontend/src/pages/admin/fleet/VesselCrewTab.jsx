import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Select, Skeleton } from 'antd'
import dayjs from 'dayjs'
import CrewTimeline, { CrewTimelineLegend } from '../../../components/ds/CrewTimeline'
import { EmptyState } from '../../../components/ds/Controls'
import { lookupApi } from '../../../api'
import { useCrewTimeline } from '../../../hooks/useVoyages'
import { useCan } from '../../../hooks/usePermission'
import { SOURCE_LABELS } from '../../../constants/opportunityVoyage'
import { formatDate } from '../../../utils/format'
import LeaveModal from '../voyages/LeaveModal'
import VoyageTable from '../voyages/VoyageTable'
import { crewRange, crewRows } from '../voyages/voyageList'
import { SegmentedPick } from './FleetParts'
import '../voyages/voyages.css'
import '../opportunities/opportunities.css'

const API_DATE = 'YYYY-MM-DD'
const RANGES = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'half', label: '6 tháng tới' },
  { value: 'year', label: 'Cả năm' },
  { value: 'custom', label: 'Tuỳ chọn' },
]
const VIEWS = [{ value: 'chart', label: 'Biểu đồ' }, { value: 'table', label: 'Bảng' }]

function Sum({ label, value, sub }) {
  return (
    <div className="vd-sum">
      <div className="vd-sum__body">
        <p className="vd-sum__label">{label}</p>
        <p className="vd-sum__value"><b>{value}</b></p>
        {sub ? <p className="vd-sum__sub">{sub}</p> : null}
      </div>
    </div>
  )
}

// Màn 10 · Đội ngũ: ai trên tàu trong một khoảng thời gian, mỗi chuyến một hàng; cơ hội đang mở hiện nhạt.
export default function VesselCrewTab({ vessel }) {
  const navigate = useNavigate()
  const can = useCan()
  const [rangeKey, setRangeKey] = useState('today')
  const [custom, setCustom] = useState(() => crewRange('half'))
  const [rankId, setRankId] = useState()
  const [view, setView] = useState('chart')
  const [selected, setSelected] = useState([])
  const [leaving, setLeaving] = useState(null)
  const range = rangeKey === 'custom' ? custom : crewRange(rangeKey)
  const ranks = useQuery({ queryKey: ['ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data), staleTime: 300000 })
  const timeline = useCrewTimeline({
    vessel_id: vessel.id,
    from: range?.[0]?.format(API_DATE),
    to: range?.[1]?.format(API_DATE),
    rank_id: rankId,
  })

  const data = timeline.data
  const voyages = data?.voyages || []
  const summary = data?.summary
  // Biểu đồ cần bề ngang: khoảng "Hôm nay" nới ra trọn tháng trước và tháng sau để nhãn tháng không chồng nhau.
  const [chartFrom, chartTo] = rangeKey === 'today' && range
    ? [range[0].subtract(1, 'month').startOf('month'), range[1].add(1, 'month').endOf('month')]
    : range || []
  const rows = data ? crewRows({
    voyages,
    openings: data.open_opportunities,
    today: data.today,
    formatDate,
    onVoyage: (v) => navigate(`/voyages/${v.id}`),
    onOpening: can('opportunity.view') ? (o) => navigate(`/opportunities/${o.id}`) : undefined,
  }) : []
  const picked = voyages.filter((v) => selected.includes(v.id))
  const replaceQuery = new URLSearchParams({ owner: vessel.ship_owner_id || '', vessel: vessel.id })
  const sources = summary ? Object.entries(summary.by_source).filter(([, n]) => n).map(([k, n]) => `${SOURCE_LABELS[k]} ${n}`).join(' · ') : ''

  let body
  if (timeline.isError) {
    body = <EmptyState isError title="Không tải được đội ngũ" description="Mất kết nối tới máy chủ." action={<Button onClick={() => timeline.refetch()}>Thử lại</Button>} />
  } else if (timeline.isLoading || !range) {
    body = range ? <div className="crew-panel__body"><Skeleton active paragraph={{ rows: 5 }} /></div> : <EmptyState title="Chọn khoảng thời gian" />
  } else if (view === 'chart') {
    body = (
      <div className="crew-panel__body">
        <CrewTimeline from={chartFrom.format(API_DATE)} to={chartTo.format(API_DATE)} today={data.today} rows={rows} />
        {rows.length ? <CrewTimelineLegend /> : null}
      </div>
    )
  } else if (!voyages.length) {
    body = <EmptyState title="Chưa có chuyến nào trong khoảng này" />
  } else {
    body = (
      <>
        {picked.length ? (
          <div className="op-bulk">
            <b>Đã chọn {picked.length} chuyến</b>
            <Button size="small" type="primary" onClick={() => setLeaving(picked)}>Ghi rời tàu</Button>
            <Button size="small" type="text" onClick={() => setSelected([])}>Bỏ chọn</Button>
          </div>
        ) : null}
        <VoyageTable
          rows={voyages}
          hideVessel
          scroll={{ x: 'max-content' }}
          selected={can('voyage.run') ? selected : null}
          onSelect={setSelected}
          onOpen={(v) => navigate(`/voyages/${v.id}`)}
        />
      </>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="vy-crew-tools">
        <SegmentedPick value={rangeKey} options={RANGES} label="Khoảng thời gian" onChange={(value) => { setRangeKey(value); setSelected([]) }} />
        {rangeKey === 'custom' ? (
          <DatePicker.RangePicker format="DD/MM/YYYY" value={custom} onChange={(value) => { setCustom(value); setSelected([]) }} aria-label="Khoảng tuỳ chọn" />
        ) : null}
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Tất cả chức danh"
          aria-label="Lọc theo chức danh"
          style={{ width: 200 }}
          value={rankId}
          onChange={(value) => { setRankId(value); setSelected([]) }}
          loading={ranks.isLoading}
          options={(ranks.data || []).map((r) => ({ value: r.id, label: r.name_vi }))}
        />
        <SegmentedPick className="vy-crew-tools__end" value={view} options={VIEWS} label="Cách xem" onChange={setView} />
      </div>

      {summary ? (
        <div className="vd-sums vy-crew-sums">
          <Sum label="Trên tàu hôm nay" value={summary.onboard_today} />
          <Sum label="Chuyến trong khoảng" value={summary.voyages_in_range} sub={summary.left_in_range ? `${summary.left_in_range} đã rời` : undefined} />
          <Sum
            label="Sắp rời, chưa có người thay"
            value={summary.leaving_without_cover}
            sub={summary.leaving_without_cover && can('opportunity.create')
              ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/opportunities/new?${replaceQuery}`)}>Tạo cơ hội thay</Button>
              : 'Rời trong 6 tháng tới, tàu chưa có cơ hội cùng chức danh'}
          />
          <Sum label="Nguồn" value={summary.voyages_in_range} sub={sources || '—'} />
        </div>
      ) : null}

      <section className="crew-panel">
        <div className="crew-panel__head">
          <h2 className="crew-panel__title">
            Đội ngũ {range ? (rangeKey === 'today' ? `hôm nay ${formatDate(dayjs())}` : `${formatDate(range[0])} – ${formatDate(range[1])}`) : ''}
            <span className="vd-count">{voyages.length}</span>
          </h2>
        </div>
        {body}
      </section>

      {leaving ? <LeaveModal voyages={leaving} onClose={() => setLeaving(null)} onDone={() => setSelected([])} /> : null}
    </div>
  )
}
