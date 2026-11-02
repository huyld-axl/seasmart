import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ApproveModal from '../ApproveModal'
import { useBillPlan } from '../../../../hooks/useVoyages'

const approve = { mutateAsync: vi.fn(), isPending: false }
vi.mock('../../../../hooks/useVoyages', () => ({ useBillPlan: vi.fn(), useContractMutations: () => ({ approve }) }))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success: vi.fn(), error: vi.fn() }) }))

const contract = { contract: { id: 9, contract_number: 'HĐ-2026-0031' } }
const range = { contract_range: { start: '2026-03-10', end: '2026-10-17' }, bills_range: { start: '2026-03-10', end: '2026-12-31', count: 10 } }
const cutPlan = (over = {}) => ({
  mode: 'CUT', fingerprint: 'fp-1', blocked: [], create: [], ...range,
  cut: [{ bill_id: 8, seq: 8, status: 'OPEN', from: { start: '2026-10-01', end: '2026-10-31' }, to: { start: '2026-10-01', end: '2026-10-17' } }],
  remove: [{ bill_id: 9, seq: 9, status: 'OPEN', start: '2026-11-01', end: '2026-11-30', edited: false }, { bill_id: 10, seq: 10, status: 'OPEN', start: '2026-12-01', end: '2026-12-31', edited: false }],
  ...over,
})
const plan = (data) => useBillPlan.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() })
const show = () => render(<MemoryRouter><ApproveModal contract={contract} open onClose={vi.fn()} /></MemoryRouter>)
const tick = async (seconds) => { for (let i = 0; i < seconds; i += 1) await act(async () => { vi.advanceTimersByTime(1000) }) }

beforeEach(() => {
  vi.useFakeTimers()
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  approve.mutateAsync.mockReset().mockResolvedValue({})
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('duyệt lần đầu hoặc không đổi bill: hộp cũ, không checkbox, bấm được ngay', async () => {
  for (const mode of ['FIRST', 'NONE']) {
    plan({ mode, fingerprint: 'fp', blocked: [], cut: [], remove: [], create: [], contract_range: range.contract_range, bills_range: null })
    const { unmount } = show()
    expect(screen.getByText('Duyệt hợp đồng HĐ-2026-0031?')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Duyệt hợp đồng' })).toBeEnabled()
    unmount()
  }
})

it('duyệt lại đổi bill: bảng thay đổi, ô tích tắt trong 5 giây, nút xác nhận tắt tới khi tích', async () => {
  plan(cutPlan())
  show()
  expect(screen.getByText('Duyệt HĐ-2026-0031: yêu cầu thanh toán sẽ thay đổi')).toBeInTheDocument()
  expect(screen.getByText('Ngày kết thúc 31/12/2026 → 17/10/2026')).toBeInTheDocument()
  expect(screen.getByText('01/10 – 17/10/2026 · tiền giữ đủ tháng')).toBeInTheDocument()
  expect(screen.getAllByText('Xoá mềm')).toHaveLength(2)
  const box = screen.getByRole('checkbox')
  const ok = screen.getByRole('button', { name: 'Xác nhận và duyệt' })
  expect(box).toBeDisabled()
  expect(screen.getByText(/chờ 5 giây/)).toBeInTheDocument()
  expect(ok).toBeDisabled()
  await tick(4)
  expect(box).toBeDisabled()
  await tick(1)
  expect(box).toBeEnabled()
  expect(ok).toBeDisabled()
  fireEvent.click(box)
  expect(ok).toBeEnabled()
  await act(async () => { fireEvent.click(ok) })
  expect(approve.mutateAsync).toHaveBeenCalledWith({ id: 9, expected_fingerprint: 'fp-1' })
})

it('bill bị ảnh hưởng đã gửi hoặc đã thu: banner đỏ liệt kê, không checkbox, nút duyệt tắt', () => {
  plan(cutPlan({ blocked: [{ bill_id: 8, code: 'TT-2026-00305', seq: 8, status: 'SENT' }] }))
  show()
  expect(screen.getByText(/Không duyệt được/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'TT-2026-00305' })).toHaveAttribute('href', '/bills/8')
  expect(screen.getByText(/kỳ 8 \(Đã gửi\)/)).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'Xác nhận và duyệt' })).toBeDisabled()
})

it('bill đã sửa tay trong danh sách xoá thì hộp nêu tên kỳ', () => {
  plan(cutPlan({ remove: [{ bill_id: 9, seq: 9, status: 'OPEN', start: '2026-11-01', end: '2026-11-30', edited: true }] }))
  show()
  expect(screen.getByText('Bill đã sửa tay sẽ mất')).toBeInTheDocument()
  expect(screen.getByText(/kỳ 9 đã được sửa/)).toBeInTheDocument()
})

it('server báo lệch (409) thì tải lại plan và bắt xác nhận lại', async () => {
  const refetch = vi.fn()
  useBillPlan.mockReturnValue({ data: cutPlan(), isLoading: false, isError: false, refetch })
  approve.mutateAsync.mockRejectedValue({ response: { data: { error: 'Yêu cầu thanh toán vừa thay đổi, mở lại hộp duyệt' } } })
  show()
  await tick(5)
  fireEvent.click(screen.getByRole('checkbox'))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Xác nhận và duyệt' })) })
  expect(refetch).toHaveBeenCalled()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Xác nhận và duyệt' })).toBeDisabled()
})
