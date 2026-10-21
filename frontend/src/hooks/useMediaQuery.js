import { useEffect, useState } from 'react'

// true khi khung nhìn khớp truy vấn media (ví dụ '(max-width: 639px)'); đổi theo khi xoay màn hình / kéo cửa sổ.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}
