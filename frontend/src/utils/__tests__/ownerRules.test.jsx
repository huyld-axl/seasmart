import { Button, Form, Input } from 'antd'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ownerRules } from '../fieldRules'

afterEach(cleanup)

function WebsiteForm({ onFinish }) {
  return (
    <Form onFinish={onFinish}>
      <Form.Item name="website" label="Website" rules={ownerRules.website}><Input /></Form.Item>
      <Button htmlType="submit">Lưu đối tác</Button>
    </Form>
  )
}

it.each(['https://example.com:99999', 'https://example.com:65536', 'https://example.com:abc'])(
  'báo lỗi và chặn lưu Website %s', async (website) => {
    const onFinish = vi.fn()
    render(<WebsiteForm onFinish={onFinish} />)
    const input = screen.getByLabelText('Website')
    fireEvent.change(input, { target: { value: website } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    expect(await screen.findByText(/URL không hợp lệ/)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'https://example.com:65535/contact' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ website: 'https://example.com:65535/contact' }))
  },
)

it.each(['https://example.com', 'http://example.com:8080/a?q=1#contact', ''])(
  'cho lưu Website hợp lệ hoặc ô trống (%s)', async (website) => {
    const onFinish = vi.fn()
    render(<WebsiteForm onFinish={onFinish} />)
    if (website) fireEvent.change(screen.getByLabelText('Website'), { target: { value: website } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalled())
    if (website) expect(onFinish).toHaveBeenCalledWith({ website })
  },
)

function CompanyPhoneForm({ onFinish }) {
  return (
    <Form onFinish={onFinish}>
      <Form.Item name="phone" label="Điện thoại công ty" rules={ownerRules.companyPhone}><Input /></Form.Item>
      <Button htmlType="submit">Lưu đối tác</Button>
    </Form>
  )
}

it.each(['0000000000', ' 0000000000 ', '+00 0000 0000', '(000) 000-0000', '000.000.0000'])(
  'báo lỗi và chặn lưu điện thoại công ty %s', async (phone) => {
    const onFinish = vi.fn()
    render(<CompanyPhoneForm onFinish={onFinish} />)
    const input = screen.getByLabelText('Điện thoại công ty')
    fireEvent.change(input, { target: { value: phone } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    expect(await screen.findByText(/Số điện thoại công ty không hợp lệ/)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '+84 901 234 567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ phone: '+84 901 234 567' }))
  },
)

it('cho phép bỏ trống điện thoại công ty', async () => {
  const onFinish = vi.fn()
  render(<CompanyPhoneForm onFinish={onFinish} />)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
  await waitFor(() => expect(onFinish).toHaveBeenCalled())
})

function TaxForm({ onFinish }) {
  return (
    <Form onFinish={onFinish}>
      <Form.Item name="tax_id" label="Mã số thuế" rules={ownerRules.taxId}><Input /></Form.Item>
      <Button htmlType="submit">Lưu đối tác</Button>
    </Form>
  )
}

it.each(['0000000000', ' 0000000000 ', '0000000000-000', '000.000.0000'])(
  'chặn lưu mã số thuế %s và cho lưu sau khi sửa hợp lệ', async (taxId) => {
    const onFinish = vi.fn()
    render(<TaxForm onFinish={onFinish} />)
    const input = screen.getByLabelText('Mã số thuế')
    fireEvent.change(input, { target: { value: taxId } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    expect(await screen.findByText(/Mã số thuế không hợp lệ/)).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '0123456789-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith({ tax_id: '0123456789-001' }))
  },
)

it('cho phép bỏ trống mã số thuế', async () => {
  const onFinish = vi.fn()
  render(<TaxForm onFinish={onFinish} />)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu đối tác' }))
  await waitFor(() => expect(onFinish).toHaveBeenCalled())
})
