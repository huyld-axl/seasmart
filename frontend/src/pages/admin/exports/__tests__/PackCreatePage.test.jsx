import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PackCreatePage from '../PackCreatePage'
import { createDraftStore, draftKey } from '../exportDraft'

const mocks = vi.hoisted(() => ({
  userId: 'submit-success', navigate: vi.fn(), create: vi.fn(), invalidate: vi.fn(),
  success: vi.fn(), error: vi.fn(),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams()],
  Link: ({ children }) => <a>{children}</a>,
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useQueries: ({ queries }) => queries.map(({ queryKey }) => ({ data: queryKey[0] === 'seafarer'
    ? { id: Number(queryKey[1]), full_name: `Ứng viên ${queryKey[1]}` }
    : [] })),
  useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'seafarer-pick' ? [] : { data: [] } }),
}))
vi.mock('../../../../stores/authStore', () => ({ default: (select) => select({ user: { id: mocks.userId } }) }))
vi.mock('../../../../components/ds/useToast', () => ({ default: () => ({ success: mocks.success, error: mocks.error }) }))
vi.mock('../../../../api/exportApi', () => ({ exportApi: { create: mocks.create } }))
vi.mock('../FormPreview', () => ({ default: () => null }))
vi.mock('../DocFields', () => ({ default: () => null }))
vi.mock('../PreviewNav', () => ({ default: () => null }))
vi.mock('antd', () => ({
  Button: ({ children, onClick, disabled }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  Select: () => null,
  Input: () => null,
  Tooltip: ({ children }) => children,
  Popconfirm: ({ children }) => children,
}))

function startDraft(id, people = ['7']) {
  mocks.userId = id
  const store = createDraftStore(id)
  store.setField('people', people)
  store.setField('selected', ['pt'])
  store.setField('ownerId', 3)
  store.setField('inputs', { 'Số tiền': '1.500.000' })
  store.setField('edits', { 7: { pt: { C6: 'Nội dung sửa' } } })
  render(<PackCreatePage />)
  return draftKey(id)
}

describe('tạo bộ giấy từ nháp', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.create.mockReset()
  })

  it('submits restored values and clears the draft only on success', async () => {
    const key = startDraft('submit-success')
    mocks.create.mockResolvedValue({ id: 101 })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ giấy' }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/exports/101'))
    expect(mocks.create).toHaveBeenCalledWith({ seafarer_id: 7, ship_owner_id: 3, docs: ['pt'], inputs: { 'Số tiền': '1.500.000' }, edits: { pt: { C6: 'Nội dung sửa' } } })
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('keeps all input and cell edits if creation fails', async () => {
    const key = startDraft('submit-failure')
    const before = localStorage.getItem(key)
    mocks.create.mockRejectedValue(new Error('Offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ giấy' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalled())
    expect(localStorage.getItem(key)).toBe(before)
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('keeps only unfinished people after partial success to avoid duplicate packs', async () => {
    const key = startDraft('submit-partial', ['7', '8'])
    mocks.create.mockResolvedValueOnce({ id: 102 }).mockRejectedValueOnce(new Error('Offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo 2 bộ giấy' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalled())
    expect(JSON.parse(localStorage.getItem(key)).data.people).toEqual(['8'])
    mocks.create.mockResolvedValueOnce({ id: 103 })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ giấy' }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/exports/103'))
    expect(mocks.create.mock.calls.map(([body]) => body.seafarer_id)).toEqual([7, 8, 8])
    expect(localStorage.getItem(key)).toBeNull()
  })
})
