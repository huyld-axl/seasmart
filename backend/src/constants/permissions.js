// Danh mục quyền: nguồn duy nhất. Frontend lấy qua GET /roles/catalog, không chép sang frontend.
// Mã quyền dạng `<mục>.<việc>`. scoped: mục có phạm vi dữ liệu (cột created_by).
// Mỗi quyền: [việc, tên, mô tả?, { adminOnly }?]
const PERMISSION_MODULES = [
  { key: 'seafarer', group: 'Hồ sơ', label: 'Thuyền viên', scoped: true, permissions: [
    ['view', 'Xem danh sách và hồ sơ'],
    ['create', 'Thêm thuyền viên'],
    ['import', 'Nhập từ Excel'],
    ['update', 'Sửa hồ sơ', 'Gồm ảnh chân dung, gia quyến, tài khoản ngân hàng'],
    ['delete', 'Xoá thuyền viên'],
    ['docs', 'Tải giấy tờ và đọc bằng AI', 'CCCD, hộ chiếu, sổ thuyền viên, chứng chỉ'],
    ['sea', 'Sửa lịch sử đi tàu'],
  ] },
  { key: 'partner', group: 'Hồ sơ', label: 'Đối tác', permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Thêm đối tác'], ['update', 'Sửa đối tác'], ['delete', 'Xoá đối tác']] },
  { key: 'vessel', group: 'Hồ sơ', label: 'Tàu', permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Thêm tàu', 'Gồm tra cứu theo số IMO'], ['update', 'Sửa tàu'], ['delete', 'Xoá tàu']] },
  { key: 'export', group: 'Hồ sơ', label: 'Bản xuất', scoped: true, permissions: [['view', 'Xem bộ giấy'], ['create', 'Tạo và sửa bộ giấy'], ['download', 'Tải bản xuất', 'Word, Excel, PDF']] },
  { key: 'opportunity', group: 'Vận hành', label: 'Cơ hội', scoped: true, permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Tạo và nhân bản cơ hội'], ['update', 'Sửa cơ hội', 'Gồm hồ sơ yêu cầu, ứng viên, nhãn chủ tàu đã chọn'], ['send', 'Ghi nhận gửi chủ tàu'], ['close', 'Chốt người, đóng và huỷ cơ hội']] },
  { key: 'voyage', group: 'Vận hành', label: 'Chuyến tàu', scoped: true, permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Tạo chuyến tàu'], ['update', 'Sửa chuyến tàu', 'Gồm vị trí dự kiến và budget'], ['delete', 'Xoá chuyến tàu'], ['run', 'Bắt đầu và kết thúc chuyến']] },
  { key: 'contract', group: 'Vận hành', label: 'Hợp đồng', scoped: true, permissions: [['view', 'Xem danh sách và chi tiết'], ['create', 'Tạo hợp đồng'], ['update', 'Sửa hợp đồng nháp'], ['delete', 'Xoá hợp đồng nháp'], ['submit', 'Gửi duyệt và rút lại'], ['approve', 'Duyệt và từ chối']] },
  { key: 'bill', group: 'Vận hành', label: 'Yêu cầu thanh toán', scoped: true, permissions: [['view', 'Xem danh sách và chi tiết'], ['update', 'Sửa số tiền và ghi chú', 'Chỉ khi chưa gửi'], ['send', 'Đánh dấu đã gửi và thu hồi'], ['collect', 'Ghi nhận đã thu và huỷ ghi nhận']] },
  { key: 'catalog', group: 'Hệ thống', label: 'Danh mục', permissions: [['view', 'Xem danh mục', 'Chứng chỉ, loại tàu, loại hợp đồng, cảng, quốc gia'], ['update', 'Thêm và sửa'], ['delete', 'Xoá']] },
  { key: 'account', group: 'Hệ thống', label: 'Tài khoản', permissions: [['view', 'Xem danh sách tài khoản'], ['update', 'Thêm, sửa, khoá tài khoản', 'Gồm đặt lại mật khẩu và đổi vai trò'], ['delete', 'Xoá tài khoản']] },
  { key: 'role', group: 'Hệ thống', label: 'Vai trò và quyền', permissions: [['manage', 'Sửa vai trò và quyền', 'Chỉ Quản trị viên', { adminOnly: true }]] },
]

const ADMIN_ROLE_CODE = 'admin'
const SCOPED_MODULES = PERMISSION_MODULES.filter((m) => m.scoped).map((m) => m.key)

// Danh sách phẳng theo thứ tự danh mục.
const FLAT = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.map(([action, name, description, options]) => ({
    code: `${m.key}.${action}`,
    module: m.key,
    action,
    name,
    description: typeof description === 'string' ? description : null,
    adminOnly: Boolean(options?.adminOnly),
  }))
)

const ALL_PERMISSIONS = FLAT.map((p) => p.code)
const GRANTABLE_PERMISSIONS = FLAT.filter((p) => !p.adminOnly).map((p) => p.code)
const ORDER = new Map(ALL_PERMISSIONS.map((code, index) => [code, index]))
const GRANTABLE = new Set(GRANTABLE_PERMISSIONS)

// Lọc mã không có trong danh mục và mã chỉ Quản trị viên; tự thêm `<mục>.view` khi mục có quyền khác;
// bỏ trùng; sắp theo thứ tự danh mục.
function normalizePermissions(list) {
  const set = new Set((Array.isArray(list) ? list : []).filter((code) => GRANTABLE.has(code)))
  for (const code of [...set]) set.add(`${code.split('.')[0]}.view`)
  return [...set].filter((code) => GRANTABLE.has(code)).sort((a, b) => ORDER.get(a) - ORDER.get(b))
}

// Chỉ giữ khoá thuộc SCOPED_MODULES, giá trị 'all' | 'own'; bỏ khoá có giá trị 'all' (mặc định).
function normalizeScopes(obj) {
  const result = {}
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result
  for (const key of SCOPED_MODULES) {
    if (obj[key] === 'own') result[key] = 'own'
  }
  return result
}

// Dạng object cho GET /roles/catalog.
function catalogForClient() {
  return {
    modules: PERMISSION_MODULES.map((m) => ({
      key: m.key,
      group: m.group,
      label: m.label,
      scoped: Boolean(m.scoped),
      permissions: FLAT.filter((p) => p.module === m.key).map((p) => ({
        code: p.code,
        action: p.action,
        name: p.name,
        description: p.description,
        admin_only: p.adminOnly,
      })),
    })),
    total: ALL_PERMISSIONS.length,
  }
}

module.exports = {
  PERMISSION_MODULES,
  ADMIN_ROLE_CODE,
  ALL_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  SCOPED_MODULES,
  normalizePermissions,
  normalizeScopes,
  catalogForClient,
}
