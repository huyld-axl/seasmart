import { Button, Modal } from 'antd'
import RoleIcon from './RoleIcon'

// Xoá vai trò: còn tài khoản thì chỉ cảnh báo (kèm nút xem tài khoản); không còn thì xác nhận xoá.
export default function RoleDeleteModal({ role, deleting, onClose, onConfirm, onViewUsers }) {
  if (!role) return null
  const blocked = role.user_count > 0
  return (
    <Modal
      open
      onCancel={onClose}
      width={520}
      destroyOnHidden
      closable={false}
      title={
        <div className="rm-modal-head">
          <span className={blocked ? 'rm-modal-icon' : 'rm-modal-icon rm-modal-icon--danger'}>
            <RoleIcon name={blocked ? 'alert' : 'trash'} />
          </span>
          <div>
            <div className="rm-modal-title">
              {blocked ? `Chưa xoá được ${role.name}` : `Xoá vai trò ${role.name}?`}
            </div>
            <p className="rm-modal-desc">
              {blocked ? (
                <>
                  Còn <b>{role.user_count} tài khoản</b> đang dùng vai trò này. Chuyển họ sang vai
                  trò khác ở tab Tài khoản rồi xoá lại.
                </>
              ) : (
                'Không còn tài khoản nào dùng vai trò này. Xoá rồi không khôi phục được.'
              )}
            </p>
          </div>
        </div>
      }
      footer={
        blocked
          ? [
              <Button key="close" onClick={onClose}>
                Đóng
              </Button>,
              <Button key="users" type="primary" onClick={() => onViewUsers(role)}>
                Xem {role.user_count} tài khoản
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose}>
                Huỷ
              </Button>,
              <Button
                key="ok"
                type="primary"
                danger
                loading={deleting}
                onClick={() => onConfirm(role)}
              >
                Xoá vai trò
              </Button>,
            ]
      }
    />
  )
}
