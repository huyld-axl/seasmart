// Màn A3 Duyệt giấy tờ: mỗi loại giấy một khuôn, ô xếp đúng thứ tự trên giấy để mắt dò ngang được.
// Chưa có backend AI đọc giấy tờ: DEMO_DOCS là dữ liệu mẫu (giả), dùng tới khi nối API.

// Trạng thái một ô: còn phải xem (todo) hay đã quyết (done).
export const TODO_STATES = ['PROPOSED', 'UNKNOWN', 'DATE_AMBIGUOUS']
export const DONE_STATES = ['ACCEPTED', 'EDITED', 'UNKNOWN_KEPT', 'REJECTED']

// [key, nhãn, nhãn tiếng Anh, chữ trên giấy, giá trị AI đề xuất, trạng thái, 'half' nếu nửa dòng]
const f = (key, label, english, raw, value, state, width) => ({ key, label, english, raw, value, state, half: width === 'half', note: null })

export const DEMO_DOCS = [
  {
    key: 'so-23',
    label: 'Sổ thuyền viên · Trang thông tin',
    file: 'so-thuyen-vien-trang-2-3.jpg',
    page: 'Trang 2–3',
    title: ['SỔ THUYỀN VIÊN', "Seaman's book"],
    photo: true,
    stamps: ['CHI CỤC TRƯỞNG'],
    fields: [
      f('no', 'Số', 'No.', 'VN000123-01', 'VN000123-01', 'ACCEPTED'),
      f('name', 'Họ và tên thuyền viên', 'Full name', 'TRẦN MINH KHÔI', 'Trần Minh Khôi', 'ACCEPTED'),
      f('sex', 'Giới tính', 'Sex', 'Nam / Male', 'Nam', 'ACCEPTED', 'half'),
      f('dob', 'Ngày sinh', 'Date of birth', '13.03.1990', '13/03/1990', 'ACCEPTED', 'half'),
      f('pob', 'Nơi sinh', 'Place of birth', 'Hải Dương', 'Hải Dương', 'ACCEPTED'),
      f('nat', 'Quốc tịch', 'Nationality', 'VIỆT NAM', 'Việt Nam', 'ACCEPTED'),
      f('id', 'Số GCMND hoặc hộ chiếu', 'ID card No or passport', '000000123', '000000123', 'PROPOSED'),
      f('issued', 'Nơi cấp, ngày cấp', 'Place, date', 'Hải Phòng, 02 . 02 . 2016', 'Hải Phòng · 02/02/2016', 'ACCEPTED'),
    ],
  },
  {
    key: 'so-45',
    label: 'Sổ thuyền viên · Bố trí chức danh',
    file: 'so-thuyen-vien-trang-4-5.jpg',
    page: 'Trang 4–5',
    title: ['BỐ TRÍ CHỨC DANH', 'Duties Arrangement'],
    stamps: ['CHỦ TÀU · Shipowner', 'THUYỀN TRƯỞNG · Master'],
    fields: [
      f('ship', 'Tên tàu', "Ship's name", 'HALONG SPIRIT', 'MV Halong Spirit', 'ACCEPTED'),
      { ...f('type', 'Loại tàu', 'Type of ship', '', '', 'UNKNOWN', 'half'), note: 'Ô Loại tàu trên sổ để trống.' },
      f('flag', 'Quốc tịch', 'Nationality', 'VN', 'Việt Nam', 'ACCEPTED', 'half'),
      f('gt', 'Tổng dung tích', 'Gross tonnage', '300', '300 GT', 'PROPOSED'),
      f('kw', 'Tổng công suất máy chính', "Main engine's power", '700', '700 kW', 'PROPOSED'),
      f('owner', 'Chủ tàu', 'Shipowner', 'CHỦ TÀU DEMO A', 'Chủ tàu Demo A', 'PROPOSED'),
      f('rank', 'Chức danh', 'Capacity', 'Thợ máy', 'Thợ máy (Motorman)', 'PROPOSED', 'half'),
      f('coc', 'Số GCNKNCM', 'No. of COC', 'A00123.OSE', 'A00123.OSE', 'ACCEPTED', 'half'),
      f('assign', 'Ngày chủ tàu bố trí chức danh', 'Date of embarkation', '04 . 1 . 2016', '04/01/2016', 'ACCEPTED'),
      f('on', 'Tên cảng, ngày xuống tàu', 'Port, date of embarkation', 'HP  04 . 1 . 2016', 'Hải Phòng · 04/01/2016', 'ACCEPTED'),
      { ...f('off', 'Tên cảng, ngày rời tàu', 'Port, date of disembarkation', '14 . 7 . 2016', '14/07/2016', 'DATE_AMBIGUOUS'), note: 'Ngày viết tay, AI chưa chắc tháng 7 hay tháng 1. Tên cảng để trống trên sổ.' },
    ],
  },
  {
    key: 'coc',
    label: 'Chứng chỉ huấn luyện',
    file: 'anh-chung-chi-pccc.jpg',
    page: '1 trang',
    title: ['GIẤY CHỨNG NHẬN HUẤN LUYỆN NGHIỆP VỤ CHUYÊN MÔN', 'Certificate of proficiency'],
    photo: true,
    stamps: ['HIỆU TRƯỞNG · The Rector'],
    fields: [
      f('school', 'Nơi cấp', 'Issued by', 'TRƯỜNG HUẤN LUYỆN DEMO', 'Trường Huấn luyện Demo', 'PROPOSED'),
      f('name', 'Chứng nhận', 'Certifies that', 'TRẦN MINH KHÔI', 'Trần Minh Khôi', 'ACCEPTED'),
      f('dob', 'Sinh ngày', 'Date of birth', '13-03-1990', '13/03/1990', 'ACCEPTED', 'half'),
      f('nat', 'Quốc tịch', 'Nationality', 'VIỆT NAM', 'Việt Nam', 'ACCEPTED', 'half'),
      f('course', 'Khoá huấn luyện', 'Training course', 'ADVANCED FIRE FIGHTING', 'Advanced Fire Fighting', 'PROPOSED'),
      f('reg', 'Theo quy tắc', 'Under Reg.', 'VI/3', 'STCW VI/3', 'ACCEPTED'),
      f('no', 'Giấy chứng nhận số', 'Certificate No', 'A0003.AF/DEMO', 'A0003.AF/DEMO', 'PROPOSED', 'half'),
      f('issuedOn', 'Cấp ngày', 'Issued on', '02-07-2025', '02/07/2025', 'PROPOSED', 'half'),
      f('valid', 'Có giá trị đến', 'Valid until', '02-07-2030', '02/07/2030', 'PROPOSED'),
    ],
  },
  {
    key: 'vac',
    label: 'Giấy tiêm chủng quốc tế',
    file: 'giay-tiem-chung.jpg',
    page: '1 trang',
    title: ['GIẤY CHỨNG NHẬN TIÊM CHỦNG QUỐC TẾ', 'International certificate of vaccination'],
    stamps: ['DẤU KIỂM DỊCH Y TẾ'],
    fields: [
      f('name', 'Chứng nhận (tên)', 'This is to certify that', 'TRAN MINH KHOI', 'Trần Minh Khôi', 'ACCEPTED'),
      f('yob', 'Năm sinh', 'Date of birth', '1990', '1990', 'ACCEPTED', 'half'),
      f('sex', 'Giới tính', 'Sex', 'M', 'Nam', 'ACCEPTED', 'half'),
      f('disease', 'Bệnh', 'Against', 'YELLOW FEVER', 'Sốt vàng', 'ACCEPTED'),
      f('vaccine', 'Nhà sản xuất, số lô', 'Manufacturer, batch no.', 'DEMO PHARMA · L 0000', 'Demo Pharma · L 0000', 'PROPOSED'),
      f('from', 'Hiệu lực từ', 'Valid from', '01/8/2016', '01/08/2016', 'ACCEPTED', 'half'),
      f('to', 'Đến', 'Until', '01/8/2026', '01/08/2026', 'PROPOSED', 'half'),
    ],
  },
]

// Hành động trên một ô: accept | edit (kèm giá trị) | reject | keepUnknown | undo.
export function applyAction(field, action, value) {
  switch (action) {
    case 'accept':
      return { ...field, state: field.value ? 'ACCEPTED' : 'UNKNOWN_KEPT', original: field.original ?? field }
    case 'edit': {
      const text = String(value ?? '').trim()
      if (!text) return field
      return { ...field, value: text, state: 'EDITED', original: field.original ?? field }
    }
    case 'reject':
      return { ...field, state: 'REJECTED', original: field.original ?? field }
    case 'keepUnknown':
      return { ...field, value: '', state: 'UNKNOWN_KEPT', original: field.original ?? field }
    case 'undo':
      return field.original ? { ...field.original } : field
    default:
      return field
  }
}

export function updateField(docs, docKey, fieldKey, action, value) {
  return docs.map((doc) => (doc.key !== docKey ? doc : {
    ...doc,
    fields: doc.fields.map((field) => (field.key === fieldKey ? applyAction(field, action, value) : field)),
  }))
}

export function progress(doc) {
  const done = doc.fields.filter((field) => DONE_STATES.includes(field.state)).length
  return { done, total: doc.fields.length, todo: doc.fields.length - done }
}

// Trạng thái giấy trong hàng chọn giấy: xong khi mọi ô đã quyết.
export function docStatus(doc) {
  return progress(doc).todo === 0 ? 'COMPLETED' : 'REVIEW_REQUIRED'
}

export function totalTodo(docs) {
  return docs.reduce((sum, doc) => sum + progress(doc).todo, 0)
}

// Ô kế tiếp cần xem sau ô đang chọn (để duyệt liền tay).
export function nextTodo(doc, fromKey) {
  const list = doc.fields
  const start = Math.max(0, list.findIndex((field) => field.key === fromKey))
  for (let step = 1; step <= list.length; step += 1) {
    const field = list[(start + step) % list.length]
    if (TODO_STATES.includes(field.state)) return field.key
  }
  return null
}
