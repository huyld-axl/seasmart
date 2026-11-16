import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Form, Input, Button } from 'antd'
import useFormShortcuts from '../useFormShortcuts'

let desktop
beforeEach(() => {
  desktop = true
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: desktop, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(() => [{ width: 100, height: 30 }])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function Editor({ onSave = vi.fn(), onCancel = vi.fn(), disabled = false, loading = false, autoFocus = false, enabled = true, overlay = false }) {
  const ref = useFormShortcuts({ autoFocus, enabled, onCancel })
  const fields = <form ref={ref} onSubmit={(e) => { e.preventDefault(); onSave() }}>
    <input aria-label="Ẩn" type="hidden" />
    <input aria-label="Khoá" disabled />
    <input aria-label="Tên" />
    <textarea aria-label="Ghi chú" />
    <div className="ant-select"><input aria-label="Chọn" /></div>
    <button type="submit" disabled={disabled} className={loading ? 'ant-btn-loading' : ''}>Lưu</button>
  </form>
  return overlay ? <div className="ant-modal-content">{fields}</div> : fields
}

it('Enter lưu từ ô nhập, Esc gọi cùng thao tác huỷ', () => {
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<Editor onSave={onSave} onCancel={onCancel} />)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter' })
  expect(onSave).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Escape' })
  expect(onCancel).toHaveBeenCalledTimes(1)
})
it('không lưu khi nút khoá hoặc đang xử lý', () => {
  const onSave = vi.fn(), onCancel = vi.fn()
  const view = render(<Editor disabled onSave={onSave} />)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter' })
  view.rerender(<Editor loading onSave={onSave} onCancel={onCancel} />)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Escape' })
  expect(onSave).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
})
it('giữ Enter xuống dòng, chọn dữ liệu, gõ tiếng Việt và tổ hợp phím', () => {
  const onSave = vi.fn()
  render(<Editor onSave={onSave} />)
  fireEvent.keyDown(screen.getByLabelText('Ghi chú'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Chọn'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter', isComposing: true })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter', repeat: true })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter', ctrlKey: true })
  expect(onSave).not.toHaveBeenCalled()
})
it('không áp dụng phím tắt hoặc autofocus trên điện thoại', async () => {
  desktop = false
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<Editor autoFocus onSave={onSave} onCancel={onCancel} />)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Escape' })
  expect(onSave).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Tên')).not.toHaveFocus()
})
it('focus vào trường đầu tiên dùng được khi thêm mới', async () => {
  render(<Editor autoFocus />)
  await waitFor(() => expect(screen.getByLabelText('Tên')).toHaveFocus())
})
it('không giành con trỏ khi sửa hoặc tắt form', async () => {
  render(<Editor />)
  expect(screen.getByLabelText('Tên')).not.toHaveFocus()
})
it('không lưu form nền khi mở xác nhận xoá hoặc duyệt', () => {
  const onSave = vi.fn(), onCancel = vi.fn(), onDelete = vi.fn()
  render(<><Editor onSave={onSave} onCancel={onCancel} /><div className="ant-modal-content"><button onClick={onDelete}>Xoá</button></div></>)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Escape' })
  expect(onSave).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})
it('ưu tiên đóng dropdown, không đóng/lưu form bên dưới', () => {
  const onSave = vi.fn(), onCancel = vi.fn()
  render(<><Editor onSave={onSave} onCancel={onCancel} /><div className="ant-select-dropdown">Tuỳ chọn</div></>)
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Tên'), { key: 'Escape' })
  expect(onSave).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
})
it('hỗ trợ ref của Ant Design và nút lưu ở footer ngoài form, vẫn validate', async () => {
  const save = vi.fn()
  function AntEditor() {
    const ref = useFormShortcuts({ onCancel: vi.fn() })
    const [form] = Form.useForm()
    return <div className="ant-modal-content">
      <Form ref={ref} form={form} onFinish={save}><Form.Item name="name" rules={[{ required: true, message: 'Nhập tên' }]}><Input aria-label="Tên thật" /></Form.Item></Form>
      <Button data-form-submit onClick={() => form.submit()}>Thêm</Button>
    </div>
  }
  render(<AntEditor />)
  fireEvent.keyDown(screen.getByLabelText('Tên thật'), { key: 'Enter' })
  expect(await screen.findByText('Nhập tên')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Tên thật'), { target: { value: 'Linh' } })
  fireEvent.keyDown(screen.getByLabelText('Tên thật'), { key: 'Enter' })
  await waitFor(() => expect(save).toHaveBeenCalledWith({ name: 'Linh' }))
})

it('Lưu & thêm khác đưa con trỏ về ô đầu sau khi resetFields', async () => {
  function ResetEditor() {
    const ref = useFormShortcuts({ autoFocus: true, onCancel: vi.fn() })
    const [form] = Form.useForm()
    return <Form ref={ref} form={form}>
      <Form.Item name="name"><Input aria-label="Tên mới" /></Form.Item>
      <Form.Item name="email"><Input aria-label="Email mới" /></Form.Item>
      <Button onClick={() => form.resetFields()}>Lưu & thêm khác</Button>
    </Form>
  }
  render(<ResetEditor />)
  await waitFor(() => expect(screen.getByLabelText('Tên mới')).toHaveFocus())
  screen.getByLabelText('Email mới').focus()
  fireEvent.click(screen.getByText('Lưu & thêm khác'))
  await waitFor(() => expect(screen.getByLabelText('Tên mới')).toHaveFocus())
})
