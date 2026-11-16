import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import useListSessionState from '../useListSessionState'

let userId = 1
vi.mock('../../stores/authStore', () => ({ default: (select) => select({ user: { id: userId } }) }))
beforeEach(() => { sessionStorage.clear(); userId = 1 })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('list session state', () => {
  it.each(['partners', 'vessels', 'opportunities', 'voyages', 'contracts:default', 'bills:all:default'])('restores search, filters and page for %s after remount', (scope) => {
    const useList = () => ({
      search: useListSessionState(scope, 'search', ''),
      filters: useListSessionState(scope, 'filters', {}),
      page: useListSessionState(scope, 'page', 1),
      size: useListSessionState(scope, 'pageSize', 20),
    })
    const first = renderHook(useList)
    act(() => {
      first.result.current.search[1]('Lê Tiến Linh')
      first.result.current.filters[1]((f) => ({ ...f, ship_owner_id: 7 }))
      first.result.current.page[1](3)
      first.result.current.size[1](10)
    })
    first.unmount()
    const back = renderHook(useList)
    expect(back.result.current.search[0]).toBe('Lê Tiến Linh')
    expect(back.result.current.filters[0]).toEqual({ ship_owner_id: 7 })
    expect(back.result.current.page[0]).toBe(3)
    expect(back.result.current.size[0]).toBe(10)
  })
  it('separates accounts, lists, embedded partner bills and explicit tab links', () => {
    const first = renderHook(() => useListSessionState('bills:all:default', 'search', ''))
    act(() => first.result.current[1]('Test'))
    first.unmount()
    for (const scope of ['partners', 'bills:7:default', 'bills:all:PAID']) {
      expect(renderHook(() => useListSessionState(scope, 'search', '')).result.current[0]).toBe('')
    }
    userId = 2
    expect(renderHook(() => useListSessionState('bills:all:default', 'search', '')).result.current[0]).toBe('')
  })
  it('revives voyage dates and preserves a cleared range', () => {
    const initial = () => [dayjs('2026-11-01'), dayjs('2026-11-30')]
    const revive = (value) => value?.map((date) => date ? dayjs(date) : null) ?? null
    const useRange = () => useListSessionState('voyages', 'range', initial, revive)
    const first = renderHook(useRange)
    act(() => first.result.current[1]([dayjs('2026-10-01'), dayjs('2026-10-31')]))
    first.unmount()
    const back = renderHook(useRange)
    expect(back.result.current[0][0].format('YYYY-MM-DD')).toBe('2026-10-01')
    act(() => back.result.current[1](null))
    back.unmount()
    expect(renderHook(useRange).result.current[0]).toBeNull()
  })
  it('handles broken storage and invalid saved pagination', () => {
    sessionStorage.setItem('list:1:partners:search', '{broken')
    sessionStorage.setItem('list:1:partners:page', JSON.stringify({ version: 1, value: -3 }))
    expect(renderHook(() => useListSessionState('partners', 'search', '')).result.current[0]).toBe('')
    expect(renderHook(() => useListSessionState('partners', 'page', 1)).result.current[0]).toBe(1)
  })
  it('ignores null saved filters instead of crashing list pages', () => {
    sessionStorage.setItem('list:1:partners:filters', JSON.stringify({ version: 1, value: null }))
    expect(renderHook(() => useListSessionState('partners', 'filters', {})).result.current[0]).toEqual({})
    sessionStorage.setItem('list:1:partners:channels', JSON.stringify({ version: 1, value: null }))
    expect(renderHook(() => useListSessionState('partners', 'channels', [])).result.current[0]).toEqual([])
  })
  it('still updates state when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const hook = renderHook(() => useListSessionState('partners', 'search', ''))
    act(() => hook.result.current[1]('Test'))
    expect(hook.result.current[0]).toBe('Test')
  })
})
