// Khuôn từng loại giấy tờ AI đọc được: ô xếp đúng thứ tự trên giấy.
// target: cột hồ sơ seafarer nhận giá trị khi "Đưa vào hồ sơ" (kiểu date thì đổi dd/mm/yyyy sang ISO).
// Loại giấy không có target thì chỉ lưu kết quả đọc, chưa đẩy vào hồ sơ.

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
      f('id', 'Số GCMND hoặc hộ chiếu', 'ID card No or passport', { target: 'national_id' }),
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
      f('coc', 'Số GCNKNCM', 'No. of COC', { half: true }),
      f('on', 'Tên cảng, ngày xuống tàu', 'Port, date of embarkation'),
      f('off', 'Tên cảng, ngày rời tàu', 'Port, date of disembarkation'),
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
    ],
  },
  certificate: {
    label: 'Chứng chỉ huấn luyện',
    title: ['GIẤY CHỨNG NHẬN HUẤN LUYỆN', 'Certificate of proficiency'],
    certificate: true,
    fields: [
      f('school', 'Nơi cấp', 'Issued by'),
      f('name', 'Chứng nhận', 'Certifies that'),
      f('course', 'Khoá huấn luyện', 'Training course'),
      f('reg', 'Theo quy tắc', 'Under Reg.', { half: true }),
      f('typeCode', 'Loại chứng chỉ trong danh mục', 'Certificate type', { half: true }),
      f('no', 'Giấy chứng nhận số', 'Certificate No', { half: true }),
      f('issuedOn', 'Cấp ngày', 'Issued on', { half: true, date: true }),
      f('valid', 'Có giá trị đến', 'Valid until', { date: true }),
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
}

// Ô AI đề xuất: PROPOSED (đọc được), UNKNOWN (không có trên giấy), DATE_AMBIGUOUS (ngày viết tay chưa chắc).
const AI_STATES = ['PROPOSED', 'UNKNOWN', 'DATE_AMBIGUOUS']
const TODO_STATES = AI_STATES
const DONE_STATES = ['ACCEPTED', 'EDITED', 'UNKNOWN_KEPT', 'REJECTED']

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_BYTES = 25 * 1024 * 1024

module.exports = { DOC_TYPES, DOC_STATUS, AI_STATES, TODO_STATES, DONE_STATES, ALLOWED_MIME, MAX_FILE_BYTES }
