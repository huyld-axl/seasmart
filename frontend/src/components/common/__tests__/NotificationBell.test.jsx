import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import NotificationBell from '../NotificationBell'

const navigate = vi.fn()
const mutate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../../../hooks/useViewport', () => ({ default: () => ({ isCompact: true }) }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'notifications-unread-count' ? 1 : [{ id: 1, title: 'Thông báo kiểm thử', body: 'Nội dung', ref_id: 7, type: 'CERT_EXPIRY', created_at: '2026-11-11', is_read: false }], isLoading: false }),
  useMutation: () => ({ mutate }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('mobile notifications', () => {
  it('opens a compact dropdown, locks the background and restores it on close', async () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
    const panel = await screen.findByRole('region', { name: 'Danh sách thông báo' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(panel.lastElementChild).toHaveStyle({ overflowX: 'hidden', overflowY: 'auto', overscrollBehaviorY: 'contain' })
    expect(document.body.style.position).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
    const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    document.body.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument())
    expect(document.body.style.position).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
    const after = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    document.body.dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
    expect(screen.getByRole('button', { name: 'Thông báo' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('marks a notification read and closes the panel before navigating', async () => {
    render(<NotificationBell />)
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
    fireEvent.click(await screen.findByText('Thông báo kiểm thử'))
    expect(mutate).toHaveBeenCalledWith(1)
    expect(navigate).toHaveBeenCalledWith('/seafarers/7')
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument())
  })
})
