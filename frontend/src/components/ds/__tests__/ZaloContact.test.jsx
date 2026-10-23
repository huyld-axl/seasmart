import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Form } from 'antd'
import { PhoneActions, QuickContact } from '../ContactActions'
import ZaloInput from '../ZaloInput'

beforeAll(() => {
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(cleanup)

it('số điện thoại không tự tạo nút Zalo', () => {
  render(<><PhoneActions phone="0901000000" /><QuickContact phone="0901000000" /></>)
  expect(screen.queryByRole('link', { name: /Zalo/ })).toBeNull()
  expect(screen.getAllByRole('link', { name: /Gọi/ })).toHaveLength(2)
})

it('liên hệ nhanh dùng số Zalo riêng', () => {
  render(<QuickContact phone="0901000000" zalo="0902000000" />)
  expect(screen.getByRole('link', { name: /Zalo/ })).toHaveAttribute('href', 'https://zalo.me/0902000000')
})

it('form chỉ dùng số điện thoại cho Zalo khi người dùng chọn', () => {
  render(<Form initialValues={{ phone: '0901000000' }}><Form.Item name="phone"><input aria-label="Điện thoại" /></Form.Item><Form.Item name="zalo"><ZaloInput phoneName="phone" /></Form.Item></Form>)
  const zalo = screen.getByPlaceholderText('Số đăng ký Zalo hoặc link kết bạn')
  expect(zalo).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Dùng số điện thoại này cho Zalo' }))
  expect(zalo).toHaveValue('0901000000')
  fireEvent.change(zalo, { target: { value: '0902000000' } })
  expect(screen.getByRole('textbox', { name: 'Điện thoại' })).toHaveValue('0901000000')
  expect(zalo).toHaveValue('0902000000')
})
