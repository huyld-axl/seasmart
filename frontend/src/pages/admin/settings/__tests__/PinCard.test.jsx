// Thẻ Mã PIN (Cài đặt trên máy này): PIN theo máy; đổi cần mã hiện tại, sai thì báo số lần còn lại; ẩn khi văn phòng tắt khoá.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from 'antd'
import PinCard from '../PinCard'
import { desktop } from '../../../../lib/desktop'

vi.mock('../../../../lib/desktop', () => ({
  desktop: { lockState: vi.fn(), onLockChanged: vi.fn(() => () => {}), changePin: vi.fn(), logout: vi.fn() },
  bridgeError: (err) => err.message,
}))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success: vi.fn(), error: vi.fn() }) }))

const show = (state) => {
  desktop.lockState.mockResolvedValue(state)
  render(<App><PinCard /></App>)
}
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  desktop.changePin.mockReset()
})
afterEach(cleanup)

it('văn phòng tắt khoá bằng PIN hoặc máy chưa có PIN: không hiện thẻ', async () => {
  show({ required: false, hasPin: false })
  await waitFor(() => expect(desktop.lockState).toHaveBeenCalled())
  expect(screen.queryByText('Mã PIN')).toBeNull()
})

it('đổi mã PIN: sai mã hiện tại thì báo số lần còn lại; đúng thì gửi mã hiện tại và mã mới', async () => {
  show({ required: true, hasPin: true, locked: false })
  fireEvent.click(await screen.findByRole('button', { name: 'Đổi mã PIN' }))
  type('Mã PIN hiện tại', '111111')
  type('Mã PIN mới', '222222')
  type('Nhập lại mã PIN mới', '222222')
  desktop.changePin.mockResolvedValueOnce({ ok: false, left: 3 })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Sai mã PIN hiện tại. Còn 3 lần thử.')).toBeInTheDocument()
  expect(desktop.changePin).toHaveBeenCalledWith('111111', '222222')
})

it('đổi mã PIN: hai lần nhập mã mới không khớp thì không gửi', async () => {
  show({ required: true, hasPin: true, locked: false })
  fireEvent.click(await screen.findByRole('button', { name: 'Đổi mã PIN' }))
  type('Mã PIN hiện tại', '111111')
  type('Mã PIN mới', '222222')
  type('Nhập lại mã PIN mới', '333333')
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Hai lần nhập mã PIN mới không khớp')).toBeInTheDocument()
  expect(desktop.changePin).not.toHaveBeenCalled()
})
