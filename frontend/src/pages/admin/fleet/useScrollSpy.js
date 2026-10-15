import { useEffect, useState } from 'react'

// Mục đang nằm trong tầm nhìn: dùng để sáng mục lục của form khi cuộn.
export default function useScrollSpy(keys, ready = true) {
  const [active, setActive] = useState(keys[0])
  useEffect(() => {
    if (!ready) return undefined
    const els = keys.map((key) => document.getElementById(`sf-${key}`)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActive(top.target.id.slice(3))
      },
      { rootMargin: '-96px 0px -60% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, keys.join('|')])
  return [active, setActive]
}
