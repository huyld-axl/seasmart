import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecordTable from '../RecordTable'

const columns = [
  { key: 'name', title: 'Tàu', card: 'title', render: (r) => r.name },
  { key: 'rank', title: 'Chức danh', render: (r) => r.rank },
  { key: 'open', title: 'Thao tác', right: true, render: () => 'Mở' },
]

describe('RecordTable', () => {
  it('có dòng thì vẽ bảng với tiêu đề cột', () => {
    render(<RecordTable rows={[{ id: 1, name: 'MV A', rank: 'OLR' }]} columns={columns} />)
    expect(screen.getByRole('columnheader', { name: 'Chức danh' })).toBeInTheDocument()
    expect(screen.getAllByText('MV A').length).toBeGreaterThan(0)
  })

  it('không có dòng thì chỉ hiện trạng thái trống, không có tiêu đề cột', () => {
    render(<RecordTable rows={[]} columns={columns} empty={<p>Chưa có gì</p>} />)
    expect(screen.getByText('Chưa có gì')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).toBeNull()
  })
})
