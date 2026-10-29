import { Drawer, Button, Grid } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import './ds.css'

// Panel trượt từ phải (layouts/overlay.md): rộng 448px, `size="wide"` 720px cho bảng chọn nhiều cột, `size="xl"` 960px cho panel có cột lọc bên trái; phủ hết bề ngang dưới sm.
// `flush`: bỏ đệm thân panel để nội dung tự chia vùng (thanh công cụ đứng yên, danh sách cuộn riêng).
// Lớp phủ mờ 15% để vẫn thấy danh sách phía sau. Có form thì bấm ra ngoài không đóng.
export default function SlidePanel({ open, title, description, onClose, footer, children, hasForm = true, size = 'default', flush = false }) {
  const screens = Grid.useBreakpoint()
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={screens.sm ? ({ wide: 720, xl: 960 }[size] || 448) : '100%'}
      closable={false}
      maskClosable={!hasForm}
      rootClassName={flush ? 'ds-panel ds-panel--flush' : 'ds-panel'}
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
