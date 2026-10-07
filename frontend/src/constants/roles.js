// Vai trò và tên hiển thị trong MCAH. Mã giữ nguyên trong DB; chỉ đổi tên hiển thị.
export const ROLES = ['admin', 'operator', 'reviewer', 'manning_agent', 'training_center', 'seafarer']

export const ROLE_LABELS = {
  admin: 'Quản trị',
  operator: 'Crewing Officer',
  reviewer: 'Người duyệt',
  manning_agent: 'Manning agent',
  training_center: 'Trung tâm đào tạo',
  seafarer: 'Thuyền viên',
}

export const ROLE_DESCRIPTIONS = {
  admin: 'Toàn quyền, quản lý tài khoản',
  operator: 'Tải giấy tờ, duyệt hồ sơ, tạo bộ giấy',
  reviewer: 'Duyệt bộ giấy trước khi gửi ký',
  manning_agent: 'Xem hồ sơ thuyền viên của agency',
  training_center: 'Quản lý khoá học',
  seafarer: 'Cổng tự phục vụ của thuyền viên',
}
