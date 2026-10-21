// Khuôn từng loại giấy tờ AI đọc được: ô xếp đúng thứ tự trên giấy.
// target: cột hồ sơ seafarer nhận giá trị khi "Đưa vào hồ sơ" (kiểu date thì đổi dd/mm/yyyy sang ISO).
// Loại giấy không có target thì chỉ lưu kết quả đọc, chưa đẩy vào hồ sơ.
// optional: ô không bắt buộc duyệt; tự được chấp nhận khi các ô còn lại đã duyệt xong.
// confirm: ô sai một ký tự là sai pháp lý (số dài): không chấp nhận âm thầm khi duyệt nhanh, người duyệt chạm một lần.

const f = (key, label, english, extra = {}) => ({ key, label, english, ...extra })

const DOC_TYPES = {
  seaman_book_info: {
    label: 'Sổ thuyền viên · Trang thông tin',
    title: ['SỔ THUYỀN VIÊN', 'Seaman\'s book'],
    fields: [
      f('no', 'Số', 'No.', { target: 'seaman_book_number' }),
      f('name', 'Họ và tên thuyền viên', 'Full name'),
      f('sex', 'Giới tính', 'Sex', { half: true }),
      f('dob', 'Ngày sinh', 'Date of birth', { half: true, date: true, target: 'date_of_birth' }),
      f('pob', 'Nơi sinh', 'Place of birth'),
      f('nat', 'Quốc tịch', 'Nationality'),
      // Không tự đẩy vào hồ sơ: ô này là CMND hay hộ chiếu do người duyệt quyết định.
      f('id', 'Số GCMND hoặc hộ chiếu', 'ID card No or passport'),
      f('issued', 'Nơi cấp, ngày cấp', 'Place, date'),
    ],
  },
  seaman_book_duty: {
    label: 'Sổ thuyền viên · Bố trí chức danh',
    title: ['BỐ TRÍ CHỨC DANH', 'Duties Arrangement'],
    fields: [
      f('ship', 'Tên tàu', 'Ship\'s name'),
      f('type', 'Loại tàu', 'Type of ship', { half: true }),
      f('flag', 'Quốc tịch', 'Nationality', { half: true }),
      f('gt', 'Tổng dung tích', 'Gross tonnage'),
      f('kw', 'Tổng công suất máy chính', 'Main engine\'s power'),
      f('owner', 'Chủ tàu', 'Shipowner'),
      f('rank', 'Chức danh', 'Capacity', { half: true }),
      f('coc', 'Số GCNKNCM', 'No. of COC', { half: true, confirm: true }),
      f('onPort', 'Cảng xuống tàu', 'Port of embarkation', { half: true }),
      f('onDate', 'Ngày xuống tàu', 'Date of embarkation', { half: true, date: true }),
      f('offPort', 'Cảng rời tàu', 'Port of disembarkation', { half: true }),
      f('offDate', 'Ngày rời tàu', 'Date of disembarkation', { half: true, date: true }),
    ],
  },
  passport: {
    label: 'Hộ chiếu',
    title: ['HỘ CHIẾU', 'Passport'],
    fields: [
      f('no', 'Số hộ chiếu', 'Passport No.', { target: 'passport_number' }),
      f('name', 'Họ và tên', 'Full name'),
      f('dob', 'Ngày sinh', 'Date of birth', { half: true, date: true }),
      f('sex', 'Giới tính', 'Sex', { half: true }),
      f('issuedOn', 'Ngày cấp', 'Date of issue', { half: true, date: true, target: 'passport_issued_date' }),
      f('valid', 'Có giá trị đến', 'Date of expiry', { half: true, date: true }),
      f('pob', 'Nơi sinh', 'Place of birth', { half: true, optional: true }),
      f('nat', 'Quốc tịch', 'Nationality', { half: true, optional: true }),
    ],
  },
  // Căn cước công dân: chỉ dùng cho nút quét ở form thêm thuyền viên (không đi qua duyệt giấy).
  national_id: {
    label: 'Căn cước công dân',
    title: ['CĂN CƯỚC CÔNG DÂN', 'Citizen Identity Card'],
    fields: [
      f('no', 'Số', 'No.'),
      f('name', 'Họ và tên', 'Full name'),
      f('dob', 'Ngày sinh', 'Date of birth', { half: true, date: true }),
      f('sex', 'Giới tính', 'Sex', { half: true }),
      f('origin', 'Quê quán', 'Place of origin', { optional: true }),
      f('residence', 'Nơi thường trú', 'Place of residence', { optional: true }),
      f('issuedOn', 'Ngày cấp', 'Date of issue', { half: true, date: true, optional: true }),
      f('issuedPlace', 'Nơi cấp', 'Place of issue', { half: true, optional: true }),
    ],
  },
  // Bằng tốt nghiệp phổ thông / trung cấp / cao đẳng / đại học: chỉ dùng cho nút quét ở form.
  diploma: {
    label: 'Bằng tốt nghiệp',
    title: ['BẰNG TỐT NGHIỆP', 'Diploma'],
    fields: [
      f('level', 'Trình độ', 'Level'),
      f('school', 'Trường', 'Institution'),
      f('major', 'Chuyên ngành', 'Major', { optional: true }),
    ],
  },
  certificate: {
    label: 'Chứng chỉ huấn luyện',
    title: ['GIẤY CHỨNG NHẬN HUẤN LUYỆN', 'Certificate of proficiency'],
    certificate: true,
    fields: [
      f('typeCode', 'Loại chứng chỉ trong danh mục', 'Certificate type', { half: true }),
      f('nameRaw', 'Tên chứng chỉ trên giấy', 'Certificate title', { optional: true }),
      f('valid', 'Có giá trị đến', 'Valid until', { half: true, date: true }),
      f('noExpiry', 'Không thời hạn', 'No expiry', { half: true }),
      f('no', 'Giấy chứng nhận số', 'Certificate No', { half: true, optional: true }),
      f('issuedOn', 'Cấp ngày', 'Issued on', { half: true, date: true, optional: true }),
      f('issuer', 'Nơi cấp', 'Issued by', { optional: true }),
      f('holder', 'Tên người trong giấy', 'Holder name', { optional: true }),
    ],
  },
  vaccination: {
    label: 'Giấy tiêm chủng quốc tế',
    title: ['GIẤY CHỨNG NHẬN TIÊM CHỦNG QUỐC TẾ', 'International certificate of vaccination'],
    fields: [
      f('name', 'Chứng nhận (tên)', 'This is to certify that'),
      f('disease', 'Bệnh', 'Against'),
      f('vaccine', 'Nhà sản xuất, số lô', 'Manufacturer, batch no.'),
      f('from', 'Hiệu lực từ', 'Valid from', { half: true, date: true }),
      f('to', 'Đến', 'Until', { half: true, date: true }),
    ],
  },
}

const DOC_STATUS = {
  READING: 'READING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PUBLISHED: 'PUBLISHED',
  SKIPPED: 'SKIPPED', // giấy loại "Khác": chỉ lưu kèm hồ sơ, không đọc
}

// Ô AI đề xuất: PROPOSED (đọc được), UNKNOWN (không có trên giấy), DATE_AMBIGUOUS (ngày viết tay chưa chắc).
const AI_STATES = ['PROPOSED', 'UNKNOWN', 'DATE_AMBIGUOUS']
const TODO_STATES = AI_STATES
const DONE_STATES = ['ACCEPTED', 'EDITED', 'UNKNOWN_KEPT', 'REJECTED']

// Loại "Khác": không có khuôn đọc.
const OTHER_TYPE = 'other'

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_BYTES = 25 * 1024 * 1024

module.exports = { DOC_TYPES, DOC_STATUS, OTHER_TYPE, AI_STATES, TODO_STATES, DONE_STATES, ALLOWED_MIME, MAX_FILE_BYTES }
