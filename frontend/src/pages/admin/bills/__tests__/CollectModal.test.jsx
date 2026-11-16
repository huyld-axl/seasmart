import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import dayjs from 'dayjs'
import { ConfigProvider } from 'antd'
import CollectModal from '../CollectModal'

vi.mock('../../../../components/ds/DateField', () => ({ default: ({ id, value, onChange }) =>
  <input id={id} value={value?.format('YYYY-MM-DD') || ''} onChange={(event) => onChange(event.target.value ? dayjs(event.target.value) : null)} />,
}))
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const bill = { code: 'TT-TEST', total_usd: 100, ship_owner: { company_name: 'Test' } }
const wrapper = ({ children }) => <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>

describe('collect bill form', () => {
  it('shows the required error and does not submit a cleared collection date', async () => {
    const onConfirm = vi.fn()
    render(<CollectModal open bill={bill} onConfirm={onConfirm} />, { wrapper })
    fireEvent.change(screen.getByLabelText('Ngày thu'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã thu' }))
    expect(await screen.findByText('Chọn ngày thu')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })
  it('submits the selected date and resets it when reopened', async () => {
    const onConfirm = vi.fn()
    const view = render(<CollectModal open bill={bill} onConfirm={onConfirm} />, { wrapper })
    const selected = dayjs().subtract(3, 'day').format('YYYY-MM-DD')
    fireEvent.change(screen.getByLabelText('Ngày thu'), { target: { value: selected } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã thu' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(selected))
    view.rerender(<CollectModal open={false} bill={bill} onConfirm={onConfirm} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    view.rerender(<CollectModal open bill={bill} onConfirm={onConfirm} />)
    expect(await screen.findByLabelText('Ngày thu')).toHaveValue(dayjs().format('YYYY-MM-DD'))
  })
})
