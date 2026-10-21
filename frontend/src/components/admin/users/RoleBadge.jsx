// Vai trò không phải trạng thái: một tông trung tính cho mọi vai (M7), chữ nói vai gì.
// Tài khoản chưa có vai trò (`role` null) hiện nhãn cảnh báo, vì tài khoản đó đăng nhập được nhưng không có quyền nào.
export default function RoleBadge({ role }) {
  if (!role) return <span className="ds-role ds-role--none">Chưa có vai trò</span>
  return <span className="ds-role">{role.name}</span>
}
