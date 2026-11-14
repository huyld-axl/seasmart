import { useEffect, useState } from 'react'
import useAuthStore from '../../../stores/authStore'
import { EMPTY_FILTERS } from './crewFilters'

const INITIAL = { tab: 'all', search: '', sort: 'newest', filters: EMPTY_FILTERS, filtersOpen: false, page: 1, pageSize: 20 }

// Giữ ngữ cảnh danh sách khi mở hồ sơ rồi quay lại; mỗi tài khoản và tab trình duyệt có phiên riêng.
export default function useCrewListState() {
  const userId = useAuthStore((state) => state.user?.id)
  const key = `seafarers:list:${userId ?? 'anonymous'}`
  const [saved, setSaved] = useState(() => read(key))
  const state = saved.key === key ? saved.value : read(key).value
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(state)) } catch { /* Trình duyệt có thể chặn storage. */ }
  }, [key, state])
  const setField = (field) => (value) => setSaved((previous) => {
    const current = previous.key === key ? previous.value : read(key).value
    return { key, value: { ...current, [field]: typeof value === 'function' ? value(current[field]) : value } }
  })
  return { state, setField }
}

function read(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key))
    if (value && typeof value.search === 'string' && Number.isInteger(value.page) && value.page > 0
      && [10, 20, 50].includes(value.pageSize) && ['all', 'onboard', 'standby', 'inactive'].includes(value.tab)
      && ['newest', 'name_asc', 'name_desc'].includes(value.sort)
      && value.filters && ['ranks', 'vessels', 'certs'].every((field) => Array.isArray(value.filters[field]))) {
      return { key, value: { ...INITIAL, ...value } }
    }
  } catch { /* Storage lỗi hoặc dữ liệu cũ: dùng trạng thái mặc định. */ }
  return { key, value: INITIAL }
}
