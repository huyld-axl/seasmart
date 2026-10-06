// Bảng ánh xạ trạng thái DUY NHẤT của MCAH (D2, docs/mcah-ui-ux-design-plan.md mục 6).
// tone: neutral | success | warning | error (M7). mark: hình đầu badge, tách các trạng thái cùng tông.
export const STATUS = {
  document: {
    RECEIVED: { label: 'Đã nhận', tone: 'neutral', mark: 'ring' },
    PROCESSING: { label: 'Đang trích xuất', tone: 'neutral', mark: 'ring-dot' },
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
  seaService: {
    ONGOING: { label: 'Đang trên tàu', tone: 'success', mark: 'ring-dot' },
    OVERLAP: { label: 'Trùng thời gian', tone: 'warning', mark: 'overlap' },
  },
  export: {
    DRAFT: { label: 'Nháp', tone: 'neutral', mark: 'ring' },
    PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'warning', mark: 'ellipsis' },
    PUBLISHED: { label: 'Đã phát hành', tone: 'success', mark: 'check' },
    STALE: { label: 'Cần làm lại', tone: 'warning', mark: 'refresh' },
    REJECTED: { label: 'Bị trả lại', tone: 'error', mark: 'cross' },
  },
}

export const STATUS_GROUP_LABELS = {
  document: 'Tài liệu',
  field: 'Trường dữ liệu',
  vessel: 'Xác minh tàu',
  rule: 'Kết quả rule',
  readiness: 'Readiness',
  seaService: 'Sea service',
  export: 'Bản xuất',
}
