import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal } from 'antd'
import Banner from '../../../components/ds/Banner'
import useToast from '../../../components/ds/useToast'
import { bridgeError, desktop } from '../../../lib/desktop'

const SIX = /^\d{6}$/
const digits = (e) => e.target.value.replace(/\D/g, '').slice(0, 6)

// Thẻ "Mã PIN" ở Cài đặt trên máy này: chỉ hiện khi văn phòng bật khoá bằng PIN và máy đã có PIN.
// PIN theo máy, máy nào biết máy đó (quản trị không xem, không đặt lại hộ):
// - Đổi mã PIN: cần mã hiện tại; sai cùng đếm với màn khoá, sai 5 lần thì xoá PIN và về đăng nhập.
// - Quên mã PIN: đăng xuất trên máy này (xoá PIN), đăng nhập lại qua trình duyệt rồi đặt mã mới (DesktopLock).
export default function PinCard() {
  const toast = useToast()
  const { modal } = App.useApp()
  const [state, setState] = useState(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    desktop.lockState().then(setState)
    return desktop.onLockChanged(() => desktop.lockState().then(setState))
  }, [])

  if (!state?.required || !state.hasPin) return null

  function close() {
    setOpen(false)
    setError('')
    form.resetFields()
  }

  async function save() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await desktop.changePin(values.current, values.next)
      if (result.ok) {
        close()
        toast.success('Đã đổi mã PIN của máy này')
      } else if (result.exhausted) {
        window.location.href = '/login'
      } else {
        setError(`Sai mã PIN hiện tại. Còn ${result.left} lần thử.`)
        form.setFieldValue('current', '')
      }
    } catch (err) {
      setError(bridgeError(err))
    } finally {
      setBusy(false)
    }
  }

  function forgot() {
    modal.confirm({
      title: 'Đăng nhập lại để đặt mã PIN mới?',
      content: 'MCAH đăng xuất trên máy này và xoá mã PIN cũ. Đăng nhập lại qua trình duyệt (cần internet), rồi đặt mã PIN mới. Dữ liệu không mất.',
      okText: 'Đăng nhập lại',
      cancelText: 'Huỷ',
      onOk: () => desktop.logout().then(() => (window.location.href = '/login')),
    })
  }

  const pinInput = (name, label, rules) => (
    <Form.Item name={name} label={label} getValueFromEvent={digits} rules={rules}>
      <Input.Password inputMode="numeric" autoComplete="off" maxLength={6} placeholder="6 chữ số" />
    </Form.Item>
  )
  const six = { pattern: SIX, message: 'Mã PIN gồm đúng 6 chữ số' }

  return (
    <Card title="Mã PIN">
      <p style={{ marginTop: 0 }}>Mã PIN mở khoá MCAH trên máy này. Mỗi máy một mã riêng; quản trị không xem hay đặt lại hộ được.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => setOpen(true)}>Đổi mã PIN</Button>
        <Button type="link" onClick={forgot}>Quên mã PIN?</Button>
      </div>
      <Modal
        open={open}
        title="Đổi mã PIN của máy này"
        onCancel={close}
        footer={[
          <Button key="cancel" onClick={close}>Huỷ</Button>,
          <Button key="save" type="primary" loading={busy} onClick={save}>Lưu</Button>,
        ]}
      >
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: error ? 12 : 0 }} onFinish={save}>
          {pinInput('current', 'Mã PIN hiện tại', [{ required: true, message: 'Nhập mã PIN hiện tại' }, six])}
          {pinInput('next', 'Mã PIN mới', [{ required: true, message: 'Nhập mã PIN mới' }, six])}
          {pinInput('confirm', 'Nhập lại mã PIN mới', [
            { required: true, message: 'Nhập lại mã PIN mới' },
            ({ getFieldValue }) => ({ validator: (_r, v) => (!v || v === getFieldValue('next') ? Promise.resolve() : Promise.reject(new Error('Hai lần nhập mã PIN mới không khớp'))) }),
          ])}
        </Form>
      </Modal>
    </Card>
  )
}
