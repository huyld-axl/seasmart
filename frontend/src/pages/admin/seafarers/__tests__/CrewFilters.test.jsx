import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CrewFilterFields } from '../CrewFilters'
import { EMPTY_FILTERS } from '../crewFilterState'

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isLoading: false }) }))
vi.mock('../../../../components/ds/SearchSelect', () => ({ default: () => null }))
afterEach(cleanup)

describe('crew age filter', () => {
  // Bộ lọc không kiểm tra: khoảng ngược vẫn áp dụng như người dùng nhập (feedback 92).
  it('applies a reversed range without an error', () => {
    const onChange = vi.fn()
    render(<CrewFilterFields value={{ ...EMPTY_FILTERS, ageMin: 20, ageMax: 40 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Tuổi từ'), { target: { value: '50' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: 50, ageMax: 40 }))
  })
  it('allows equal limits and clearing a limit', () => {
    const onChange = vi.fn()
    render(<CrewFilterFields value={{ ...EMPTY_FILTERS, ageMin: 20, ageMax: 40 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Tuổi đến'), { target: { value: '20' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: 20, ageMax: 20 }))
    fireEvent.change(screen.getByLabelText('Tuổi từ'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: null, ageMax: 40 }))
  })
})
