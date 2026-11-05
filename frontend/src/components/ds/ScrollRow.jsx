import { useEffect, useRef, useState } from 'react'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { centerLeft, scrollFlags } from './scrollRow'
import './ds.css'

const ACTIVE = '[aria-current="true"], [aria-current="page"], [aria-selected="true"]'
const IDLE = { start: false, end: false, overflow: false, ratio: 1, offset: 0 }

// Hàng cuộn ngang cho chip, hàng mục form, tab (kế hoạch responsive mục 4.3; luật R6, R10 của skill ui-ux):
// mép mờ 32px phía còn mục, vạch mảnh dưới hàng khi tràn, nút mũi tên khi dùng chuột, tự đưa mục đang chọn
// (aria-current / aria-selected) vào giữa hàng mỗi khi `activeKey` đổi. Nơi gọi chừa ≥ 8px dưới hàng cho vạch.
export default function ScrollRow({ children, label, activeKey, indicator = true, className = '' }) {
  const ref = useRef(null)
  const firstScroll = useRef(true)
  const [flags, setFlags] = useState(IDLE)

  useEffect(() => {
    const track = ref.current
    if (!track) return undefined
    const measure = () => setFlags(scrollFlags(track))
    track.addEventListener('scroll', measure, { passive: true })
    // ResizeObserver gọi lần đầu ngay khi observe: đo lúc tải, khi xoay máy, khi font tải xong đổi bề rộng.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(track)
    return () => {
      track.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [])

  useEffect(() => {
    const track = ref.current
    const item = track?.querySelector(ACTIVE)
    if (!item) return
    // Tự tính scrollLeft, không scrollIntoView: hàng có thể đang ở dưới màn, scrollIntoView kéo cả trang theo.
    track.scrollTo?.({
      left: centerLeft({ itemLeft: item.offsetLeft, itemWidth: item.offsetWidth, clientWidth: track.clientWidth, scrollWidth: track.scrollWidth }),
      behavior: firstScroll.current ? 'auto' : 'smooth',
    })
    firstScroll.current = false
  }, [activeKey])

  const page = (direction) => ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <div className={`ds-scrollrow ${className}`.trim()}>
      <div ref={ref} className="ds-scrollrow__track" role={label ? 'group' : undefined} aria-label={label} data-start={flags.start || undefined} data-end={flags.end || undefined}>
        {children}
      </div>
      {flags.start ? (
        <button type="button" tabIndex={-1} className="ds-scrollrow__arrow ds-scrollrow__arrow--left" aria-label="Cuộn sang trái" onClick={() => page(-1)}>
          <LeftOutlined />
        </button>
      ) : null}
      {flags.end ? (
        <button type="button" tabIndex={-1} className="ds-scrollrow__arrow ds-scrollrow__arrow--right" aria-label="Cuộn sang phải" onClick={() => page(1)}>
          <RightOutlined />
        </button>
      ) : null}
      {indicator && flags.overflow ? (
        <div className="ds-scrollrow__bar" aria-hidden>
          {/* Bề rộng và vị trí đổi theo từng pixel cuộn nên để ở style. */}
          <i style={{ width: `${flags.ratio * 100}%`, left: `${flags.offset * 100}%` }} />
        </div>
      ) : null}
    </div>
  )
}
