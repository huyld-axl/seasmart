import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VoyageFormPage from '../VoyageFormPage'

vi.mock('../../../../hooks/useLeaveGuard', () => ({ default: () => ({ allow: vi.fn() }) }))
vi.mock('../../../../hooks/useVoyages', () => ({ useVoyageMutations: () => ({ create: { mutateAsync: vi.fn() } }) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }) => {
  if (queryKey[0] === 'seafarer-pick') return { data: [
    { id: 1, full_name: 'Có chức danh', current_rank_id: 5 },
    { id: 2, full_name: 'Chưa có chức danh', current_rank_id: null },
  ] }
  if (queryKey[0] === 'lookup' && queryKey[1] === 'ranks') return { data: [{ id: 5, name_vi: 'Thuyền trưởng' }] }
  if (queryKey[0] === 'lookup') return { data: [] }
  return { data: undefined }
} }))
vi.mock('../../fleet/FleetParts', () => ({
  FormFrame: ({ children }) => <div>{children}</div>,
  FormSection: ({ children }) => <div>{children}</div>,
  FleetTile: () => null,
}))
vi.mock('../../../../components/ds/SearchSelect', () => ({ default: ({ id, value, onChange, options, placeholder }) =>
  <select id={id} aria-label={placeholder} value={value ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)}>
    <option value="">Chọn</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>,
}))
vi.mock('../../../../components/ds/DateField', () => ({ default: () => null }))
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('voyage seafarer selection', () => {
  it('clears the previous rank when switching to a person without a rank or clearing the person', async () => {
    render(<MemoryRouter><VoyageFormPage /></MemoryRouter>)
    const person = screen.getByLabelText('Tìm tên, mã thuyền viên')
    const rank = screen.getByLabelText('Chọn chức danh')
    fireEvent.change(person, { target: { value: '1' } })
    await waitFor(() => expect(rank).toHaveValue('5'))
    fireEvent.change(person, { target: { value: '2' } })
    await waitFor(() => expect(rank).toHaveValue(''))
    fireEvent.change(person, { target: { value: '1' } })
    await waitFor(() => expect(rank).toHaveValue('5'))
    fireEvent.change(person, { target: { value: '' } })
    await waitFor(() => expect(rank).toHaveValue(''))
  })
})
