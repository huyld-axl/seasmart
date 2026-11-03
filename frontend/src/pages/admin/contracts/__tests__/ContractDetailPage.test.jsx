import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ContractDetailPage from '../ContractDetailPage'
import { useBillList, useBillPlan, useContract } from '../../../../hooks/useVoyages'

let permissions = []
const mutation = { mutateAsync: vi.fn(), isPending: false }
vi.mock('../../../../hooks/usePermission', () => ({ useCan: () => (...perms) => perms.every((perm) => permissions.includes(perm)) }))
vi.mock('../../../../hooks/useVoyages', () => ({
  useContract: vi.fn(),
  useBillPlan: vi.fn(),
  useBillList: vi.fn(),
  useContractMutations: () => ({ submit: mutation, withdraw: mutation, remove: mutation, revert: mutation, end: mutation, saveNotes: mutation, approve: mutation, reject: mutation }),
}))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

const detail = (over = {}) => ({
  contract: { id: 9, contract_number: 'HĐ-2026-0031', status: 'ACTIVE', start_date: '2026-03-10', end_date: '2026-12-31', months: 9.7, legacy_unlinked: false, notes: null, last_reject_reason: null },
  position: { rank_name: 'Thủy thủ AB', budget_monthly_usd: 1650, budget_total_usd: null, sort_order: null },
  voyage: { id: 4, code: 'CT-2026-0104', vessel_id: 3, vessel_name: 'MV Ocean Pride', ship_owner_name: 'Hải Phong Shipping', join_date: '2026-03-10', leave_date: '2026-10-17' },
  legacy_voyage: null,
  seafarer: { id: 2, full_name: 'Đỗ Văn Nam', seafarer_code: 'TV1', status: 'AVAILABLE' },
  items: [], terms: {}, balance: { budgetMonthly: 1650, receivableMonthly: 0, payableMonthly: 0, diffMonthly: 0, receivableOnce: 0, payableOnce: 0, diffOnce: 0, diffContract: 0, receivableOk: true, payableOk: true, diffOk: true },
  bills_summary: { count: 10, first_start: '2026-03-10', last_end: '2026-12-31', has_sent_or_paid: true },
  awaiting_reapproval: false,
  date_mismatch: null,
  log: [{ id: 1, action: 'APPROVE', actor_name: 'Nguyễn Thu Hà', created_at: '2026-03-10T08:20:00Z' }],
  ...over,
})
const withContract = (over, status = 'ACTIVE') => {
  const base = detail(over)
  return { ...base, contract: { ...base.contract, status, ...(over?.contract || {}) } }
}
const show = (data, plan = null) => {
  useContract.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() })
  useBillPlan.mockReturnValue({ data: plan })
  useBillList.mockReturnValue({ data: { data: [] }, isLoading: false })
  render(<App><MemoryRouter initialEntries={['/contracts/9']}><Routes><Route path="/contracts/:id" element={<ContractDetailPage />} /></Routes></MemoryRouter></App>)
}
const button = (name) => screen.queryByRole('button', { name: new RegExp(name) })

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(cleanup)

it('Hiệu lực: không có Sửa; có Đưa về Nháp và Kết thúc hợp đồng khi đủ quyền', () => {
  permissions = ['contract.view', 'contract.update', 'contract.end']
  show(withContract())
  expect(button('Sửa hợp đồng')).toBeNull()
  expect(button('Đưa về Nháp')).toBeInTheDocument()
  expect(button('Kết thúc hợp đồng')).toBeInTheDocument()
})

it('chỉ có contract.view: không thấy Đưa về Nháp, Kết thúc', () => {
  permissions = ['contract.view']
  show(withContract())
  expect(button('Đưa về Nháp')).toBeNull()
  expect(button('Kết thúc hợp đồng')).toBeNull()
})

it('có contract.update, không có contract.end: thấy Đưa về Nháp, không thấy Kết thúc', () => {
  permissions = ['contract.view', 'contract.update']
  show(withContract())
  expect(button('Đưa về Nháp')).toBeInTheDocument()
  expect(button('Kết thúc hợp đồng')).toBeNull()
})

it('Đã kết thúc: không có nút chuyển trạng thái nào', () => {
  permissions = ['contract.view', 'contract.update', 'contract.end', 'contract.approve', 'contract.submit']
  show(withContract({}, 'ENDED'))
  for (const name of ['Đưa về Nháp', 'Kết thúc hợp đồng', 'Xin duyệt', 'Duyệt', 'Sửa hợp đồng']) expect(button(name)).toBeNull()
  expect(screen.getAllByText('Đã kết thúc').length).toBeGreaterThan(0)
})

it('Chờ duyệt không có contract.approve thì không thấy Duyệt', () => {
  permissions = ['contract.view', 'contract.submit']
  show(withContract({ log: [{ id: 2, action: 'SUBMIT', actor_name: 'A', created_at: '2026-03-10T08:20:00Z' }] }, 'PENDING'))
  expect(button('^Duyệt$')).toBeNull()
  expect(button('Thôi xin duyệt')).toBeInTheDocument()
})

it('Nháp chờ duyệt lại: có nhãn, không có khung hướng dẫn, không có nút Xoá', () => {
  permissions = ['contract.view', 'contract.update', 'contract.submit', 'contract.delete']
  const plan = {
    mode: 'CUT', blocked: [], create: [],
    contract_range: { start: '2026-03-10', end: '2026-10-17' }, bills_range: { start: '2026-03-10', end: '2026-12-31', count: 10 },
    cut: [{ seq: 8, to: { start: '2026-10-01', end: '2026-10-17' } }], remove: [{ seq: 9 }, { seq: 10 }],
  }
  show(withContract({
    awaiting_reapproval: true,
    contract: { end_date: '2026-10-17' },
    log: [{ id: 3, action: 'REVERT', actor_name: 'Nguyễn Thu Hà', created_at: '2026-10-30T02:40:00Z' }],
  }, 'DRAFT'), plan)
  expect(screen.getAllByText('Chờ duyệt lại').length).toBeGreaterThan(0)
  expect(screen.queryByText(/Đưa về Nháp lúc/)).toBeNull()
  expect(button('Thao tác khác')).toBeNull()
  expect(button('Sửa hợp đồng')).toBeInTheDocument()
  expect(button('Xin duyệt')).toBeInTheDocument()
})

it('Nháp chưa từng có bill vẫn có menu Xoá', () => {
  permissions = ['contract.view', 'contract.update', 'contract.submit', 'contract.delete']
  show(withContract({ bills_summary: { count: 0, first_start: null, last_end: null, has_sent_or_paid: false } }, 'DRAFT'))
  expect(button('Thao tác khác')).toBeInTheDocument()
})

it('chuyến đã rời mà hợp đồng còn dài hơn: banner vàng có link mở chuyến', () => {
  permissions = ['contract.view', 'voyage.view']
  show(withContract({ date_mismatch: { leave_date: '2026-10-17', end_date: '2026-12-31' } }))
  expect(screen.getByText('Chuyến CT-2026-0104 đã rời tàu 17/10/2026')).toBeInTheDocument()
  expect(screen.getByText('Hợp đồng còn tới 31/12/2026, bill vẫn sinh tới ngày đó.')).toBeInTheDocument()
  expect(button('Mở chuyến')).toBeInTheDocument()
})

it('hợp đồng cũ chưa gắn chuyến: không có Sửa, Đưa về Nháp; vẫn hiện tàu từ chuyến cũ', () => {
  permissions = ['contract.view', 'contract.update', 'contract.end']
  show(withContract({
    contract: { legacy_unlinked: true },
    voyage: null,
    legacy_voyage: { id: 1, code: 'CT-2026-001', vessel_id: 3, vessel_name: 'MV Ocean Pride', ship_owner_name: 'Hải Phong Shipping' },
  }))
  expect(button('Đưa về Nháp')).toBeNull()
  expect(screen.getAllByText(/CT-2026-001/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/MV Ocean Pride/).length).toBeGreaterThan(0)
})
