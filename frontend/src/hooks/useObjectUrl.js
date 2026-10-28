import { useEffect, useMemo } from 'react'

// Địa chỉ blob: tạm cho một Blob / File (xem trước ảnh, PDF). Tự thu hồi khi đổi Blob hoặc rời màn.
// `accept(blob)` (tuỳ chọn) lọc loại tệp; không khớp thì trả null.
export default function useObjectUrl(blob, accept) {
  const ok = Boolean(blob) && (!accept || accept(blob))
  const url = useMemo(() => (ok ? URL.createObjectURL(blob) : null), [blob, ok])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}
