import { useEffect, useLayoutEffect, useRef } from 'react'

export default function useListScrollReset(isMobile, isFetching) {
  const listRef = useRef(null)
  const pendingReset = useRef(false)
  const frameRef = useRef(null)

  const resetScroll = () => {
    const body = listRef.current?.querySelector('.ant-table-body')
    if (body) body.scrollTop = 0
    if (isMobile) {
      listRef.current?.scrollIntoView({ block: 'start', inline: 'nearest' })
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  useLayoutEffect(() => {
    if (!pendingReset.current || isFetching) return
    resetScroll()
    cancelAnimationFrame(frameRef.current)
    // Run again after controls restore focus and the new rows finish layout.
    frameRef.current = requestAnimationFrame(() => {
      resetScroll()
      pendingReset.current = false
    })
  })

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  const scrollToListStart = () => {
    pendingReset.current = true
    resetScroll()
  }

  return { listRef, scrollToListStart }
}