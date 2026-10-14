import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useExportDraft from '../useExportDraft'

describe('khôi phục nháp khi chuyển màn', () => {
  it('retains work across unmounts and resets after successful creation or discard', () => {
    const first = renderHook(() => useExportDraft('navigation-test', null))
    act(() => {
      first.result.current.setField('people', ['21'])
      first.result.current.setField('inputs', { 'Tên tàu': 'Tàu đã chọn' })
    })
    first.unmount()
    const back = renderHook(() => useExportDraft('navigation-test', null))
    expect(back.result.current.data.people).toEqual(['21'])
    expect(back.result.current.data.inputs).toEqual({ 'Tên tàu': 'Tàu đã chọn' })
    act(() => back.result.current.clearDraft())
    back.unmount()
    const next = renderHook(() => useExportDraft('navigation-test', '99'))
    expect(next.result.current.data.people).toEqual(['99'])
    expect(next.result.current.data.inputs).toEqual({})
  })

  it('does not reuse another account draft when the logged-in user changes', () => {
    const { result, rerender } = renderHook(({ id }) => useExportDraft(id, null), { initialProps: { id: 'account-a' } })
    act(() => result.current.setField('inputs', { 'Tên tàu': 'Riêng A' }))
    rerender({ id: 'account-b' })
    expect(result.current.data.inputs).toEqual({})
    rerender({ id: 'account-a' })
    expect(result.current.data.inputs).toEqual({ 'Tên tàu': 'Riêng A' })
  })
})
