import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useMutation, useQuery } from '@tanstack/react-query'
import { vesselApi } from '../api/fleetApi'
import { secondsLeft } from '../utils/countdown'

// Hai lớp thời gian chờ của Lấy thông tin thông minh; máy chủ giữ mốc chính thức, phía này chỉ hiện đếm ngược và khoá nút
// (dùng chung giữa hộp xác nhận và form):
//  - gateUntil: trần CHUNG, cả hệ thống chỉ gọi nguồn ngoài 1 lần mỗi 2 phút. Áp cho mọi tàu, mọi nút.
//  - until[imo]: thời điểm tàu này lấy lại được (lớn nhất của thời gian chờ riêng của IMO và trần chung).
export const useCooldownStore = create((set) => ({
  until: {},
  gateUntil: 0,
  start: (imo, seconds) => set((state) => ({ until: { ...state.until, [imo]: Date.now() + seconds * 1000 } })),
  startGate: (seconds) => set({ gateUntil: seconds > 0 ? Date.now() + seconds * 1000 : 0 }),
}))

// Số giây còn lại của một IMO (đã gồm trần chung), tự cập nhật mỗi giây khi đang chờ.
export function useCooldown(imo) {
  const until = useCooldownStore((state) => Math.max(state.until[imo] || 0, state.gateUntil))
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until || until <= Date.now()) return undefined
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= until) clearInterval(timer)
    }
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [until])
  return secondsLeft(until, now)
}

// Lỗi 429 (hết lượt chung) và 502 (nguồn lỗi) đều kèm retry_after: lượt đã bị tính nên khoá nút và đếm ngược theo số đó.
function syncGateFromError(error) {
  const wait = Number(error?.response?.data?.retry_after)
  if ([429, 502].includes(error?.response?.status) && wait > 0) useCooldownStore.getState().startGate(wait)
}

// Tra một IMO. Nguồn đã trả lời (có hoặc không có tàu) hay lỗi đều tính vào thời gian chờ chung; máy chủ báo số giây.
export function useVesselLookup() {
  return useMutation({
    mutationFn: (imo) => vesselApi.lookup(imo),
    onSuccess: (result) => {
      const { start, startGate } = useCooldownStore.getState()
      start(result.imo_number, result.retry_after)
      startGate(result.gate_wait)
    },
    onError: syncGateFromError,
  })
}

// Máy chủ đã cấu hình nguồn ngoài chưa (chưa thì ẩn mọi nút Lấy thông minh), và trần chung còn phải chờ bao lâu.
// Hỏi lại mỗi lần mở màn để biết người khác vừa dùng lượt.
export function useLookupStatus() {
  return useQuery({
    queryKey: ['fleet', 'vessels', 'lookup-status'],
    queryFn: async () => {
      const status = await vesselApi.lookupStatus()
      useCooldownStore.getState().startGate(status.wait_seconds || 0)
      return status
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  })
}
