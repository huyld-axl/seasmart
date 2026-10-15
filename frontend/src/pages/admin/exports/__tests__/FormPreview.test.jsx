import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import FormPreview from '../FormPreview'

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { html: '', width: 600 } }) }))
vi.mock('../EditToolbar', () => ({ default: () => null }))
vi.mock('antd', () => ({
  Checkbox: ({ children }) => <span>{children}</span>,
  Tooltip: ({ children }) => children,
  Button: ({ children }) => <button>{children}</button>,
  Skeleton: () => null,
}))

const onEdit = vi.fn()
function Preview({ initialEdits = {}, live = true }) {
  const [edits, setEdits] = useState(initialEdits)
  return <FormPreview docKey="pt" editable persistWhileEditing={live} edits={edits} onEdit={(address, value) => {
    onEdit(address, value)
    setEdits((current) => {
      const next = { ...current }
      if (value === null) delete next[address]
      else next[address] = value
      return next
    })
  }} />
}

function openCell(props) {
  const page = render(<Preview {...props} />)
  const iframe = page.container.querySelector('iframe')
  const doc = iframe.contentDocument
  doc.body.innerHTML = '<table><tr><td data-cell="A1" style="color:rgb(0,0,0)">Gốc</td></tr></table>'
  fireEvent.load(iframe)
  const td = doc.querySelector('td')
  td.tabIndex = 0
  act(() => td.focus())
  return { page, td, doc }
}

describe('lưu nháp ô đang gõ trên giấy', () => {
  beforeEach(() => {
    onEdit.mockClear()
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reports the text before blur and keeps it when the preview unmounts', () => {
    const { page, td } = openCell()
    td.textContent = 'Nội dung đang gõ'
    fireEvent.input(td)
    expect(onEdit).toHaveBeenLastCalledWith('A1', 'Nội dung đang gõ')
    page.unmount()
    expect(onEdit).toHaveBeenLastCalledWith('A1', 'Nội dung đang gõ')
  })

  it('Escape restores the previous saved edit even after live autosave', () => {
    const { td } = openCell({ initialEdits: { A1: 'Đã sửa trước' } })
    td.textContent = 'Thay đổi mới'
    fireEvent.input(td)
    expect(onEdit).toHaveBeenLastCalledWith('A1', 'Thay đổi mới')
    fireEvent.keyDown(td, { key: 'Escape' })
    expect(onEdit).toHaveBeenLastCalledWith('A1', 'Đã sửa trước')
    expect(td.textContent).toBe('Đã sửa trước')
  })

  it('Escape restores the original template when there was no prior edit', () => {
    const { td } = openCell()
    td.textContent = 'Thay đổi mới'
    fireEvent.input(td)
    fireEvent.keyDown(td, { key: 'Escape' })
    expect(onEdit).toHaveBeenLastCalledWith('A1', null)
    expect(td.textContent).toBe('Gốc')
  })

  it('preserves the existing commit-on-blur behavior for other screens', () => {
    const { td } = openCell({ live: false })
    td.textContent = 'Đợi rời ô'
    fireEvent.input(td)
    expect(onEdit).not.toHaveBeenCalled()
    act(() => td.blur())
    expect(onEdit).toHaveBeenLastCalledWith('A1', 'Đợi rời ô')
  })
})
