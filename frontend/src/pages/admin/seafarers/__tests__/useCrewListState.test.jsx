import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useCrewListState from '../useCrewListState'

let userId = 1
vi.mock('../../../../stores/authStore', () => ({ default: (select) => select({ user: { id: userId } }) }))
beforeEach(() => { sessionStorage.clear(); userId = 1 })
afterEach(cleanup)

describe('crew list state', () => {
  it('restores the search, filters and pagination after leaving the list', () => {
    const first = renderHook(useCrewListState)
    act(() => {
      first.result.current.setField('search')('Hồ Sơ Kiểm Thử Số')
      first.result.current.setField('tab')('standby')
      first.result.current.setField('page')(2)
      first.result.current.setField('pageSize')(10)
      first.result.current.setField('filters')((f) => ({ ...f, ageMin: 20, ageMax: 40 }))
    })
    const expected = first.result.current.state
    first.unmount()
    const back = renderHook(useCrewListState)
    expect(back.result.current.state).toEqual(expected)
    expect(back.result.current.state.search).toBe('Hồ Sơ Kiểm Thử Số')
  })
  it('keeps account states separate', () => {
    const first = renderHook(useCrewListState)
    act(() => first.result.current.setField('search')('Linh'))
    first.unmount()
    userId = 2
    expect(renderHook(useCrewListState).result.current.state.search).toBe('')
  })
  it('falls back safely for corrupted saved state', () => {
    sessionStorage.setItem('seafarers:list:1', '{broken')
    expect(renderHook(useCrewListState).result.current.state.search).toBe('')
  })
  it('keeps working when session storage is unavailable', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    try {
      const hook = renderHook(useCrewListState)
      act(() => hook.result.current.setField('search')('Linh'))
      expect(hook.result.current.state.search).toBe('Linh')
    } finally { read.mockRestore(); write.mockRestore() }
  })
})
