import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import PartnerListPage from '../PartnerListPage'
import { useFleetList } from '../../../../hooks/useFleet'
vi.mock('../../../../hooks/useFleet', () => ({ useFleetList: vi.fn(), usePartnerLogo: () => null }))
vi.mock('../../../../hooks/usePermission', () => ({ useCan: () => () => true }))
vi.mock('../../../../components/ds/useListSticky', () => ({ default: () => ({}) }))
vi.mock('../../../../api', () => ({ lookupApi: { countries: async () => ({ data: [{ id: 7, code: 'SG', name_vi: 'Singapore' }] }) } }))
vi.mock('antd', async (original) => {
  const actual = await original()
  return { ...actual, Grid: { useBreakpoint: () => ({ md: true }) },
    Select: ({ options, onChange, value, mode, 'aria-label': label }) => <select aria-label={label} multiple={mode === 'multiple'} value={value || (mode === 'multiple' ? [] : '')} onChange={(event) => onChange(mode === 'multiple' ? Array.from(event.target.selectedOptions, (option) => option.value).filter(Boolean) : Number(event.target.value) || undefined)}><option value="">Tất cả</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
    Table: ({ columns, dataSource }) => <table><thead><tr>{columns.map((column) => <th key={column.key || column.dataIndex}>{column.title}</th>)}</tr></thead><tbody>{dataSource.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key || column.dataIndex}>{column.render?.(row[column.dataIndex], row)}</td>)}</tr>)}</tbody></table>,
  }
})
beforeEach(() => {
  window.matchMedia = vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  useFleetList.mockReturnValue({ data: { data: [{ id: 9, company_name: 'Lotus', is_active: 1, contacts: [{ name: 'Other contact' }, { name: 'Primary contact', is_primary: true, phone: '0901', position: 'Crewing Manager' }] }], total: 1, counts: { all: 1, active: 1, inactive: 0 } } })
})
afterEach(cleanup)
function show() { render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><PartnerListPage /></MemoryRouter></QueryClientProvider>) }
it('chỉ hiện liên hệ chính, trạng thái và bỏ hai cột số lượng', () => {
  show()
  expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Liên hệ chính' })).toBeInTheDocument()
  expect(screen.getByText('Primary contact')).toBeInTheDocument()
  expect(screen.getByText('Crewing Manager')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Cập nhật gần nhất' })).toBeInTheDocument()
  expect(screen.queryByText('Other contact')).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Số tàu' })).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Bộ giấy đã nộp' })).toBeNull()
})
it('mở bộ lọc quốc gia và truyền tham số về API', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
  await screen.findByRole('option', { name: '🇸🇬 Singapore' })
  fireEvent.change(screen.getByLabelText('Lọc theo quốc gia'), { target: { value: '7' } })
  expect(useFleetList.mock.calls.at(-1)[2]).toMatchObject({ country_id: 7, page: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }))
  expect(useFleetList.mock.calls.at(-1)[2].country_id).toBeUndefined()
})

it('lọc nhiều kênh liên hệ và xóa toàn bộ bộ lọc', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
  expect(screen.queryByLabelText('Lọc thông tin còn thiếu')).toBeNull()
  const channels = screen.getByLabelText('Lọc kênh liên hệ')
  channels.options[1].selected = true
  channels.options[2].selected = true
  fireEvent.change(channels)
  expect(useFleetList.mock.calls.at(-1)[2]).toMatchObject({ channels: 'zalo,whatsapp', page: 1 })
  fireEvent.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }))
  expect(useFleetList.mock.calls.at(-1)[2]).toMatchObject({ channels: undefined, country_id: undefined })
})
