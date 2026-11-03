import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RemoveModal } from '../VoyageModals'
import { useRemovePreview } from '../../../../hooks/useVoyages'

vi.mock('../../../../hooks/useVoyages', () => ({ useRemovePreview: vi.fn(), useVoyageMutations: () => ({ remove: { mutateAsync: vi.fn(), isPending: false } }) }))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../../../api', () => ({ lookupApi: { ports: async () => ({ data: [] }) } }))

const voyage = { id: 7, code: 'CT-2026-0161', source: 'OPPORTUNITY', seafarer_name: 'Đỗ Văn Nam', opportunity: { id: 3, code: 'CH26051' } }
const show = (preview) => {
  useRemovePreview.mockReturnValue({ data: preview, isLoading: false, isError: false })
  render(<MemoryRouter><RemoveModal voyage={voyage} onClose={vi.fn()} /></MemoryRouter>)
}
beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(cleanup)

it('liệt kê việc sẽ xảy ra, gồm hợp đồng Nháp bị xoá mềm', () => {
  show({ blocked: false, contracts: [{ id: 5, contract_number: 'HĐ-2026-0044', status: 'DRAFT' }] })
  expect(screen.getByText('Chuyến CT-2026-0161 bị xoá khỏi danh sách và hồ sơ.')).toBeInTheDocument()
  expect(screen.getByText('Đỗ Văn Nam về "Ở bờ".')).toBeInTheDocument()
  expect(screen.getByText('Cơ hội CH26051 mở lại, các ứng viên về danh sách như trước khi chốt.')).toBeInTheDocument()
  expect(screen.getByText('Hợp đồng HĐ-2026-0044 (Nháp) bị xoá mềm.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Huỷ chốt' })).toBeEnabled()
})

it('hợp đồng đã hiệu lực: banner đỏ không huỷ được, nút Huỷ chốt tắt', () => {
  show({ blocked: true, message: 'Chuyến có hợp đồng HĐ-2026-0031 đã hiệu lực, không huỷ được', contracts: [] })
  expect(screen.getByText('Không huỷ chốt được')).toBeInTheDocument()
  expect(screen.getByText(/HĐ-2026-0031 đã hiệu lực, không huỷ được\. Hợp đồng đã duyệt không xoá theo chuyến\./)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Huỷ chốt' })).toBeDisabled()
})
