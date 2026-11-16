import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BillFormPage from '../BillFormPage'

const { save } = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue({}) }))
vi.mock('../../../../hooks/useLeaveGuard', () => ({ default: () => ({ allow() {} }) }))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success() {}, error() {} }) }))
vi.mock('../BillMoneyTable', () => ({ default: () => null }))
vi.mock('../../../../hooks/useVoyages', () => ({
  useBillMutations: () => ({ save: { mutateAsync: save, isPending: false } }),
  useBill: () => ({
    data: {
      bill: {
        id: 1, code: 'TT-1', status: 'OPEN', seq: 1, periods: 1,
        due_date: '2026-02-28', period_start: '2026-02-01', period_end: '2026-02-28',
        vessel: { id: 1, vessel_name: 'Tàu kiểm thử' }, contract: { id: 1, contract_number: 'HĐ-1' },
        ship_owner: { company_name: 'Đối tác' }, seafarer: { full_name: 'Nguyễn An' },
      },
      items: [{ id: 1, kind: 'MONTHLY', name: 'Lương', amount_usd: 100 }],
    },
  }),
}))

function viewport(phone) {
  window.matchMedia = (query) => ({ matches: phone && query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
}

beforeEach(() => {
  save.mockClear()
  viewport(false)
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function openForm() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><BillFormPage /></MemoryRouter></QueryClientProvider>)
}

it('hiện lỗi ngày không tồn tại sau blur, giữ chữ đã nhập và chặn lưu dù ghi chú đã thay đổi', async () => {
  openForm()
  fireEvent.change(screen.getByPlaceholderText('Ghi chú nội bộ, không in lên bill'), { target: { value: 'Ghi chú mới' } })
  const input = screen.getByPlaceholderText('dd/mm/yyyy')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '31/02/2026' } })
  fireEvent.blur(input)
  expect(await screen.findByText('Ngày không hợp lệ. Nhập theo định dạng DD/MM/YYYY.')).toBeInTheDocument()
  expect(input).toHaveValue('31/02/2026')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await waitFor(() => expect(screen.getByText('Ngày không hợp lệ. Nhập theo định dạng DD/MM/YYYY.')).toBeInTheDocument())
  expect(save).not.toHaveBeenCalled()
})

it('hiện lỗi bắt buộc ngay sau khi xoá trắng rồi rời ô', async () => {
  openForm()
  fireEvent.change(screen.getByPlaceholderText('Ghi chú nội bộ, không in lên bill'), { target: { value: 'Ghi chú mới' } })
  const input = screen.getByPlaceholderText('dd/mm/yyyy')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '' } })
  fireEvent.blur(input)
  expect(await screen.findByText('Hạn thanh toán là trường bắt buộc.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(save).not.toHaveBeenCalled()
})

it('báo lỗi khi nhập ngày trước đầu kỳ dù DatePicker giữ giá trị cũ', async () => {
  openForm()
  const input = screen.getByPlaceholderText('dd/mm/yyyy')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '31/01/2026' } })
  fireEvent.blur(input)
  expect(await screen.findByText('Hạn thanh toán không được trước 01/02/2026.')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
})

it('cho phép sửa lại ngày hợp lệ và lưu đúng ngày mới', async () => {
  openForm()
  const input = screen.getByPlaceholderText('dd/mm/yyyy')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '31/02/2026' } })
  fireEvent.blur(input)
  await screen.findByText('Ngày không hợp lệ. Nhập theo định dạng DD/MM/YYYY.')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: '01/03/2026' } })
  fireEvent.blur(input)
  await waitFor(() => expect(screen.queryByText('Ngày không hợp lệ. Nhập theo định dạng DD/MM/YYYY.')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, due_date: '2026-03-01' })))
})

it('điện thoại: xoá ngày bằng nút xoá phải hiện lỗi bắt buộc và chặn lưu', async () => {
  viewport(true)
  const { container } = openForm()
  fireEvent.click(screen.getByRole('button', { name: 'Xoá ngày' }))
  fireEvent.blur(container.querySelector('input[type="date"]'))
  expect(await screen.findByText('Hạn thanh toán là trường bắt buộc.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(save).not.toHaveBeenCalled()
})
