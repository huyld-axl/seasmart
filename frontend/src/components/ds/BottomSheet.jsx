import { useRef } from 'react'
import { Button, Drawer } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import './ds.css'

const CLOSE_DRAG = 80

// Sheet trượt lên từ đáy (kế hoạch responsive mục 4.3): tay kéo, tiêu đề + nút đóng, thân cuộn, chân dính đáy với các nút
// chia đều 44px. Cao theo nội dung, tối đa gần hết màn. Kéo tay kéo xuống quá 80px, chạm nền mờ hoặc bấm × thì đóng.
// Dùng cho lớp chọn / lọc ở điện thoại; desktop nơi gọi tự dùng popover hay SlidePanel như cũ.
export default function BottomSheet({ open, title, description, onClose, footer, children }) {
  const drag = useRef(null)

  const panelOf = (target) => target.closest('.ant-drawer-content-wrapper')
  const onPointerDown = (event) => {
    drag.current = { startY: event.clientY, dy: 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event) => {
    if (!drag.current) return
    drag.current.dy = Math.max(0, event.clientY - drag.current.startY)
    const panel = panelOf(event.currentTarget)
    if (panel) {
      panel.style.transition = 'none'
      panel.style.transform = `translateY(${drag.current.dy}px)`
    }
  }
  const onPointerUp = (event) => {
    if (!drag.current) return
    const { dy } = drag.current
    drag.current = null
    const panel = panelOf(event.currentTarget)
    if (panel) {
      panel.style.transition = ''
      panel.style.transform = ''
    }
    if (dy > CLOSE_DRAG) onClose?.()
  }

  return (
    <Drawer open={open} onClose={onClose} placement="bottom" closable={false} title={null} rootClassName="ds-sheet" footer={footer || null} destroyOnHidden>
      <div className="ds-sheet__head">
        <button
          type="button"
          className="ds-sheet__grab"
          aria-label="Kéo xuống để đóng"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(event) => event.preventDefault()}
        />
        <div className="ds-sheet__titlerow">
          <div className="ds-sheet__heading">
            <h2 className="ds-sheet__title">{title}</h2>
            {description ? <p className="ds-sheet__desc">{description}</p> : null}
          </div>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Đóng" />
        </div>
      </div>
      {children}
    </Drawer>
  )
}
