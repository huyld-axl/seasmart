// Bảng ánh xạ trạng thái DUY NHẤT của MCAH (D2, docs/mcah-ui-ux-design-plan.md mục 6).
// tone: neutral | success | warning | error (M7). mark: hình đầu badge, tách các trạng thái cùng tông.
export const STATUS = {
  document: {
    RECEIVED: { label: 'Đã nhận', tone: 'neutral', mark: 'ring' },
    PROCESSING: { label: 'Đang trích xuất', tone: 'neutral', mark: 'ring-dot' },
    READING: { label: 'AI đang đọc', tone: 'neutral', mark: 'ring-dot' },
    PUBLISHED: { label: 'Đã vào hồ sơ', tone: 'success', mark: 'check' },
    SLOW: { label: 'Chậm', tone: 'warning', mark: 'clock' },
    REVIEW_REQUIRED: { label: 'Chờ duyệt', tone: 'warning', mark: 'ellipsis' },
    COMPLETED: { label: 'Đã xong', tone: 'success', mark: 'check' },
    FAILED: { label: 'Lỗi trích xuất', tone: 'error', mark: 'cross' },
  },
  field: {
    PROPOSED: { label: 'Đề xuất AI', tone: 'neutral', mark: 'ring-dot' },
    ACCEPTED: { label: 'Đã chấp nhận', tone: 'success', mark: 'check' },
    EDITED: { label: 'Đã sửa', tone: 'success', mark: 'edit' },
    UNKNOWN: { label: 'Không đọc được', tone: 'warning', mark: 'question' },
    UNKNOWN_KEPT: { label: 'Giữ UNKNOWN', tone: 'neutral', mark: 'lock' },
    DATE_AMBIGUOUS: { label: 'Ngày mơ hồ', tone: 'warning', mark: 'calendar' },
    REJECTED: { label: 'Từ chối', tone: 'error', mark: 'cross' },
  },
  vessel: {
    NOT_CHECKED: { label: 'Chưa đối chiếu', tone: 'neutral', mark: 'ring' },
    VERIFIED: { label: 'Đã đối chiếu', tone: 'success', mark: 'check' },
    CONFLICT: { label: 'Không khớp', tone: 'error', mark: 'cross' },
    NOT_FOUND: { label: 'Không tìm thấy', tone: 'warning', mark: 'question' },
    UNAVAILABLE: { label: 'Không kiểm được', tone: 'neutral', mark: 'minus' },
  },
  rule: {
    PASS: { label: 'Đạt', tone: 'success', mark: 'check' },
    FAIL: { label: 'Không đạt', tone: 'error', mark: 'cross' },
    UNKNOWN: { label: 'Chưa đủ dữ liệu', tone: 'warning', mark: 'question' },
    NOT_APPLICABLE: { label: 'Không áp dụng', tone: 'neutral', mark: 'minus' },
  },
  readiness: {
    READY_IN_SCOPE: { label: 'Sẵn sàng (phạm vi MVP)', tone: 'success', mark: 'check' },
    NEEDS_REVIEW: { label: 'Cần xem lại', tone: 'warning', mark: 'ellipsis' },
    BLOCKED: { label: 'Bị chặn', tone: 'error', mark: 'cross' },
  },
  // Tài khoản đăng nhập: máy chủ trả `status` (user.status).
  account: {
    ACTIVE: { label: 'Hoạt động', tone: 'success', mark: 'check' },
    PENDING: { label: 'Chờ kích hoạt', tone: 'warning', mark: 'clock' },
    LOCKED: { label: 'Đã khoá', tone: 'neutral', mark: 'lock' },
  },
  seaService: {
    ONGOING: { label: 'Đang trên tàu', tone: 'success', mark: 'ring-dot' },
    OVERLAP: { label: 'Trùng thời gian', tone: 'warning', mark: 'overlap' },
  },
  // Bộ giấy tờ xuất (nhóm C đã chốt: đơn vị xuất là bộ giấy, có bước ký)
  export: {
    DRAFT: { label: 'Nháp', tone: 'neutral', mark: 'ring' },
    SIGNING: { label: 'Đang ký', tone: 'warning', mark: 'edit' },
    DONE: { label: 'Đã xong', tone: 'success', mark: 'check' },
    PUBLISHED: { label: 'Đã phát hành', tone: 'success', mark: 'check' },
    STALE: { label: 'Cần làm lại', tone: 'warning', mark: 'refresh' },
  },
  signature: {
    SIGNED: { label: 'Đã ký', tone: 'success', mark: 'check' },
    WAITING: { label: 'Chờ ký', tone: 'warning', mark: 'clock' },
    BY_HAND: { label: 'Ký tay khi in', tone: 'neutral', mark: 'edit' },
  },
  // Khoá theo cột seafarer.status trong DB.
  crew: {
    ON_VESSEL: { label: 'Đang trên tàu', tone: 'success', mark: 'ring-dot' },
    AVAILABLE: { label: 'Ở bờ', tone: 'info', mark: 'ring' },
    INACTIVE: { label: 'Tạm ngưng', tone: 'neutral', mark: 'minus' },
  },
  // Cơ hội: trạng thái hiển thị (opportunity.display_status), tính từ trạng thái lưu và ứng viên.
  opportunity: {
    NEW: { label: 'Mới', tone: 'neutral', mark: 'ring' },
    PICKING: { label: 'Đang chọn ứng viên', tone: 'warning', mark: 'ellipsis' },
    WAITING: { label: 'Chờ kết quả', tone: 'warning', mark: 'clock' },
    OWNER_SELECTED: { label: 'Chủ tàu đã chọn', tone: 'success', mark: 'ring-dot' },
    WON: { label: 'Đã chốt', tone: 'success', mark: 'check' },
    LOST: { label: 'Không thành', tone: 'error', mark: 'cross' },
    CANCELLED: { label: 'Huỷ', tone: 'neutral', mark: 'minus' },
  },
  // Ứng viên của cơ hội (opportunity_candidate.status).
  candidate: {
    PICKED: { label: 'Trong danh sách', tone: 'neutral', mark: 'ring' },
    PLACED: { label: 'Được chốt', tone: 'success', mark: 'check' },
    NOT_SELECTED: { label: 'Không được chọn', tone: 'neutral', mark: 'minus' },
    REMOVED: { label: 'Đã bỏ', tone: 'neutral', mark: 'minus' },
  },
  // Chuyến: một thuyền viên đi một tàu (seafarer_voyage.status).
  voyage: {
    ONBOARD: { label: 'Đang trên tàu', tone: 'success', mark: 'ring-dot' },
    LEFT: { label: 'Đã rời tàu', tone: 'neutral', mark: 'ring' },
  },
  // Hợp đồng thuyền viên (seafarer_contract.status).
  contract: {
    DRAFT: { label: 'Nháp', tone: 'neutral', mark: 'edit' },
    PENDING: { label: 'Chờ duyệt', tone: 'warning', mark: 'clock' },
    REJECTED: { label: 'Bị từ chối', tone: 'error', mark: 'cross' },
    ACTIVE: { label: 'Hiệu lực', tone: 'success', mark: 'check' },
    ENDED: { label: 'Hết hạn', tone: 'neutral', mark: 'ring' },
  },
  // Yêu cầu thanh toán: display_status do máy chủ tính từ ngày chốt sổ và hạn thanh toán.
  bill: {
    UPCOMING: { label: 'Chưa đến kỳ', tone: 'neutral', mark: 'ring' },
    TO_SEND: { label: 'Cần gửi', tone: 'warning', mark: 'send' },
    SENT: { label: 'Đã gửi', tone: 'neutral', mark: 'ring-dot' },
    OVERDUE: { label: 'Quá hạn', tone: 'error', mark: 'clock' },
    PAID: { label: 'Đã thu', tone: 'success', mark: 'check' },
  },
  // Trạng thái tàu (cột vessel.status) và đối tác (ship_owner.is_active).
  vesselStatus: {
    ACTIVE: { label: 'Hoạt động', tone: 'success', mark: 'check' },
    LAID_UP: { label: 'Nằm bờ', tone: 'neutral', mark: 'minus' },
    UNDER_CONSTRUCTION: { label: 'Đang đóng', tone: 'warning', mark: 'clock' },
    SCRAPPED: { label: 'Phá dỡ', tone: 'neutral', mark: 'cross' },
  },
  ownership: {
    CURRENT: { label: 'Đang sở hữu', tone: 'success', mark: 'check' },
    ENDED: { label: 'Đã kết thúc sở hữu', tone: 'neutral', mark: 'minus' },
  },
  partner: {
    ACTIVE: { label: 'Đang hợp tác', tone: 'success', mark: 'check' },
  },
  cert: {
    VALID: { label: 'Hiệu lực', tone: 'success', mark: 'check' },
    EXPIRING: { label: 'Sắp hết hạn', tone: 'warning', mark: 'clock' },
    EXPIRED: { label: 'Hết hạn', tone: 'error', mark: 'cross' },
    NO_EXPIRY: { label: 'Hiệu lực', tone: 'success', mark: 'check' },
    REPLACED: { label: 'Bản cũ', tone: 'neutral', mark: 'ring' },
  },
  // Tệp ở màn tải giấy tờ lên: người dùng chỉ cần biết đang xử lý hay xong (T1)
  upload: {
    RUNNING: { label: 'Đang xử lý', tone: 'neutral', mark: 'ring-dot' },
    DONE: { label: 'Xong', tone: 'success', mark: 'check' },
    OTHER: { label: 'Khác', tone: 'neutral', mark: 'ring' },
  },
}

export const STATUS_GROUP_LABELS = {
  document: 'Tài liệu',
  field: 'Trường dữ liệu',
  vessel: 'Xác minh tàu',
  rule: 'Kết quả rule',
  readiness: 'Readiness',
  seaService: 'Sea service',
  export: 'Bộ giấy tờ',
  signature: 'Chữ ký',
  crew: 'Tình trạng thuyền viên',
  opportunity: 'Cơ hội',
  candidate: 'Ứng viên',
  voyage: 'Chuyến tàu',
  contract: 'Hợp đồng',
  bill: 'Yêu cầu thanh toán',
  vesselStatus: 'Trạng thái tàu',
  ownership: 'Tình trạng sở hữu tàu',
  partner: 'Tình trạng đối tác',
  cert: 'Hạn giấy tờ',
  upload: 'Tệp tải lên',
}
