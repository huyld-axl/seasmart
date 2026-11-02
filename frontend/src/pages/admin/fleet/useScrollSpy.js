import { useCallback, useEffect, useRef, useState } from 'react'

// Dòng mốc: mục nào có đầu nằm trên dòng này (tính từ mép trên vùng cuộn) và là mục cuối như vậy thì đang được đọc.
const LINE = 120

function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

// Mục đang đọc: dùng để sáng mục lục của form/trang chi tiết khi cuộn.
// Cuộn hết trang thì mục cuối sáng (mục ngắn không bao giờ lên tới dòng mốc). Bấm mục lục thì giữ mục đã bấm tới khi người dùng cuộn tiếp.
export default function useScrollSpy(keys, ready = true) {
  const [active, setActiveState] = useState(keys[0])
  const pinned = useRef(false)
  const settled = useRef(false)
  const setActive = useCallback((key) => {
    pinned.current = true
    settled.current = false
    setActiveState(key)
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    const els = keys.map((key) => document.getElementById(`sf-${key}`)).filter(Boolean)
    if (!els.length) return undefined
    const root = scrollParent(els[0])
    const target = root || window
    let timer
    const compute = () => {
      const top = root ? root.getBoundingClientRect().top : 0
      const height = root ? root.clientHeight : window.innerHeight
      const scrolled = root ? root.scrollTop : window.scrollY
      const total = root ? root.scrollHeight : document.documentElement.scrollHeight
      let current = els[0]
      if (scrolled + height >= total - 2 && scrolled > 0) current = els[els.length - 1]
      else els.forEach((el) => { if (el.getBoundingClientRect().top - top <= LINE) current = el })
      setActiveState(current.id.slice(3))
    }
    const onScroll = () => {
      if (pinned.current) {
        // Cuộn mượt do bấm mục lục: chờ nó dừng; cuộn tiếp sau đó là của người dùng.
        if (settled.current) pinned.current = false
        else {
          clearTimeout(timer)
          timer = setTimeout(() => { settled.current = true }, 150)
          return
        }
      }
      compute()
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    compute()
    return () => {
      clearTimeout(timer)
      target.removeEventListener('scroll', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, keys.join('|')])
  return [active, setActive]
}
