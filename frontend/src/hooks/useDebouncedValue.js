import { useEffect, useState } from 'react'

// Giá trị chỉ đổi sau khi ngừng thay đổi `delay` ms. Dùng cho ô tìm gọi API.
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
