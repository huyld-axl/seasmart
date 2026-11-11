import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SearchSelect from '../SearchSelect'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const options = [{ value: 1, label: 'Lê Tiến Linh' }, { value: 2, label: 'Đặng Thị Hồng' }]

it.each([true, { optionFilterProp: 'label' }])('lọc không dấu và chọn được kết quả với showSearch=%j', async (showSearch) => {
  const onChange = vi.fn()
  render(<SearchSelect showSearch={showSearch} options={options} virtual={false} onChange={onChange} />)
  const input = screen.getByRole('combobox')
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'tien linh' } })
  await waitFor(() => expect(screen.queryByText('Đặng Thị Hồng')).not.toBeInTheDocument())
  fireEvent.click(await screen.findByText('Lê Tiến Linh'))
  expect(onChange).toHaveBeenCalledWith(1, expect.objectContaining({ label: 'Lê Tiến Linh' }))
})

it.each([false, true])('giữ tìm kiếm qua API khi filterOption=false ở cấu hình lồng=%s', async (nested) => {
  const onSearch = vi.fn()
  const props = nested ? { showSearch: { filterOption: false, onSearch } } : { showSearch: true, filterOption: false, onSearch }
  render(<SearchSelect {...props} options={options} virtual={false} />)
  const input = screen.getByRole('combobox')
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'ket qua tu API' } })
  await waitFor(() => expect(onSearch).toHaveBeenCalledWith('ket qua tu API'))
  expect(screen.getByText('Lê Tiến Linh')).toBeInTheDocument()
  expect(screen.getByText('Đặng Thị Hồng')).toBeInTheDocument()
})

it('lọc cả nhóm lựa chọn không dấu', async () => {
  render(<SearchSelect showSearch options={[{ label: 'Nhân sự', options }]} virtual={false} />)
  const input = screen.getByRole('combobox')
  fireEvent.mouseDown(input)
  fireEvent.change(input, { target: { value: 'dang thi' } })
  expect(await screen.findByText('Đặng Thị Hồng')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('Lê Tiến Linh')).not.toBeInTheDocument())
})
