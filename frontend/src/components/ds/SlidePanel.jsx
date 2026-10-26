import { Drawer, Button, Grid } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import './ds.css'

// Panel trượt từ phải (layouts/overlay.md): rộng 448px, `size="wide"` 720px cho bảng chọn nhiều cột (đề xuất ứng viên); phủ hết bề ngang dưới sm.
// Lớp phủ mờ 15% để vẫn thấy danh sách phía sau. Có form thì bấm ra ngoài không đóng.
export default function SlidePanel({ open, title, description, onClose, footer, children, hasForm = true, size = 'default' }) {
  const screens = Grid.useBreakpoint()
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={screens.sm ? (size === 'wide' ? 720 : 448) : '100%'}
      closable={false}
      maskClosable={!hasForm}
      rootClassName="ds-panel"
      title={
        <div className="ds-panel__head">
          <div className="ds-panel__heading">
            <h2 className="ds-panel__title">{title}</h2>
            {description ? <p className="ds-panel__desc">{description}</p> : null}
          </div>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Đóng" />
        </div>
      }
      footer={footer ? <div className="ds-panel__foot">{footer}</div> : null}
      destroyOnHidden
    >
      {children}
    </Drawer>
  )
}
