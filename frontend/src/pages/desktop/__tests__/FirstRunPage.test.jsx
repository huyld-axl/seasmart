// Lần đầu đăng nhập khi văn phòng do Axalize tạo sẵn (docs/mcah-ke-hoach-tai-khoan-tu-tren-xuong.md 3.5, wireframe 7, 8):
// quản trị cài máy chính, nhân viên chờ máy chính, tài khoản chưa thuộc văn phòng; không còn tạo văn phòng trong app.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FirstRunPage from '../FirstRunPage'
import { desktop } from '../../../lib/desktop'

vi.mock('../../../lib/desktop', () => ({
  desktop: { session: vi.fn(), setupMainMachine: vi.fn(), recheckOffice: vi.fn(), logout: vi.fn() },
  bridgeError: (err) => err.message,
  isDesktop: () => true,
}))
vi.mock('../PairPanel', () => ({ default: () => <div>Nối máy chính</div> }))

const account = (extra) => ({ name: 'Nguyễn An', email: 'an@namhai.vn', office: 'off-1', office_name: 'Nam Hải Crew', office_role: 'admin', office_has_machine: false, ...extra })
const open = (acc) => {
  desktop.session.mockResolvedValue({ loggedIn: false, needsOffice: true, account: acc })
  render(<MemoryRouter><FirstRunPage /></MemoryRouter>)
}

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  desktop.setupMainMachine.mockReset()
  desktop.recheckOffice.mockReset()
})
afterEach(cleanup)

it('quản trị, văn phòng chưa có máy chính: cài máy này; lỗi máy chủ hiện nguyên câu; không còn ô tạo văn phòng', async () => {
  desktop.setupMainMachine.mockRejectedValue(new Error('Không kết nối được máy chủ MCAH. Kiểm tra internet rồi bấm Thử lại.'))
  open(account())
  expect(await screen.findByText('Cài máy chính cho Nam Hải Crew')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Dùng máy này làm máy chính' }))
  expect(await screen.findByText('Không kết nối được máy chủ MCAH. Kiểm tra internet rồi bấm Thử lại.')).toBeInTheDocument()
  expect(desktop.setupMainMachine).toHaveBeenCalledTimes(1)
})

it('nhân viên, văn phòng chưa có máy chính: chờ; Thử lại khi đã có máy chính thì sang nối máy chính', async () => {
  desktop.recheckOffice.mockResolvedValue({ needsOffice: true, account: account({ office_role: 'member', office_has_machine: true }) })
  open(account({ office_role: 'member' }))
  expect(await screen.findByText('Văn phòng chưa có máy chính')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Nối máy chính')).toBeInTheDocument()
})

it('tài khoản chưa thuộc văn phòng nào: hỏi quản trị văn phòng', async () => {
  open(account({ office: null, office_name: null, office_role: null }))
  expect(await screen.findByText('Tài khoản chưa thuộc văn phòng nào')).toBeInTheDocument()
})
