import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
it('hiển thị tàu sở hữu ở chế độ chỉ xem', async () => {
  show()
  await screen.findAllByText('Current Ship')
  expect(screen.getAllByText('Former Ship')).toHaveLength(2)
  expect(screen.getByText('New owner')).toBeInTheDocument()
  expect(screen.queryByRole('switch')).toBeNull()
  expect(screen.getByText('Đã kết thúc sở hữu')).toBeInTheDocument()
  expect(screen.getAllByText('Đang sở hữu').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thêm tàu' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Thuyền viên trên/ })).toBeNull()
  expect(shipOwnerApi.vesselCrew).not.toHaveBeenCalled()
})
