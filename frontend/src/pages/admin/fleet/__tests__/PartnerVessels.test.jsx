import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import PartnerVessels from '../PartnerVessels'
import { shipOwnerApi } from '../../../../api/fleetApi'
const { permission } = vi.hoisted(() => ({ permission: vi.fn(() => true) }))
vi.mock('../../../../hooks/usePermission', () => ({ useCan: () => permission }))
vi.mock('../../../../api/fleetApi', () => ({ shipOwnerApi: { vessels: vi.fn(), vesselCrew: vi.fn(), linkVessel: vi.fn() }, vesselApi: { list: vi.fn() } }))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success: vi.fn(), error: vi.fn() }) }))
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><PartnerVessels owner={{ id: 9, company_name: 'Lotus', is_active: 1 }} /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  permission.mockImplementation(() => true)
  shipOwnerApi.vessels.mockResolvedValue({ data: [
    { id: 1, vessel_name: 'Current Ship', is_current: true, status: 'ACTIVE' },
    { id: 2, vessel_name: 'Former Ship', is_current: false, ended_at: '2026-10-01', current_owner_name: 'New owner' },
  ] })
  shipOwnerApi.vesselCrew.mockResolvedValue({ data: [{ id: 3, full_name: 'Nguyễn An', sign_on_date: '2026-10-01', rank_name: 'Thuyền trưởng' }] })
})
afterEach(cleanup)
it('tách tàu hiện tại và tàu đã đổi chủ', async () => {
  show()
  await screen.findAllByText('Current Ship')
  expect(screen.getByRole('heading', { name: 'Danh sách tàu sở hữu' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Thêm tàu liên kết' })).toHaveClass('ant-btn-primary')
  const row = screen.getAllByRole('link', { name: 'Current Ship' })[0].closest('tr')
  expect(row.cells[0].querySelector('button')).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Former Ship')).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'Đã đổi chủ' }))
  await screen.findAllByText('Former Ship')
  expect(screen.queryByText('Current Ship')).toBeNull()
  expect(screen.getByText('New owner')).toBeInTheDocument()
})
it('chỉ tải danh sách thuyền viên sau khi mở rộng tàu', async () => {
  show()
  await screen.findAllByText('Current Ship')
  expect(shipOwnerApi.vesselCrew).not.toHaveBeenCalled()
  fireEvent.click(screen.getAllByRole('button', { name: 'Thuyền viên trên Current Ship' })[0])
  await screen.findAllByText('Nguyễn An')
  expect(shipOwnerApi.vesselCrew).toHaveBeenCalledWith(9, 1)
})
it('ẩn thêm tàu và thuyền viên nếu thiếu quyền', async () => {
  permission.mockImplementation((...perms) => perms.every((perm) => ['vessel.view', 'partner.view'].includes(perm)))
  show()
  await screen.findAllByText('Current Ship')
  expect(screen.queryByRole('button', { name: 'Thêm tàu liên kết' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thuyền viên trên Current Ship' })).toBeNull()
  await waitFor(() => expect(shipOwnerApi.vesselCrew).not.toHaveBeenCalled())
})
