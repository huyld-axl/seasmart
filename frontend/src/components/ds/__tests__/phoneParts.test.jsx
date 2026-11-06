import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import Fab from '../Fab'
import BottomSheet from '../BottomSheet'
import DateField, { DateRangeField } from '../DateField'
import RowList from '../RowList'
import HeadActions from '../HeadActions'
import { centerLeft, scrollFlags } from '../scrollRow'

// Điện thoại: mọi truy vấn max-width khớp, min-width không. Desktop: ngược lại (hooks/useViewport.js).
function screenAs(phone) {
  window.matchMedia = (query) => ({
    matches: phone === query.includes('max-width'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
}

afterEach(cleanup)

describe('Fab', () => {
  it('chỉ hiện ở điện thoại, nhãn đọc được', () => {
    screenAs(false)
    const { container } = render(<Fab label="Thêm thuyền viên" />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    screenAs(true)
    const onClick = vi.fn()
    render(<Fab label="Thêm thuyền viên" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thêm thuyền viên' }))
    expect(onClick).toHaveBeenCalled()
  })
})

describe('BottomSheet', () => {
  it('hiện tiêu đề, nội dung, chân; nút đóng gọi onClose', () => {
    screenAs(true)
    const onClose = vi.fn()
    render(<BottomSheet open title="Bộ lọc" onClose={onClose} footer={<button type="button">Xem 12 chuyến</button>}>Thân sheet</BottomSheet>)
    expect(screen.getByRole('heading', { name: 'Bộ lọc' })).toBeInTheDocument()
    expect(screen.getByText('Thân sheet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem 12 chuyến' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('DateField', () => {
  it('desktop là DatePicker của antd', () => {
    screenAs(false)
    const { container } = render(<DateField value={dayjs('2026-11-05')} format="DD/MM/YYYY" />)
    expect(container.querySelector('.ant-picker')).not.toBeNull()
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('điện thoại: ô ngày của máy, hiện DD/MM/YYYY, trả dayjs', () => {
    screenAs(true)
    const onChange = vi.fn()
    const { container } = render(<DateField value={dayjs('2026-11-05')} onChange={onChange} format="DD/MM/YYYY" />)
    const input = container.querySelector('input[type="date"]')
    expect(input.value).toBe('2026-11-05')
    expect(screen.getByText('05/11/2026')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '2026-12-01' } })
    expect(onChange.mock.calls[0][0].format('YYYY-MM-DD')).toBe('2026-12-01')
    expect(onChange.mock.calls[0][1]).toBe('01/12/2026')
  })

  it('điện thoại: ngày bị chặn thì báo lỗi, không đổi giá trị', () => {
    screenAs(true)
    const onChange = vi.fn()
    const { container } = render(<DateField onChange={onChange} disabledDate={(day) => day.isBefore(dayjs('2026-11-01'))} />)
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-10-20' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày này không chọn được')
  })

  it('điện thoại: nút xoá trả null; chọn tháng dùng ô tháng', () => {
    screenAs(true)
    const onChange = vi.fn()
    render(<DateField value={dayjs('2026-11-05')} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Xoá ngày' }))
    expect(onChange).toHaveBeenCalledWith(null, '')
    cleanup()
    const { container } = render(<DateField picker="month" value={dayjs('2026-11-01')} />)
    expect(container.querySelector('input[type="month"]').value).toBe('2026-11')
    expect(screen.getByText('11/2026')).toBeInTheDocument()
  })
})

describe('DateRangeField', () => {
  it('điện thoại: hai ô, chỉ báo khi đủ hai đầu; ô Đến không cho trước ô Từ', () => {
    screenAs(true)
    const onChange = vi.fn()
    const { container } = render(<DateRangeField onChange={onChange} />)
    const [from, to] = container.querySelectorAll('input[type="date"]')
    fireEvent.change(from, { target: { value: '2026-11-01' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(to.min).toBe('2026-11-01')
    fireEvent.change(to, { target: { value: '2026-11-30' } })
    const [range] = onChange.mock.calls[0]
    expect(range.map((day) => day.format('YYYY-MM-DD'))).toEqual(['2026-11-01', '2026-11-30'])
  })

  it('điện thoại: bảng của máy vẫn cho chọn Đến trước Từ thì báo lỗi, không lọc', () => {
    screenAs(true)
    const onChange = vi.fn()
    const { container } = render(<DateRangeField format="DD/MM/YYYY" onChange={onChange} />)
    const [from, to] = container.querySelectorAll('input[type="date"]')
    fireEvent.change(from, { target: { value: '2026-11-30' } })
    fireEvent.change(to, { target: { value: '2026-11-01' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Chọn từ 30/11/2026 trở đi')
  })
})

describe('RowList', () => {
  const columns = [
    { title: 'Khoản', dataIndex: 'name', mobile: 'title' },
    { title: 'Kiểu', dataIndex: 'kind', mobile: 'sub' },
    { title: 'Chênh lệch', dataIndex: 'diff', mobile: 'value' },
    { title: 'Ghi chú', dataIndex: 'note' },
    { title: '', key: 'actions', mobile: 'actions', render: () => <button type="button">Sửa</button> },
  ]
  const rows = [{ id: 1, name: 'Lương thuyền viên', kind: 'Hằng tháng', diff: 300, note: 'ẩn ở điện thoại' }]

  it('desktop là bảng', () => {
    screenAs(false)
    const { container } = render(<RowList columns={columns} dataSource={rows} pagination={false} />)
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('điện thoại: dòng hai tầng, ẩn cột không khai báo, nút trong dòng không mở dòng', () => {
    screenAs(true)
    const open = vi.fn()
    const { container } = render(<RowList columns={columns} dataSource={rows} onRow={(row) => ({ onClick: () => open(row.id) })} />)
    expect(container.querySelector('table')).toBeNull()
    expect(screen.getByText('Lương thuyền viên')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(screen.queryByText('ẩn ở điện thoại')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }))
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Lương thuyền viên'))
    expect(open).toHaveBeenCalledWith(1)
  })

  it('điện thoại: không có dòng thì hiện chữ rỗng của locale', () => {
    screenAs(true)
    render(<RowList columns={columns} dataSource={[]} locale={{ emptyText: 'Chưa có khoản nào' }} />)
    expect(screen.getByText('Chưa có khoản nào')).toBeInTheDocument()
  })
})

describe('scrollRow', () => {
  it('cờ mép trái / phải và vạch chỉ', () => {
    expect(scrollFlags({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toMatchObject({ start: false, end: false, overflow: false })
    expect(scrollFlags({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })).toMatchObject({ start: false, end: true, ratio: 0.5, offset: 0 })
    expect(scrollFlags({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 })).toMatchObject({ start: true, end: true, offset: 0.25 })
    expect(scrollFlags({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })).toMatchObject({ start: true, end: false })
  })

  it('đưa mục vào giữa, không vượt hai đầu', () => {
    expect(centerLeft({ itemLeft: 400, itemWidth: 100, clientWidth: 300, scrollWidth: 1000 })).toBe(300)
    expect(centerLeft({ itemLeft: 20, itemWidth: 100, clientWidth: 300, scrollWidth: 1000 })).toBe(0)
    expect(centerLeft({ itemLeft: 950, itemWidth: 50, clientWidth: 300, scrollWidth: 1000 })).toBe(700)
  })
})

describe('HeadActions', () => {
  const buttons = (onEnd) => [
    <button key="print" type="button">In hợp đồng</button>,
    <button key="end" type="button" data-main onClick={onEnd}>Kết thúc hợp đồng</button>,
    <button key="revert" type="button">Đưa về Nháp</button>,
  ]

  it('desktop giữ đủ các nút', () => {
    screenAs(false)
    render(<HeadActions>{buttons()}</HeadActions>)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('điện thoại: nút chính + ⋯, nút còn lại vào menu', () => {
    screenAs(true)
    render(<HeadActions>{buttons()}</HeadActions>)
    expect(screen.getByRole('button', { name: 'Kết thúc hợp đồng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thao tác khác' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đưa về Nháp' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'In hợp đồng' })).toBeNull()
  })
})
