import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Button, DatePicker, Input, InputNumber, Pagination, Select, Skeleton, Table, Tooltip } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import SlidePanel from '../../../components/ds/SlidePanel'
import ToggleRow from '../../../components/ds/ToggleRow'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import { lookupApi } from '../../../api'
import { useOpportunityMutations, useOpportunitySuggestions } from '../../../hooks/useOpportunities'
import apiErrorText from '../../../utils/apiError'
import { formatDate } from '../../../utils/format'
import { withFlag } from '../../../utils/flag'
import { candidateTags } from './opportunityView'

const PAGE_SIZE = 20
const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null)
const lookup = (key, fn) => ({ queryKey: ['lookup', key], queryFn: () => fn().then((r) => r.data), staleTime: 300000 })

// Bộ lọc mặc định = đề xuất nhanh: đúng chức danh, rảnh trước ngày xuống, đủ giấy bắt buộc. Còn lại để trống.
const defaultFilters = (opportunity) => ({
  requiredOk: true, rankId: opportunity.rank_id, freeBefore: opportunity.planned_join_date ? dayjs(opportunity.planned_join_date) : null, workedWithOwner: false,
  vesselTypeId: null, nationalityId: null, ageMin: null, ageMax: null,
})

// Số bộ lọc đang bật khác mặc định "không lọc" (để hiện trên nút Bộ lọc ở màn nhỏ).
const activeCount = (f) => [f.requiredOk, f.rankId, f.freeBefore, f.workedWithOwner, f.vesselTypeId, f.nationalityId, f.ageMin != null || f.ageMax != null].filter(Boolean).length

// Một thẻ cảnh báo: chấm + chữ, cam khi cần chú ý. Không thẻ nào chặn chọn. `tip`: chi tiết hiện khi rê chuột hoặc focus.
function Tag({ tag, tip }) {
  if (!tip) return <span className={`op-tag op-tag--${tag.tone}`}>{tag.label}</span>
  return (
    <Tooltip title={tip} placement="topLeft">
      <span className={`op-tag op-tag--${tag.tone} op-tag--tip`} tabIndex={0}>{tag.label}</span>
    </Tooltip>
  )
}

// Side panel thêm ứng viên (Màn 4): cột lọc bên trái, thanh tìm kiếm đứng yên, danh sách cuộn riêng.
export default function CandidatePanel({ opportunity, onClose }) {
  const toast = useToast()
  const { addCandidates } = useOpportunityMutations()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filters, setFilters] = useState(() => defaultFilters(opportunity))
  const [railOpen, setRailOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState([])

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const ranks = useQuery(lookup('ranks', lookupApi.ranks))
  const vesselTypes = useQuery(lookup('vessel-types', lookupApi.vesselTypes))
  const countries = useQuery(lookup('countries', lookupApi.countries))
  const setFilter = (patch) => { setFilters((prev) => ({ ...prev, ...patch })); setPage(1) }

  const params = {
    search: debounced || undefined,
    required_ok: filters.requiredOk ? 1 : undefined,
    rank_id: filters.rankId || undefined,
    free_before: filters.freeBefore ? filters.freeBefore.format('YYYY-MM-DD') : undefined,
    worked_with_owner: filters.workedWithOwner ? 1 : undefined,
    vessel_type_id: filters.vesselTypeId || undefined,
    nationality_id: filters.nationalityId || undefined,
    age_min: filters.ageMin ?? undefined,
    age_max: filters.ageMax ?? undefined,
    page,
    limit: PAGE_SIZE,
  }
  const list = useOpportunitySuggestions(opportunity.id, params)
  const rows = list.data?.data || []
  const scrollRef = useRef(null)

  async function submit() {
    try {
      await addCandidates.mutateAsync({ id: opportunity.id, seafarer_ids: picked, source: activeCount(filters) ? 'SUGGEST' : 'SEARCH' })
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
    body = <div className="op-sug__pad"><Skeleton active title={false} paragraph={{ rows: 6 }} /></div>
  } else if (!rows.length) {
    body = <EmptyState title="Không có ai khớp" description={activeCount(filters) ? 'Thử tắt bớt bộ lọc bên trái, ví dụ "Đủ giấy bắt buộc".' : 'Thử tìm bằng tên, mã thuyền viên hoặc số hộ chiếu.'} />
  } else {
    const columns = [
      {
        title: 'Thuyền viên',
        key: 'person',
        width: 200,
        render: (_, p) => {
          const tags = candidateTags(p, opportunity, formatDate)
          const info = [p.rank_name, age(p.date_of_birth) != null ? `${age(p.date_of_birth)} tuổi` : null].filter(Boolean).join(' · ')
          return (
            <div className="op-sug__cell">
              <b className={p.in_list ? 'op-sug__name op-sug__name--dim' : 'op-sug__name'}>{p.full_name}</b>
              {info ? <span>{info}</span> : null}
              {!p.in_list && tags.position ? <Tag tag={tags.position} /> : null}
            </div>
          )
        },
      },
      {
        title: 'Hiện tại',
        key: 'now',
        width: 220,
        render: (_, p) => {
          const tags = candidateTags(p, opportunity, formatDate)
          return (
            <div className="op-sug__cell">
              {!p.in_list && tags.availability ? <Tag tag={tags.availability} /> : null}
              <span>{tags.onboard}</span>
              {!p.in_list && p.held_by ? <span>Đang giữ cho {p.held_by}</span> : null}
            </div>
          )
        },
      },
      {
        title: 'Hồ sơ yêu cầu',
        key: 'docs',
        width: 230,
        render: (_, p) => {
          if (p.in_list) return <span className="op-sug__muted">Đã trong danh sách</span>
          const tags = candidateTags(p, opportunity, formatDate)
          // Giấy thiếu nằm trong tooltip, bắt buộc trước, mục nên có ghi rõ.
          const tip = tags.issues.length ? (
            <ul className="op-sug__tip">
              {tags.issues.map((i) => <li key={i.text}>{i.required ? i.text : `${i.text} (nên có)`}</li>)}
            </ul>
          ) : null
          return tags.docs.tone === 'none' ? <span className="op-sug__muted">Chưa có yêu cầu</span> : <Tag tag={tags.docs} tip={tip} />
        },
      },
    ]
    body = (
      <Table
        className="op-sug"
        size="middle"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky={{ getContainer: () => scrollRef.current }}
        scroll={{ x: 560 }}
        rowSelection={{ selectedRowKeys: picked, preserveSelectedRowKeys: true, onChange: setPicked, getCheckboxProps: (p) => ({ disabled: p.in_list, 'aria-label': `Chọn ${p.full_name}` }) }}
        rowClassName={(p) => (p.in_list ? 'op-sug__row--dim' : '')}
      />
    )
  }

  return (
    <SlidePanel
      open
      size="xl"
      flush
      hasForm={false}
      title="Thêm ứng viên"
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
      <div className="op-sug__split">
        <aside className={`op-sug__rail${railOpen ? ' op-sug__rail--open' : ''}`} aria-label="Bộ lọc">
          <div className="op-sug__railhead">
            <b>Bộ lọc</b>
            <Button type="text" size="small" onClick={() => { setFilters(defaultFilters(opportunity)); setPage(1) }}>Đặt lại</Button>
          </div>
          <ToggleRow compact label="Đủ giấy bắt buộc" value={filters.requiredOk} onChange={(v) => setFilter({ requiredOk: v })} />
          <ToggleRow compact label="Từng làm cho chủ tàu" value={filters.workedWithOwner} onChange={(v) => setFilter({ workedWithOwner: v })} />
          <label className="op-sug__field">
            <span>Rảnh trước ngày</span>
            <DatePicker allowClear format="DD/MM/YYYY" placeholder="Chọn ngày" value={filters.freeBefore} onChange={(d) => setFilter({ freeBefore: d })} />
          </label>
          <label className="op-sug__field">
            <span>Chức danh hiện tại</span>
            <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="Tất cả" loading={ranks.isLoading} value={filters.rankId} onChange={(v) => setFilter({ rankId: v ?? null })} options={(ranks.data || []).map((r) => ({ value: r.id, label: r.name_vi }))} />
          </label>
          <label className="op-sug__field">
            <span>Đã đi loại tàu</span>
            <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="Tất cả" loading={vesselTypes.isLoading} value={filters.vesselTypeId} onChange={(v) => setFilter({ vesselTypeId: v ?? null })} options={(vesselTypes.data || []).map((t) => ({ value: t.id, label: t.name_vi }))} />
          </label>
          <label className="op-sug__field">
            <span>Quốc tịch</span>
            <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="Tất cả" loading={countries.isLoading} value={filters.nationalityId} onChange={(v) => setFilter({ nationalityId: v ?? null })} options={(countries.data || []).map((c) => ({ value: c.id, label: withFlag(c.code, c.name_vi || c.name_en, c.flag_emoji) }))} />
          </label>
          <div className="op-sug__field">
            <span>Tuổi</span>
            <div className="op-sug__age">
              <InputNumber min={16} max={80} placeholder="Từ" aria-label="Tuổi từ" value={filters.ageMin} onChange={(v) => setFilter({ ageMin: v ?? null })} />
              <span aria-hidden>–</span>
              <InputNumber min={16} max={80} placeholder="Đến" aria-label="Tuổi đến" value={filters.ageMax} onChange={(v) => setFilter({ ageMax: v ?? null })} />
            </div>
          </div>
        </aside>
        <div className="op-sug__main">
          <div className="op-sug__tools">
            <div className="op-sug__searchrow">
              <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm tên, mã thuyền viên, số hộ chiếu" aria-label="Tìm thuyền viên" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button className="op-sug__railbtn" icon={<FilterOutlined />} aria-expanded={railOpen} onClick={() => setRailOpen((v) => !v)}>Bộ lọc{activeCount(filters) ? ` · ${activeCount(filters)}` : ''}</Button>
            </div>
            <div className="op-sug__bar">
              <span className="op-sug__hint">
                {list.data ? `${list.data.total} người khớp, xếp theo mức hợp` : ' '}
                {list.data?.capped ? ' · đã chạm giới hạn 500 người, lọc thêm để chắc không sót' : ''}
              </span>
            </div>
          </div>
          <div className="op-sug__scroll" ref={scrollRef}>
            {body}
            {list.data && list.data.total > PAGE_SIZE ? (
              <div className="op-sug__pad">
                <Pagination size="small" align="center" current={page} pageSize={PAGE_SIZE} total={list.data.total} onChange={setPage} showSizeChanger={false} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}
