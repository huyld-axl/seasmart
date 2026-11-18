import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CrewTimeline from '../CrewTimeline'

const rows = (onClick) => [{ id: 'v1', title: 'Nguyễn A', subtitle: 'Thuyền trưởng · CT-1', onClick, bars: [{ kind: 'onboard', start: '2026-10-25', end: '2026-11-05', label: 'Hải Phòng', tip: 'Lên tàu' }] }]
const props = { from: '2026-10-22', to: '2026-11-19', today: '2026-11-05' }

describe('CrewTimeline', () => {
  it('chỉ bấm vào thanh mới mở chuyến, bấm khoảng trống thì không', () => {
    const open = vi.fn()
    const { container } = render(<CrewTimeline {...props} rows={rows(open)} />)
    fireEvent.click(container.querySelector('.ds-ct__row'))
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Hải Phòng' }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('không có hàng vẫn vẽ trục khi keepWhenEmpty', () => {
    const { container } = render(<CrewTimeline {...props} rows={[]} keepWhenEmpty emptyText="Trống" />)
    expect(screen.getByText('Trống')).toBeTruthy()
    expect(container.querySelector('.ds-ct__days')).toBeTruthy()
  })
})
