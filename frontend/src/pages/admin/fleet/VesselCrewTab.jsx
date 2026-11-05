import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Select, Skeleton } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import CrewTimeline, { CrewTimelineLegend } from '../../../components/ds/CrewTimeline'
import { EmptyState } from '../../../components/ds/Controls'
import { lookupApi } from '../../../api'
import { useCrewTimeline } from '../../../hooks/useVoyages'
import useViewport from '../../../hooks/useViewport'
import { useCan } from '../../../hooks/usePermission'
import { formatDate } from '../../../utils/format'
import LeaveModal from '../voyages/LeaveModal'
import VoyageTable from '../voyages/VoyageTable'
import { crewRange, crewRows } from '../voyages/voyageList'
import { SegmentedPick } from './FleetParts'
import '../voyages/voyages.css'
import '../opportunities/opportunities.css'

const API_DATE = 'YYYY-MM-DD'
const VIEWS = [{ value: 'chart', label: 'Biểu đồ' }, { value: 'table', label: 'Bảng' }]

// Màn 10 · Đội ngũ: ai trên tàu trong một khoảng thời gian, mỗi chuyến một hàng; cơ hội đang mở hiện nhạt.
export default function VesselCrewTab({ vessel }) {
  const navigate = useNavigate()
  const can = useCan()
  const [rankId, setRankId] = useState()
  const [chosenView, setView] = useState('chart')
  // Điện thoại: biểu đồ khó đọc nên luôn là dạng bảng, không có nút chuyển.
  const phone = useViewport().isPhone
  const view = phone ? 'table' : chosenView
  const [selected, setSelected] = useState([])
  const [leaving, setLeaving] = useState(null)
  // Số ngày đã dời khoảng xem khỏi hôm nay (dương = tương lai), mỗi lần bấm mũi tên là một tuần.
  const [shift, setShift] = useState(0)
  // Chỉ có một dạng xem: hôm nay. Mũi tên ở đầu khung để đi tiếp hoặc lùi một tuần.
  const range = crewRange('today')
  const ranks = useQuery({ queryKey: ['ranks'], queryFn: () => lookupApi.ranks().then((r) => r.data), staleTime: 300000 })
  const timeline = useCrewTimeline({
    vessel_id: vessel.id,
    from: range?.[0]?.format(API_DATE),
    to: range?.[1]?.format(API_DATE),
    rank_id: rankId,
  })

  const data = timeline.data
  const voyages = data?.voyages || []
  // Vẽ ±2 tuần quanh hôm nay để thấy được từng ngày; kéo biểu đồ thì dời cả khoảng.
  const baseFrom = range[0].subtract(14, 'day')
  const baseTo = range[1].add(14, 'day')
  const chartFrom = baseFrom.add(shift, 'day')
  const chartTo = baseTo.add(shift, 'day')
  // Dữ liệu cho biểu đồ lấy theo khoảng đang vẽ (thẻ tóm tắt và bảng vẫn theo khoảng đã chọn).
  const chartTimeline = useCrewTimeline({
    vessel_id: vessel.id,
    from: chartFrom?.format(API_DATE),
    to: chartTo?.format(API_DATE),
    rank_id: rankId,
  }, { enabled: view === 'chart' })
  const chartData = chartTimeline.data
  const rows = chartData ? crewRows({
    voyages: chartData.voyages || [],
    openings: chartData.open_opportunities,
    today: chartData.today,
    formatDate,
    onVoyage: (v) => navigate(`/voyages/${v.id}`),
    onOpening: can('opportunity.view') ? (o) => navigate(`/opportunities/${o.id}`) : undefined,
  }) : []
  const picked = voyages.filter((v) => selected.includes(v.id))

  let body
  if (timeline.isError) {
    body = <EmptyState isError title="Không tải được đội ngũ" description="Mất kết nối tới máy chủ." action={<Button onClick={() => timeline.refetch()}>Thử lại</Button>} />
  } else if (timeline.isLoading) {
    body = <div className="crew-panel__body"><Skeleton active paragraph={{ rows: 5 }} /></div>
  } else if (view === 'chart' && !chartData) {
    body = <div className="crew-panel__body"><Skeleton active paragraph={{ rows: 5 }} /></div>
  } else if (view === 'chart') {
    body = (
      <div className="crew-panel__body">
        <CrewTimeline from={chartFrom.format(API_DATE)} to={chartTo.format(API_DATE)} today={chartData?.today || data.today} rows={rows} keepWhenEmpty={shift !== 0} />
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
        {phone ? null : <SegmentedPick className="vy-crew-tools__end" value={view} options={VIEWS} label="Cách xem" onChange={setView} />}
      </div>

      <section className="crew-panel">
        <div className="crew-panel__head">
          <h2 className="crew-panel__title">
            Đội ngũ {view === 'chart' && shift ? `${formatDate(chartFrom)} – ${formatDate(chartTo)}` : `hôm nay ${formatDate(dayjs())}`}
            <span className="vd-count">{(view === 'chart' && shift && chartData ? chartData.voyages?.length : voyages.length) ?? 0} chuyến</span>
          </h2>
          {view === 'chart' ? (
            <span className="crew-panel__hint">
              {shift ? <Button size="small" onClick={() => setShift(0)}>Về hôm nay</Button> : null}
              <Button size="small" icon={<LeftOutlined />} aria-label="Lùi 1 tuần" title="Lùi 1 tuần" onClick={() => setShift((current) => current - 7)} />
              <Button size="small" icon={<RightOutlined />} aria-label="Tiến 1 tuần" title="Tiến 1 tuần" onClick={() => setShift((current) => current + 7)} />
            </span>
          ) : null}
        </div>
        {body}
      </section>

      {leaving ? <LeaveModal voyages={leaving} onClose={() => setLeaving(null)} onDone={() => setSelected([])} /> : null}
    </div>
  )
}
