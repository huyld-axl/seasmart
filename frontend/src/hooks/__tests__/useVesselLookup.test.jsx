import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCooldownStore, useVesselLookup } from '../useLookupCooldown'
import { vesselApi } from '../../api/fleetApi'

vi.mock('../../api/fleetApi', () => ({ vesselApi: { lookup: vi.fn(), lookupStatus: vi.fn() } }))

const wrapper = ({ children }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
const apiError = (status, data) => Object.assign(new Error('Request failed'), { response: { status, data } })

describe('useVesselLookup', () => {
  beforeEach(() => {
    useCooldownStore.setState({ until: {}, gateUntil: 0 })
    vi.clearAllMocks()
  })

  it('thành công: đặt thời gian chờ của IMO và trần chung theo số máy chủ trả', async () => {
    vesselApi.lookup.mockResolvedValue({ imo_number: '8998722', retry_after: 120, gate_wait: 90 })
    const { result } = renderHook(() => useVesselLookup(), { wrapper })
    await act(async () => { await result.current.mutateAsync('8998722') })
    const { until, gateUntil } = useCooldownStore.getState()
    expect(until['8998722'] - Date.now()).toBeGreaterThan(118_000)
    expect(gateUntil - Date.now()).toBeGreaterThan(88_000)
    expect(gateUntil - Date.now()).toBeLessThanOrEqual(90_000)
  })

  it('nguồn lỗi 502 kèm retry_after: khoá trần chung để nút đếm ngược', async () => {
    vesselApi.lookup.mockRejectedValue(apiError(502, { error: 'Nguồn ngoài không trả lời kịp', retry_after: 120 }))
    const { result } = renderHook(() => useVesselLookup(), { wrapper })
    await act(async () => { await result.current.mutateAsync('8998722').catch(() => {}) })
    expect(useCooldownStore.getState().gateUntil - Date.now()).toBeGreaterThan(118_000)
  })

  it('hết lượt chung 429: khoá theo retry_after', async () => {
    vesselApi.lookup.mockRejectedValue(apiError(429, { error: 'Hệ thống chỉ gọi nguồn ngoài 1 lần mỗi 2 phút.', retry_after: 75 }))
    const { result } = renderHook(() => useVesselLookup(), { wrapper })
    await act(async () => { await result.current.mutateAsync('8998722').catch(() => {}) })
    const left = useCooldownStore.getState().gateUntil - Date.now()
    expect(left).toBeGreaterThan(73_000)
    expect(left).toBeLessThanOrEqual(75_000)
  })

  it('lỗi khác (400, 503, mất mạng) không khoá trần chung', async () => {
    for (const error of [apiError(400, { error: 'IMO sai số kiểm tra' }), apiError(503, { error: 'Chưa cấu hình' }), new Error('Network Error')]) {
      vesselApi.lookup.mockRejectedValueOnce(error)
      const { result } = renderHook(() => useVesselLookup(), { wrapper })
      await act(async () => { await result.current.mutateAsync('8998722').catch(() => {}) })
    }
    expect(useCooldownStore.getState().gateUntil).toBe(0)
  })
})
