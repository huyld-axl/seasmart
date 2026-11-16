import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ListCard, { ListCardList, MoneyStrip } from '../ListCard'

afterEach(cleanup)

const renderCard = (props) => render(<ListCardList><ListCard title="Đỗ Mạnh Cường" {...props} /></ListCardList>)

describe('ListCard', () => {
  it('mỗi ô có nhãn và bỏ ô không có giá trị', () => {
    renderCard({ fields: [{ label: 'Tàu', value: 'MV Ocean Glory' }, { label: 'Chủ tàu', value: '' }, { label: 'Hạn', value: null }] })
    expect(screen.getByText('Tàu')).toBeInTheDocument()
    expect(screen.getByText('MV Ocean Glory')).toBeInTheDocument()
    expect(screen.queryByText('Chủ tàu')).not.toBeInTheDocument()
    expect(screen.queryByText('Hạn')).not.toBeInTheDocument()
  })

  it('chỉ hiện tối đa 4 ô và 2 nút', () => {
    const fields = ['a', 'b', 'c', 'd', 'e'].map((label) => ({ label, value: label.toUpperCase() }))
    const actions = ['x', 'y', 'z'].map((label) => ({ label, onClick() {} }))
    renderCard({ fields, actions })
    expect(screen.queryByText('e')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('con số chính ghi kèm đơn vị', () => {
    renderCard({ figure: { value: '1.595', unit: 'USD' } })
    expect(screen.getByText('1.595')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('bấm phần thân mở thẻ, có nhãn đọc được', () => {
    const onOpen = vi.fn()
    renderCard({ onOpen, openLabel: 'Mở yêu cầu thanh toán TT-1' })
    fireEvent.click(screen.getByRole('button', { name: 'Mở yêu cầu thanh toán TT-1' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('bấm nút việc kế tiếp không mở thẻ', () => {
    const onOpen = vi.fn()
    const onClick = vi.fn()
    renderCard({ onOpen, actions: [{ label: 'Duyệt', onClick }] })
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('nút bị khoá thì không gọi', () => {
    const onClick = vi.fn()
    renderCard({ actions: [{ label: 'Duyệt', onClick, disabled: true }] })
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('dải cảnh báo hiện đúng chữ và màu', () => {
    const { container } = renderCard({ alert: { text: 'Quá hạn 5 ngày', tone: 'err' } })
    expect(screen.getByRole('status')).toHaveTextContent('Quá hạn 5 ngày')
    expect(container.querySelector('.ds-lcard__alert--err')).not.toBeNull()
  })
})

describe('MoneyStrip', () => {
  it('ghi Thu, Chi và chênh lệch', () => {
    render(<MoneyStrip income="2.250" expense="2.000" result="+250 USD/tháng" resultTone="pos" />)
    expect(screen.getByText('2.250')).toBeInTheDocument()
    expect(screen.getByText('2.000')).toBeInTheDocument()
    expect(screen.getByText('Chênh lệch')).toBeInTheDocument()
    expect(screen.getByText('+250 USD/tháng')).toBeInTheDocument()
  })

  it('chưa có tiền thì ghi Chưa nhập tiền', () => {
    render(<MoneyStrip result="0" />)
    expect(screen.getByText('Chưa nhập tiền')).toBeInTheDocument()
  })
})
