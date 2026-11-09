import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StatusTabs } from '../Controls'

// Điện thoại: mọi truy vấn max-width khớp, min-width không. Desktop: ngược lại (hooks/useViewport.js).
function screenAs(phone) {
  window.matchMedia = (query) => ({
    matches: phone === query.includes('max-width'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
}

afterEach(cleanup)

const tabs = [
  { value: 'all', label: 'Tất cả', count: 301 },
  { value: 'OVERDUE', label: 'Quá hạn', count: 2, dot: true },
]

describe('StatusTabs phone="chips"', () => {
  it('điện thoại: hàng chip có số đếm, chip đang chọn bật aria-pressed, bấm là đổi', () => {
    screenAs(true)
    const onChange = vi.fn()
    render(<StatusTabs phone="chips" tabs={tabs} value="all" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /Tất cả/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Quá hạn/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('301')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Quá hạn/ }))
    expect(onChange).toHaveBeenCalledWith('OVERDUE')
  })

  it('desktop: vẫn là tab như cũ, không có chip', () => {
    screenAs(false)
    render(<StatusTabs phone="chips" tabs={tabs} value="all" />)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Quá hạn/ })).not.toBeInTheDocument()
  })

  it('không đặt phone thì điện thoại vẫn là ô chọn (trang chi tiết)', () => {
    screenAs(true)
    const { container } = render(<StatusTabs tabs={tabs} value="all" mobileLabel="Mục:" />)
    expect(container.querySelector('.ds-tabs-select')).not.toBeNull()
    expect(container.querySelector('.ds-tabs-chips')).toBeNull()
  })
})
