// Chỉ dùng tên ràng buộc đã biết; không gửi SQL, detail hay giá trị nhạy cảm ra client.
const DUPLICATE_FIELDS = {
  country_code: 'Mã quốc gia',
  rank_code: 'Mã chức danh',
  certificate_type_code: 'Mã loại chứng chỉ',
  contract_type_code: 'Mã loại hợp đồng',
  course_type_code: 'Mã loại khóa học',
  vessel_type_code: 'Mã loại tàu',
  manning_agent_code: 'Mã đơn vị cung ứng',
  ship_owner_code: 'Mã đối tác',
  training_center_code: 'Mã trung tâm đào tạo',
  port_un_locode: 'Mã cảng (UN/LOCODE)',
  user_email: 'Email',
  vessel_imo_number: 'Số IMO',
  role_code_uq: 'Mã vai trò',
  role_name_uq: 'Tên vai trò',
  voyage_code_key: 'Mã chuyến tàu',
  seafarer_voyage_code_key: 'Mã chuyến tàu',
  opportunity_code_key: 'Mã cơ hội',
  seafarer_contract_contract_number_key: 'Số hợp đồng',
  contract_bill_code_key: 'Mã yêu cầu thanh toán',
}

function errorHandler(error, request, reply) {
  // Giữ nguyên thông báo nghiệp vụ cụ thể do service đã xử lý.
  if (!error.statusCode && error.code === '23505') {
    const field = DUPLICATE_FIELDS[error.constraint]
    return reply.code(409).send({
      error: field
        ? `${field} đã tồn tại. Vui lòng nhập giá trị khác.`
        : 'Dữ liệu bị trùng với bản ghi đã có. Vui lòng kiểm tra lại thông tin.',
    })
  }
  if (!error.statusCode && error.code === '23503') {
    return reply.code(409).send({
      error: request.method === 'DELETE'
        ? 'Không thể xóa vì bản ghi đang được sử dụng ở dữ liệu khác.'
        : 'Dữ liệu liên quan không còn tồn tại hoặc đã thay đổi. Vui lòng tải lại trang và chọn lại.',
    })
  }
  const statusCode = error.statusCode || 500
  if (statusCode >= 500) {
    request.log.error({ err: error, url: request.url, method: request.method }, 'Internal server error')
    return reply.code(500).send({ error: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau' })
  }
  return reply.code(statusCode).send({
    error: error.message || 'Yêu cầu không hợp lệ',
    ...(error.code && /^[A-Z_]+$/.test(error.code) ? { code: error.code } : {}),
    ...(error.conflict ? { conflict: error.conflict } : {}),
    ...(error.blocked_bills ? { blocked_bills: error.blocked_bills } : {}),
  })
}

module.exports = { errorHandler }
