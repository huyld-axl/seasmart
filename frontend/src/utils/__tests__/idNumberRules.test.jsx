import { Button, Form, Input } from 'antd'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { fieldRules } from '../fieldRules'

afterEach(cleanup)

function IdForm({ onFinish }) {
  return (
    <Form onFinish={onFinish}>
      <Form.Item name="national_id" label="Số CCCD" rules={fieldRules.idNumber}><Input /></Form.Item>
      <Button htmlType="submit">Lưu hồ sơ</Button>
    </Form>
  )
}

it.each(['000000000000', '000000000'])(
  'báo lỗi và chặn lưu số CCCD/CMND %s', async (nationalId) => {
    const onFinish = vi.fn()
    render(<IdForm onFinish={onFinish} />)
    const input = screen.getByLabelText('Số CCCD')
    fireEvent.change(input, { target: { value: nationalId } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect(await screen.findByText(/Số CCCD không hợp lệ/)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '012345678901' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ national_id: '012345678901' }))
  },
)

it.each(['012345678901', '012345678', ''])(
  'cho lưu số hợp lệ hoặc ô trống (%s)', async (nationalId) => {
    const onFinish = vi.fn()
    render(<IdForm onFinish={onFinish} />)
    if (nationalId) fireEvent.change(screen.getByLabelText('Số CCCD'), { target: { value: nationalId } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalled())
    if (nationalId) expect(onFinish).toHaveBeenCalledWith({ national_id: nationalId })
  },
)
