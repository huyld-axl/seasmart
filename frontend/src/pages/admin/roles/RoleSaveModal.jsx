import { Button, Modal } from 'antd'
import { SCOPE_LABEL, totalChanges } from './roleMatrix'

const Chips = ({ list, tone }) =>
  list.map((p) => (
    <span key={p.code} className={`rm-chip rm-chip--${tone}`} title={p.module.label}>
      {p.module.label}: {p.name}
    </span>
  ))

// Tóm tắt trước khi lưu: mỗi vai trò một khối thêm / bỏ / đổi phạm vi.
export default function RoleSaveModal({ open, changes, saving, onBack, onConfirm }) {
  const accounts = changes.reduce((n, change) => n + change.role.user_count, 0)
  return (
    <Modal
      open={open}
      onCancel={onBack}
      width={640}
      destroyOnHidden
      title={
        <div>
          <div className="rm-modal-title">Lưu {totalChanges(changes)} thay đổi quyền?</div>
          <p className="rm-modal-desc">
            Áp dụng cho {accounts} tài khoản. Người đang đăng nhập nhận quyền mới ở lần tải trang
            tới.
          </p>
        </div>
      }
      footer={[
        <Button key="back" onClick={onBack}>
          Quay lại sửa
        </Button>,
        <Button key="ok" type="primary" loading={saving} onClick={onConfirm}>
          Lưu thay đổi
        </Button>,
      ]}
    >
      {changes.map(({ role, add, rm, scope }) => (
        <div className="rm-diff" key={role.id}>
          <div className="rm-diff__head">
            <b>{role.name}</b>
            <span>{role.user_count} tài khoản</span>
          </div>
          <div className="rm-diff__rows">
            {add.length ? (
              <div className="rm-diff__row">
                <span>Thêm</span>
                <Chips list={add} tone="add" />
              </div>
            ) : null}
            {rm.length ? (
              <div className="rm-diff__row">
                <span>Bỏ</span>
                <Chips list={rm} tone="rm" />
              </div>
            ) : null}
            {scope.length ? (
              <div className="rm-diff__row">
                <span>Phạm vi</span>
                {scope.map((s) => (
                  <span key={s.module.key} className="rm-chip rm-chip--scope">
                    {s.module.label}: {SCOPE_LABEL[s.to]}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </Modal>
  )
}
