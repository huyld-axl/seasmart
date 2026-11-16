import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button, Dropdown } from 'antd'
import HeadActions from '../HeadActions'

vi.mock('../../../hooks/useViewport', () => ({ default: () => ({ isPhone: true }) }))
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Actions({ onClick, onCreate }) {
  return <HeadActions>
    <Dropdown menu={{ items: [
      { key: 'status', label: 'Đổi trạng thái', children: [
        { key: 'status:ACTIVE', label: 'Hoạt động', disabled: true },
        { key: 'status:LAID_UP', label: 'Nằm bờ' },
        { key: 'status:UNDER_CONSTRUCTION', label: 'Đang đóng' },
        { key: 'status:SCRAPPED', label: 'Phá dỡ' },
      ] },
      { key: 'delete', label: 'Xoá tàu' },
    ], onClick }}><Button>Khác</Button></Dropdown>
    <Button onClick={onCreate}>Tạo chuyến tàu mới</Button>
    <Button type="primary">Sửa thông tin</Button>
  </HeadActions>
}

describe('mobile head actions', () => {
  it.each(['Nằm bờ', 'Đang đóng', 'Phá dỡ'])('dispatches nested status action %s in a single menu', async (label) => {
    const onClick = vi.fn()
    render(<Actions onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thao tác khác' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: label }))
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ key: `status:${({ 'Nằm bờ': 'LAID_UP', 'Đang đóng': 'UNDER_CONSTRUCTION', 'Phá dỡ': 'SCRAPPED' })[label]}` }))
  })
  it('preserves current-status disabling and top-level and moved actions', async () => {
    const onClick = vi.fn()
    const onCreate = vi.fn()
    render(<Actions onClick={onClick} onCreate={onCreate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thao tác khác' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hoạt động' }))
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tạo chuyến tàu mới' }))
    expect(onCreate).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Thao tác khác' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Xoá tàu' }))
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'delete' }))
  })
})
