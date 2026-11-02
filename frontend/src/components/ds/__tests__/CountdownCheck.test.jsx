import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import CountdownCheck from '../CountdownCheck'

describe('CountdownCheck', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // Mỗi giây một lần: bộ đếm đặt lại timer sau mỗi lần render.
  const tick = (seconds) => { for (let i = 0; i < seconds; i += 1) act(() => { vi.advanceTimersByTime(1000) }) }

  it('không tích được trước khi hết giờ; hết giờ thì tích được và bỏ chữ đếm', () => {
    const onChange = vi.fn()
    render(<CountdownCheck seconds={5} label="Tôi đã xem" onChange={onChange} />)
    const box = screen.getByRole('checkbox')
    expect(box).toBeDisabled()
    expect(screen.getByText(/chờ 5 giây/)).toBeInTheDocument()
    fireEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
    tick(4)
    expect(box).toBeDisabled()
    expect(screen.getByText(/chờ 1 giây/)).toBeInTheDocument()
    tick(1)
    expect(box).toBeEnabled()
    expect(screen.queryByText(/chờ/)).not.toBeInTheDocument()
    fireEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('đang đếm thì dù checked=true cũng hiện chưa tích', () => {
    render(<CountdownCheck seconds={3} label="Tôi đã xem" checked />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    tick(3)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('resetKey đổi thì đếm lại từ đầu', () => {
    const { rerender } = render(<CountdownCheck seconds={2} label="Tôi đã xem" resetKey={1} />)
    tick(2)
    expect(screen.getByRole('checkbox')).toBeEnabled()
    rerender(<CountdownCheck seconds={2} label="Tôi đã xem" resetKey={2} />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByText(/chờ 2 giây/)).toBeInTheDocument()
  })
})
