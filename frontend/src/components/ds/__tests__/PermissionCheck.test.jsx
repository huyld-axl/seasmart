import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PermissionCheck from '../PermissionCheck'

describe('PermissionCheck', () => {
  it('aria-checked theo ba trạng thái true | false | mixed', () => {
    const { rerender } = render(<PermissionCheck label="Xem" checked={false} />)
    expect(screen.getByRole('checkbox', { name: 'Xem' })).toHaveAttribute('aria-checked', 'false')
    rerender(<PermissionCheck label="Xem" checked />)
    expect(screen.getByRole('checkbox', { name: 'Xem' })).toHaveAttribute('aria-checked', 'true')
    rerender(<PermissionCheck label="Xem" checked="mixed" />)
    expect(screen.getByRole('checkbox', { name: 'Xem' })).toHaveAttribute('aria-checked', 'mixed')
  })

  it('bấm: chưa tích hoặc một phần thì thành tích, đang tích thì bỏ', () => {
    const onChange = vi.fn()
    const { rerender } = render(<PermissionCheck label="Sửa" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenLastCalledWith(true)
    rerender(<PermissionCheck label="Sửa" checked="mixed" onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenLastCalledWith(true)
    rerender(<PermissionCheck label="Sửa" checked onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('disabled không gọi onChange; changed thêm vòng nhấn', () => {
    const onChange = vi.fn()
    render(<PermissionCheck label="Xoá" checked disabled changed onChange={onChange} />)
    const box = screen.getByRole('checkbox')
    fireEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
    expect(box).toBeDisabled()
    expect(box).toHaveClass('is-changed')
  })
})
