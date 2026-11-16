import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ToastHost from '../ToastHost'
import { clearToasts, toast } from '../useToast'

const mocks = vi.hoisted(() => ({ notification: { open: vi.fn(), destroy: vi.fn() }, phone: true }))
vi.mock('antd', () => ({ App: { useApp: () => ({ notification: mocks.notification }) } }))
vi.mock('../../../hooks/useViewport', () => ({ default: () => ({ isPhone: mocks.phone }) }))
function setup(onClick) {
  let routeChanged
  const router = { state: { location: { pathname: '/bills/1' } }, subscribe: (fn) => { routeChanged = fn; return () => {} } }
  render(<><ToastHost router={router} /><button onClick={onClick}>Mở menu</button><div className="ds-toast"><button>Đóng lỗi</button></div></>)
  return () => routeChanged({ location: { pathname: '/partners' } })
}
beforeEach(() => { mocks.phone = true; vi.clearAllMocks() })
afterEach(() => { clearToasts(); cleanup() })
describe('mobile error toast dismissal', () => {
  it('dismisses a fresh error on the next menu action', () => {
    setup()
    toast.error('Lỗi cũ')
    fireEvent.click(screen.getByText('Mở menu'))
    expect(mocks.notification.destroy).toHaveBeenCalledWith('error:Lỗi cũ:')
  })
  it('keeps a new error raised by the next action', () => {
    setup(() => toast.error('Lỗi mới'))
    toast.error('Lỗi cũ')
    fireEvent.click(screen.getByText('Mở menu'))
    expect(mocks.notification.destroy).toHaveBeenCalledWith('error:Lỗi cũ:')
    expect(mocks.notification.destroy).not.toHaveBeenCalledWith('error:Lỗi mới:')
  })
  it('dismisses even a just-opened error on route changes', () => {
    const changeRoute = setup()
    toast.error('Lỗi chuyển trang')
    changeRoute()
    expect(mocks.notification.destroy).toHaveBeenCalledWith('error:Lỗi chuyển trang:')
  })
  it('dismisses success notices on another action but does not interfere with toast controls', () => {
    setup()
    toast.success('Đã lưu')
    toast.error('Lỗi đang xem')
    fireEvent.click(screen.getByText('Đóng lỗi'))
    expect(mocks.notification.destroy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Mở menu'))
    expect(mocks.notification.destroy).toHaveBeenCalledWith('success:Đã lưu:')
  })
  it.each(['success', 'warning', 'info'])('dismisses old %s notices and keeps the new notice raised by the action', (kind) => {
    setup(() => toast[kind]('Thông báo mới'))
    toast[kind]('Thông báo cũ')
    fireEvent.click(screen.getByText('Mở menu'))
    expect(mocks.notification.destroy).toHaveBeenCalledWith(`${kind}:Thông báo cũ:`)
    expect(mocks.notification.destroy).not.toHaveBeenCalledWith(`${kind}:Thông báo mới:`)
  })
  it('keeps a success toast during automatic navigation immediately after saving', () => {
    const changeRoute = setup()
    toast.success('Đã lưu hồ sơ')
    changeRoute()
    expect(mocks.notification.destroy).not.toHaveBeenCalledWith('success:Đã lưu hồ sơ:')
    fireEvent.click(screen.getByText('Mở menu'))
    expect(mocks.notification.destroy).toHaveBeenCalledWith('success:Đã lưu hồ sơ:')
  })
  it('keeps desktop behavior unchanged', () => {
    mocks.phone = false
    setup()
    toast.error('Lỗi PC')
    fireEvent.click(screen.getByText('Mở menu'))
    expect(mocks.notification.destroy).not.toHaveBeenCalled()
  })
})
