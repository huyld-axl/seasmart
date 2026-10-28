import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCooldown, useCooldownStore } from '../useLookupCooldown'

describe('useCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'))
    useCooldownStore.setState({ until: {}, gateUntil: 0 })
  })
  afterEach(() => vi.useRealTimers())

  it('chưa bắt đầu thì 0', () => {
    const { result } = renderHook(() => useCooldown('9747613'))
    expect(result.current).toBe(0)
  })
  it('bắt đầu 120 giây rồi đếm ngược mỗi giây tới 0', () => {
    const { result } = renderHook(() => useCooldown('9747613'))
    act(() => useCooldownStore.getState().start('9747613', 120))
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(120)
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current).toBe(60)
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current).toBe(0)
  })
  it('mỗi IMO đếm riêng', () => {
    const a = renderHook(() => useCooldown('9747613'))
    const b = renderHook(() => useCooldown('9811000'))
    act(() => useCooldownStore.getState().start('9747613', 30))
    act(() => { vi.advanceTimersByTime(1) })
    expect(a.result.current).toBe(30)
    expect(b.result.current).toBe(0)
  })
  it('trần chung áp cho mọi IMO, lấy giá trị lớn hơn giữa riêng và chung', () => {
    const a = renderHook(() => useCooldown('9747613'))
    const b = renderHook(() => useCooldown('9811000'))
    act(() => useCooldownStore.getState().startGate(90))
    act(() => { vi.advanceTimersByTime(1) })
    expect(a.result.current).toBe(90)
    expect(b.result.current).toBe(90)
    act(() => useCooldownStore.getState().start('9747613', 120))
    act(() => { vi.advanceTimersByTime(1) })
    expect(a.result.current).toBe(120)
    expect(b.result.current).toBe(90)
    act(() => { vi.advanceTimersByTime(90_000) })
    expect(b.result.current).toBe(0)
    expect(a.result.current).toBe(30)
  })
  it('startGate(0) mở lại ngay', () => {
    const { result } = renderHook(() => useCooldown('9747613'))
    act(() => useCooldownStore.getState().startGate(60))
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(60)
    act(() => useCooldownStore.getState().startGate(0))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(0)
  })
})
