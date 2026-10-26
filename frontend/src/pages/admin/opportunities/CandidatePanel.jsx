import { useEffect, useState } from 'react'
import { Button, Checkbox, Input, Pagination, Skeleton } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import SlidePanel from '../../../components/ds/SlidePanel'
import RequirementFit from '../../../components/ds/RequirementFit'
import { EmptyState, FilterChips, ListRow } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { useOpportunityMutations, useOpportunitySuggestions } from '../../../hooks/useOpportunities'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'

const PAGE_SIZE = 20
const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null)

// Bảng trượt đề xuất / thêm ứng viên (Màn 4). mode 'suggest' bật sẵn ba bộ lọc theo hồ sơ yêu cầu; 'search' tắt hết.
export default function CandidatePanel({ opportunity, mode, onClose }) {
  const toast = useToast()
  const { addCandidates } = useOpportunityMutations()
  const suggest = mode === 'suggest'
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [chips, setChips] = useState(suggest ? ['required_ok', 'rank', 'free'] : [])
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState([])

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const chipList = [
    { value: 'required_ok', label: 'Đủ mục bắt buộc' },
    { value: 'rank', label: `Chức danh: ${opportunity.rank_name}` },
    { value: 'free', label: `Rảnh trước ${formatDate(opportunity.planned_join_date)}` },
    { value: 'owner', label: `Đã làm cho ${opportunity.ship_owner_name}` },
  ]
  const params = {
    search: debounced || undefined,
    required_ok: chips.includes('required_ok') ? 1 : undefined,
    rank_id: chips.includes('rank') ? opportunity.rank_id : undefined,
    free_before: chips.includes('free') ? String(opportunity.planned_join_date).slice(0, 10) : undefined,
    worked_with_owner: chips.includes('owner') ? 1 : undefined,
    page,
    limit: PAGE_SIZE,
  }
  const list = useOpportunitySuggestions(opportunity.id, params)
  const rows = list.data?.data || []
  const toggleChip = (value) => { setChips((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value])); setPage(1) }
  const togglePick = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))

  async function submit() {
    try {
      await addCandidates.mutateAsync({ id: opportunity.id, seafarer_ids: picked, source: suggest ? 'SUGGEST' : 'SEARCH' })
      toast.success(`Đã thêm ${picked.length} ứng viên vào ${opportunity.code}`)
      onClose()
    } catch (error) {
      toast.error('Không thêm được ứng viên', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  let body
  if (list.isError) {
    body = <EmptyState isError title="Không tải được danh sách" description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (list.isLoading) {
    body = <Skeleton active title={false} paragraph={{ rows: 6 }} />
  } else if (!rows.length) {
    body = <EmptyState title="Không có ai khớp" description={chips.length ? 'Thử tắt bớt bộ lọc, ví dụ "Đủ mục bắt buộc".' : 'Thử tìm bằng tên, mã thuyền viên hoặc số hộ chiếu.'} />
  } else {
    body = (
      <ul className="op-sug">
        {rows.map((p) => {
          const dim = p.in_list || p.held_by
          const meta = [
            p.rank_name,
            age(p.date_of_birth) != null ? `${age(p.date_of_birth)} tuổi` : null,
            p.onboard_voyage_id ? `trên ${p.onboard_vessel_name}, rời dự kiến ${formatDate(p.onboard_until)}` : 'Ở bờ',
          ].filter(Boolean).join(' · ')
          return (
            <ListRow
              key={p.id}
              leading={<Checkbox checked={picked.includes(p.id)} disabled={p.in_list} onChange={() => togglePick(p.id)} aria-label={`Chọn ${p.full_name}`} />}
              title={
                <span className={dim ? 'op-sug__name op-sug__name--dim' : 'op-sug__name'}>
                  {p.full_name}
                  {p.in_list ? <span className="op-sug__note">Đã trong danh sách</span> : null}
                  {!p.in_list && p.held_by ? <span className="op-sug__note">Đang giữ cho {p.held_by}</span> : null}
                </span>
              }
              meta={
                <>
                  <span>{meta}</span>
                  {p.reasons.length ? (
                    <span className="op-sug__why">
                      {p.reasons.slice(0, 3).map((r) => <span key={r.text} className={`op-why op-why--${r.tone}`}>{r.text}</span>)}
                    </span>
                  ) : null}
                </>
              }
              trailing={<RequirementFit fit={p.fit} short />}
            />
          )
        })}
      </ul>
    )
  }

  return (
    <SlidePanel
      open
      size="wide"
      hasForm={false}
      title={suggest ? `Đề xuất ứng viên · ${opportunity.rank_name} · ${opportunity.vessel_name || 'Chưa rõ tàu'}` : 'Thêm ứng viên'}
      description={`Rảnh trước ${formatDate(opportunity.planned_join_date)}, đối chiếu ${opportunity.requirements.filter((r) => r.kind !== 'TEMPLATE').length} yêu cầu.`}
      onClose={onClose}
      footer={
        <>
          <span className="op-sug__count">Đã tích {picked.length} người</span>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" disabled={!picked.length} loading={addCandidates.isPending} onClick={submit}>
            {picked.length ? `Thêm ${picked.length} ứng viên` : 'Thêm ứng viên'}
          </Button>
        </>
      }
    >
      <div className="op-sug__tools">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm tên, mã thuyền viên, số hộ chiếu" aria-label="Tìm thuyền viên" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FilterChips chips={chipList} selected={chips} onToggle={toggleChip} />
        <p className="op-sug__hint">
          {list.data ? `${list.data.total} người khớp · xếp theo mức hợp: đủ bắt buộc, rồi số mục nên có, rồi ngày rảnh gần ngày xuống` : ' '}
          {list.data?.capped ? ' · đã chạm giới hạn 500 người, lọc thêm để chắc không sót' : ''}
        </p>
      </div>
      {body}
      {list.data && list.data.total > PAGE_SIZE ? (
        <Pagination size="small" align="center" current={page} pageSize={PAGE_SIZE} total={list.data.total} onChange={setPage} showSizeChanger={false} />
      ) : null}
    </SlidePanel>
  )
}
