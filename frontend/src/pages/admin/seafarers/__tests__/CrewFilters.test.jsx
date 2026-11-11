import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CrewFilterFields } from '../CrewFilters.jsx'
import { EMPTY_FILTERS } from '../crewFilters'

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isLoading: false }) }))
vi.mock('../../../../components/ds/SearchSelect', () => ({ default: () => null }))
afterEach(cleanup)

describe('crew age filter', () => {
  it('shows an error and does not apply a reversed range, then accepts a correction', () => {
    const onChange = vi.fn()
    render(<CrewFilterFields value={{ ...EMPTY_FILTERS, ageMin: 20, ageMax: 40 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Tuổi từ'), { target: { value: '50' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Tuổi bắt đầu không được lớn hơn tuổi kết thúc.')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Tuổi đến'), { target: { value: '60' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: 50, ageMax: 60 }))
  })
  it('allows equal limits and clearing a limit', () => {
    const onChange = vi.fn()
    render(<CrewFilterFields value={{ ...EMPTY_FILTERS, ageMin: 20, ageMax: 40 }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Tuổi đến'), { target: { value: '20' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: 20, ageMax: 20 }))
    fireEvent.change(screen.getByLabelText('Tuổi từ'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ ageMin: null, ageMax: 20 }))
  })
})
