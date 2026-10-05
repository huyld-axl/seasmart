/**
 * Script tạo file template seafarer_template.xlsx
 * Chạy 1 lần: node scripts/gen_template.js
 */
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

// 44 cột theo đúng thứ tự và tên (giữ nguyên dấu cách cuối để match norm() trong import.service)
// FIXED_IDX (0-based): 6=NGÀY BAY, 7=NGÀY NHẬP TÀU, 8=THỜI GIAN HĐ, 11=ngày cấp HC,
//   12=Lương hợp đồng, 14=Ngày cấp CMTND, 35=Ngày sinh người BL, 41=NGÀY RỜI TÀU,
//   42=NGÀY VỀ TỚI VIỆT NAM, 43=CHỨC DANH (tên tiếng Việt)
const HEADERS = [
  'STT', // 0
  'MÃ TV', // 1
  'HỌ VÀ TÊN', // 2
  'NGÀY SINH', // 3
  'HỘ CHIẾU', // 4
  'Số CMTND', // 5
  'NGÀY BAY', // 6  ← FIXED_IDX.CONTRACT_FLIGHT_DATE
  'NGÀY NHẬP TÀU', // 7  ← FIXED_IDX.CONTRACT_START_DATE
  'THỜI GIAN HĐ', // 8  ← FIXED_IDX.CONTRACT_DURATION
  'TÊN TÀU', // 9
  'KHỐI ', // 10 (dấu cách cuối — giữ nguyên)
  'ngày cấp', // 11 ← FIXED_IDX.PASSPORT_ISSUED_DATE (ngày cấp HC)
  'Lương hợp đồng', // 12 ← FIXED_IDX.CONTRACT_SALARY
  'NGÂN HÀNG', // 13
  'Ngày cấp', // 14 ← FIXED_IDX.NATIONAL_ID_ISSUED_DATE (ngày cấp CMTND)
  'Nơi cấp', // 15
  'SỐ ĐIỆN THOẠI ', // 16 (dấu cách cuối — giữ nguyên)
  'SỐ SỔ BHXH', // 17
  'THAM GIA BH (Y/N)', // 18
  'SỐ TÀI KHOẢN', // 19
  'CHỦ TK', // 20
  'QUÊ QUÁN-Xã', // 21
  'QUÊ QUÁN-huyện', // 22
  'QUÊ QUÁN-tỉnh', // 23
  'NƠI THƯỜNG TRÚ', // 24
  'TÌNH TRẠNG', // 25
  'SỐ CON', // 26
  'THÔNG TIN CON', // 27
  'TUỔI CON', // 28
  'Chiều cao', // 29
  'Cân nặng', // 30
  'Size áo', // 31
  'Size quần', // 32
  'NGƯỜI LIÊN LẠC', // 33
  'QUAN HỆ VỚI TV', // 34
  'Ngày tháng năm sinh của người bảo lãnh', // 35 ← FIXED_IDX.GUARANTOR_DOB
  'HỌ TÊN NGƯỜI BẢO LÃNH', // 36
  'CCCD/CMT', // 37
  'NGÀY CẤP', // 38
  'SỐ ĐIỆN THOẠI NGƯỜI BẢO LÃNH', // 39
  'CHỨC DANH', // 40
  'NGÀY RỜI TÀU', // 41 ← FIXED_IDX.CONTRACT_END_DATE
  'NGÀY VỀ TỚI VIỆT NAM', // 42 ← FIXED_IDX.CONTRACT_RETURN_DATE
  'CHỨC DANH', // 43 ← FIXED_IDX.RANK_NAME_VI (tên tiếng Việt)
]

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.aoa_to_sheet([HEADERS])

// Đặt độ rộng cột tối thiểu
ws['!cols'] = HEADERS.map(() => ({ wch: 20 }))

XLSX.utils.book_append_sheet(wb, ws, 'data')

const outPath = path.join(__dirname, '../public/templates/seafarer_template.xlsx')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
XLSX.writeFile(wb, outPath)

console.log('Template created:', outPath)
console.log('Columns:', HEADERS.length)
