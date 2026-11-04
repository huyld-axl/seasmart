import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { attentionTabs, certificateRow, defaultTab, monthBars, opportunityRow, scheduleRow, usdShort, workRow } from '../attentionRows'
import AttentionCard from '../AttentionCard'
import { ContractCard, RevenueCard } from '../KpiCards'

describe('attentionRows', () => {
  it('cơ hội: chức danh ngắn · tàu; hạn chốt dd/mm · trạng thái · chủ tàu', () => {
    const r = opportunityRow({ id: 3, rank_name: 'Đại phó (Chief Officer)', vessel_name: null, ship_owner_name: 'Lotus', deadline: '2026-10-31', display_status: 'WAITING', days: 4, late: true })
    expect(r).toMatchObject({ main: 'Đại phó · Chưa rõ tàu', sub: 'Hạn chốt 31/10 · Chờ kết quả · Lotus', late: true, to: '/opportunities/3' })
  })
  it('chứng chỉ: đang trên / sắp lên / ở bờ; mở tab Giấy tờ', () => {
    const base = { id: 1, seafarer_id: 9, seafarer_name: 'Long', certificate_name: 'Hộ chiếu', expiry_date: '2026-10-29', rank_name: 'AB', days: 6, late: true }
    expect(certificateRow({ ...base, trip: { where: 'ONBOARD', vessel_name: 'MV A' } }).sub).toBe('Hết hạn 29/10 · đang trên MV A · AB')
    expect(certificateRow({ ...base, trip: { where: 'UPCOMING', vessel_name: 'MV B' } }).sub).toContain('sắp lên MV B')
    expect(certificateRow({ ...base, trip: null }).sub).toContain('ở bờ')
    expect(certificateRow(base).to).toBe('/seafarers/9?tab=docs')
  })
  it('xuống / rời tàu: quá ngày rời ghi "chưa ghi rời tàu"', () => {
    expect(scheduleRow({ voyage_id: 2, kind: 'LEAVE', seafarer_name: 'An', rank_name: 'Motorman', vessel_name: 'MV H', date: '2026-10-28', late: true, days: 7 }).sub).toBe('Rời tàu dự kiến 28/10 · MV H · chưa ghi rời tàu')
    expect(scheduleRow({ voyage_id: 2, kind: 'JOIN', seafarer_name: 'An', vessel_name: 'MV H', date: '2026-11-10', port_name: 'Singapore', days: 6 }).sub).toBe('Xuống tàu 10/11 · MV H · Singapore')
  })
  it('việc chờ: chữ theo màn quản lý / môi giới, "n việc"', () => {
    expect(workRow(true)({ key: 'CONTRACT_REJECTED', n: 1, late: true, link: '/contracts?tab=REJECTED' })).toMatchObject({ main: 'Hợp đồng bị từ chối, cần sửa', text: '1 việc', late: true })
    expect(workRow(false)({ key: 'BILL_OVERDUE', n: 2, amount_usd: 18400, late: true }).sub).toBe('18.400 USD chưa về')
  })
  it('tab: chỉ tab API trả về; mở sẵn tab đầu có quá hạn', () => {
    const tabs = attentionTabs({ opportunities: { count: 1, late: 0, rows: [] }, certificates: { count: 2, late: 1, rows: [] }, work: { error: true } }, false)
    expect(tabs.map((t) => t.key)).toEqual(['opportunities', 'certificates', 'work'])
    expect(tabs[2]).toMatchObject({ label: 'Chờ xử lý', error: true })
    expect(defaultTab(tabs)).toBe('certificates')
    expect(defaultTab(attentionTabs({ schedule: { count: 0, late: 0, rows: [] } }, true))).toBe('schedule')
  })
  it('nhãn tháng và USD gọn', () => {
    expect(monthBars([{ month: '2026-10', value: 1 }, { month: '2026-11', value: 2 }], true).map((b) => b.label)).toEqual(['T10', 'Tháng này'])
    expect(usdShort(26900)).toBe('26,9k')
  })
})

// jsdom không có matchMedia: coi như màn hẹp (danh sách 5 dòng, không đo khung).
window.matchMedia = window.matchMedia || ((query) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))

const ok = (data) => ({ isLoading: false, isError: false, data, refetch: vi.fn() })
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('AttentionCard', () => {
  const data = {
    tabs: {
      opportunities: { count: 1, late: 0, rows: [{ id: 1, rank_name: 'Bếp', vessel_name: 'MV M', deadline: '2026-11-06', display_status: 'NEW', days: 2, late: false }] },
      certificates: { count: 1, late: 1, rows: [{ id: 5, seafarer_id: 9, seafarer_name: 'Long', certificate_name: 'Hộ chiếu', expiry_date: '2026-10-29', days: 6, late: true, trip: null }] },
      work: { error: true },
    },
  }
  it('mở sẵn tab Chứng chỉ (có quá hạn), dòng quá hạn đỏ, tab có chấm đỏ', () => {
    const { container } = wrap(<AttentionCard query={ok(data)} own={false} />)
    expect(screen.getByRole('tab', { name: /Chứng chỉ/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Quá 6 ngày')).toHaveClass('ds-due--late')
    expect(container.querySelectorAll('.ds-tabs-boxed__dot')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Mở Thuyền viên/ })).toHaveAttribute('href', '/seafarers')
  })
  it('đổi tab; tab lỗi báo lỗi riêng', () => {
    wrap(<AttentionCard query={ok(data)} own={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Hạn chốt cơ hội/ }))
    expect(screen.getByText('Còn 2 ngày')).not.toHaveClass('ds-due--late')
    fireEvent.click(screen.getByRole('tab', { name: /Chờ xử lý/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được chờ xử lý')
  })
})

describe('thẻ KPI', () => {
  const months = (vals, projected) => vals.map((value, i) => ({ month: `2026-${String(6 + i).padStart(2, '0')}`, value, ...(projected && i === vals.length - 1 ? { projected: true } : {}) }))
  const base = {
    day: 4, days_in_month: 30,
    revenue: { months: months([1, 2, 3, 4, 5, 26900], true), to_date: 3590, target: 28000, label: { kind: 'SHORT', short: 1100 } },
    contracts: { months: months([1, 2, 3, 4, 5, 3]), done: 3, target: 10, pace: 1.33, label: 'ON_TRACK' },
  }
  it('doanh thu: số dự kiến, nhãn Thiếu, đã ghi nhận tới hôm nay', () => {
    wrap(<RevenueCard query={ok(base)} />)
    expect(screen.getByText('26.900')).toBeInTheDocument()
    expect(screen.getByText('Thiếu 1.100 USD')).toBeInTheDocument()
    expect(screen.getByText(/đã ghi nhận 3.590 USD/)).toBeInTheDocument()
  })
  it('hợp đồng (quản lý): người chậm tô đỏ', () => {
    const people = [{ user_id: 1, name: 'Đỗ Minh Quân', done: 0, target: 2, pace: 0.27, label: 'BEHIND' }, { user_id: 2, name: 'Nguyễn Thị Lan', done: 1, target: 3, pace: 0.4, label: 'ON_TRACK' }]
    const { container } = wrap(<ContractCard query={ok({ ...base, people })} />)
    expect(within(container.querySelector('.dash-person--behind')).getByText('Đỗ Minh Quân')).toBeInTheDocument()
    expect(container.querySelectorAll('.dash-person--behind')).toHaveLength(1)
    expect(screen.getByText('Đúng tiến độ')).toBeInTheDocument()
  })
  it('hợp đồng (môi giới): phần sắp vào; chưa đặt mục tiêu thì không có thanh', () => {
    const own = { ...base, contracts: { ...base.contracts, done: 1, target: 3, pace: 0.4, pending: { pending: 1, draft: 1, owner_selected: 1 } } }
    wrap(<ContractCard query={ok(own)} own />)
    expect(screen.getByText(/\+3 sắp vào \(1 chờ duyệt, 1 nháp, 1 chủ tàu đã chọn\)/)).toBeInTheDocument()
    const none = { ...base, contracts: { ...base.contracts, target: null, pace: null, label: null, pending: { pending: 0, draft: 0, owner_selected: 0 } } }
    const { container } = wrap(<ContractCard query={ok(none)} own />)
    expect(container.querySelector('.ds-meter')).toBeNull()
    expect(screen.getByText('Chưa đặt mục tiêu tháng')).toBeInTheDocument()
  })
})
