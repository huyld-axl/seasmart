import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Skeleton } from 'antd'
import { CheckOutlined, CloseCircleOutlined, CloseOutlined, DownOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons'
import SlidePanel from '../../../components/ds/SlidePanel'
import { EmptyState } from '../../../components/ds/Controls'
import { vesselApi } from '../../../api/fleetApi'
import { paperImoState, rankCandidates } from '../exports/packModel'
import '../exports/exports.css'

function Mark({ value }) {
  if (value === null || value === undefined) return null
  if (value === true) return <span className="m m--ok"><CheckOutlined aria-hidden />Khớp</span>
  if (value === 'near') return <span className="m m--near"><QuestionCircleOutlined aria-hidden />Gần giống</span>
  return <span className="m m--no"><CloseOutlined aria-hidden />Khác</span>
}

// B1 Đối chiếu tàu (phương án A): panel trượt mở từ màn Duyệt, ứng viên từ danh mục Tàu, đánh dấu ô khớp.
export default function VesselMatchPanel({ open, paper, context, onClose, onPick }) {
  const imoState = paperImoState(paper.imo)
  const [search, setSearch] = useState(imoState === 'ok' ? paper.imo : paper.name || '')
  const [chosen, setChosen] = useState(null)
  const keyword = search.trim()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vessel-match', keyword],
    queryFn: () => vesselApi.list({ search: keyword, limit: 10 }),
    enabled: open && keyword.length >= 2,
  })
  const candidates = rankCandidates(paper, data?.data || [])
  const current = candidates.find((c) => c.vessel.id === chosen)?.vessel || candidates[0]?.vessel

  let body
  if (imoState === 'invalid') {
    body = (
      <div role="alert" className="ds-banner ds-banner--error">
        <CloseCircleOutlined className="ds-banner__icon" aria-hidden />
        <div className="ds-banner__body">
          <p className="ds-banner__title">IMO trên giấy sai số kiểm tra</p>
          <p className="ds-banner__text">Có thể AI đọc nhầm một chữ số. Sửa IMO ở bản số hoá, hoặc tìm theo tên tàu.</p>
        </div>
      </div>
    )
  }
  let list
  if (keyword.length < 2) list = <p className="vp-hint">Gõ ít nhất 2 ký tự.</p>
  else if (isError) list = <EmptyState isError title="Không tra được danh mục tàu" action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  else if (isLoading) list = <Skeleton active paragraph={{ rows: 3 }} />
  else if (!candidates.length) list = <EmptyState title="Không tìm thấy tàu nào" description={`Danh mục chưa có tàu khớp "${keyword}". Đính bằng chứng thủ công bên dưới.`} />
  else {
    list = (
      <div className="vp" role="radiogroup" aria-label="Ứng viên">
        <p className="vp-count">{candidates.length} ứng viên</p>
        {candidates.map(({ vessel, match }) => (
          <label key={vessel.id} className={current?.id === vessel.id ? 'vp-card vp-card--on' : 'vp-card'}>
            <span className="vp-card__head">
              <input type="radio" name="vessel" checked={current?.id === vessel.id} onChange={() => setChosen(vessel.id)} />
              <span className="ds-cell2">
                <span className="ds-cell2__main">{vessel.vessel_name} <Mark value={match.name} /></span>
                <span className="ds-cell2__sub">
                  IMO {vessel.imo_number || '—'}{vessel.vessel_type_name ? ` · ${vessel.vessel_type_name}` : ''}{vessel.year_built ? ` · đóng ${vessel.year_built}` : ''}
                </span>
              </span>
            </span>
            <span className="vp-card__facts">
              <span>{vessel.gross_tonnage ? `${Number(vessel.gross_tonnage)} GT` : 'GT —'} <Mark value={match.gt} /></span>
              <span>Cờ {vessel.flag_name || '—'} <Mark value={match.flag} /></span>
              <span>{vessel.ship_owner_name || 'Chủ tàu —'} <Mark value={match.owner} /></span>
            </span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <SlidePanel
      open={open}
      title="Đối chiếu tàu"
      description={context}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" disabled={!current} onClick={() => onPick(current)}>Chọn tàu này</Button>
        </>
      }
    >
      <div className="vp">
        <div className="vp-source">
          <p className="vp-source__label">Trên giấy</p>
          <p className="vp-source__value">{[paper.name, paper.gt && `${paper.gt} GT`, paper.flag && `cờ ${paper.flag}`].filter(Boolean).join(' · ')}</p>
          <p className="rv-muted" style={{ margin: '2px 0 0' }}>
            IMO {imoState === 'none' ? 'không có trên giấy' : paper.imo}{imoState === 'invalid' ? ' · sai số kiểm tra' : ''}
          </p>
        </div>
        <Input allowClear prefix={<SearchOutlined />} aria-label="Tìm theo IMO hoặc tên tàu" placeholder="IMO hoặc tên tàu" value={search} onChange={(event) => { setSearch(event.target.value); setChosen(null) }} />
        <p className="vp-hint">Tìm theo IMO trước; tên chỉ để gợi ý.</p>
        {body}
        {list}
        <details className="vp-manual">
          <summary>
            <span><b>Không thấy tàu đúng?</b> <span className="rv-muted">Đính bằng chứng thủ công</span></span>
            <DownOutlined aria-hidden />
          </summary>
          <div className="vp-manual__body">
            <p className="rv-muted" style={{ margin: 0 }}>Thêm tàu vào Danh mục › Tàu rồi tìm lại. Đính ảnh giấy đăng ký tàu sẽ có khi nối backend lưu tệp.</p>
          </div>
        </details>
      </div>
    </SlidePanel>
  )
}
