import { useEffect, useState } from 'react'
import useAuthStore from '../stores/authStore'

// Chỉ lưu các điều kiện hiển thị danh sách, tách theo tài khoản, màn hình và tab trình duyệt.
export default function useListSessionState(scope, field, initial, revive = (value) => value) {
  const userId = useAuthStore((state) => state.user?.id)
  const key = `list:${userId ?? 'anonymous'}:${scope}:${field}`
  const read = () => {
    const fallback = () => typeof initial === 'function' ? initial() : initial
    try {
      const raw = sessionStorage.getItem(key)
      if (raw === null) return fallback()
      const parsed = JSON.parse(raw)
      if (parsed.version !== 1) return fallback()
      const value = revive(parsed.value)
      const expected = fallback()
      if (!(field === 'range' && value === null) && expected !== undefined && expected !== null && (typeof value !== typeof expected || Array.isArray(value) !== Array.isArray(expected))) return fallback()
      if ((field === 'page' || field === 'pageSize') && (!Number.isInteger(value) || value < 1)) return fallback()
      return value
    } catch { return fallback() }
  }
  const [saved, setSaved] = useState(() => ({ key, value: read() }))
  const value = saved.key === key ? saved.value : read()
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify({ version: 1, value })) } catch { /* Storage có thể bị chặn. */ }
  }, [key, value])
  const setValue = (next) => setSaved((previous) => {
    const current = previous.key === key ? previous.value : read()
    return { key, value: typeof next === 'function' ? next(current) : next }
  })
  return [value, setValue]
}
