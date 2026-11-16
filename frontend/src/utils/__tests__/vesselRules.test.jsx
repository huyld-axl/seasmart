import { Button, Form, Input } from 'antd'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { vesselRules } from '../fieldRules'
import NumberInput from '../../components/ds/NumberInput'

afterEach(cleanup)

function LoaForm({ onFinish }) {
  return (
    <Form onFinish={onFinish}>
      <Form.Item name="length_overall" label="LOA" rules={vesselRules.positive('LOA', 600, false)}>
        <NumberInput changeOnBlur={false} controls={false} suffix="m" />
      </Form.Item>
      <Button htmlType="submit">Lưu tàu</Button>
    </Form>
  )
}

it('chặn lưu LOA bằng 0, giữ giá trị sai sau blur và cho lưu khi sửa thành số dương', async () => {
  const onFinish = vi.fn()
  render(<LoaForm onFinish={onFinish} />)
  const input = screen.getByRole('spinbutton')
  fireEvent.change(input, { target: { value: '0' } })
  fireEvent.blur(input)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tàu' }))
  expect(await screen.findByText('LOA phải là số dương, không quá 600')).toBeInTheDocument()
  expect(onFinish).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: '120,5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tàu' }))
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ length_overall: 120.5 }))
})

it('cho lưu khi LOA để trống', async () => {
  const onFinish = vi.fn()
  render(<LoaForm onFinish={onFinish} />)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tàu' }))
  await waitFor(() => expect(onFinish).toHaveBeenCalled())
})

it('chặn lưu MMSI toàn số 0 và cho lưu khi người dùng sửa thành 9 chữ số hợp lệ', async () => {
  const onFinish = vi.fn()
  render(
    <Form onFinish={onFinish}>
      <Form.Item name="mmsi" label="MMSI" rules={vesselRules.mmsi}>
        <Input />
      </Form.Item>
      <Button htmlType="submit">Lưu tàu</Button>
    </Form>,
  )
  const input = screen.getByLabelText('MMSI')
  fireEvent.change(input, { target: { value: '000000000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tàu' }))
  expect(await screen.findByText(/MMSI không hợp lệ/)).toBeInTheDocument()
  expect(onFinish).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: '574123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tàu' }))
  await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ mmsi: '574123456' }))
})

it('cho phép lưu tàu khi MMSI để trống', async () => {
  const onFinish = vi.fn()
  render(
    <Form onFinish={onFinish}>
      <Form.Item name="mmsi" label="MMSI" rules={vesselRules.mmsi}><Input /></Form.Item>
      <Button htmlType="submit">Lưu tàu</Button>
    </Form>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tàu' }))
  await waitFor(() => expect(onFinish).toHaveBeenCalled())
})
