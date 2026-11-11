// Quy tắc dữ liệu của hồ sơ thuyền viên cho antd Form. Bản sao phía máy chủ: backend/src/utils/field_rules.js (sửa một bên thì sửa cả hai).
// Ô trống luôn hợp lệ; antd bỏ qua rule pattern khi ô trống.

export const digitsOnly = (v) => (typeof v === 'string' ? v.replace(/\D/g, '') : v)
// Chặn dấu âm và ký tự lạ khi gõ số có thể có .5 (size giày).
export const decimalOnly = (v) => (typeof v === 'string' ? v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') : v)
export const upperAlnum = (v) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : v)

const pattern = (regex, message) => [{ pattern: regex, message }]

const phoneRule = (message, rejectAllZeros = false) => ({
  validator: (_, v) => {
    const s = String(v ?? '').trim()
    if (!s) return Promise.resolve()
    const digits = s.replace(/\D/g, '')
    const validFormat = /^\+?[\d\s.\-()]{8,20}$/.test(s) && digits.length >= 8 && digits.length <= 15
    const allZeros = rejectAllZeros && /^0+$/.test(digits)
    return validFormat && !allZeros ? Promise.resolve() : Promise.reject(new Error(message))
  },
})

export const fieldRules = {
  idNumber: pattern(/^(?!0+$)(\d{9}|\d{12})$/, 'Số CCCD không hợp lệ: gồm 12 chữ số (CMND cũ 9 chữ số) và không được toàn số 0'),
  passport: pattern(/^[A-Z0-9]{6,20}$/i, 'Số hộ chiếu gồm 6–20 chữ và số'),
  seamanBook: pattern(/^[A-Z0-9][A-Z0-9\-/ ]{2,29}$/i, 'Số sổ thuyền viên gồm 3–30 chữ, số hoặc dấu - /'),
  shoe: [
    ...pattern(/^\d{2}(\.5)?$/, 'Size giày là số từ 30 đến 55 (VD: 42 hoặc 42.5)'),
    { validator: (_, v) => (!v || (Number(v) >= 30 && Number(v) <= 55) ? Promise.resolve() : Promise.reject(new Error('Size giày là số từ 30 đến 55'))) },
  ],
  pants: pattern(/^[0-9A-Za-z/. ]{1,10}$/, 'Size quần chỉ gồm số, chữ, dấu / và dấu chấm (VD: 30 / 32)'),
  phone: [phoneRule('Số điện thoại gồm 8–15 chữ số')],
  email: [{ type: 'email', message: 'Email chưa đúng dạng' }],
  bankAccount: pattern(/^\d{6,30}$/, 'Số tài khoản gồm 6–30 chữ số'),
  socialInsurance: pattern(/^\d{10}$/, 'Số BHXH gồm 10 chữ số'),
  personName: pattern(/^[^\d]+$/, 'Không chứa chữ số'),
}

// Ngày: không ở tương lai.
export const notFuture = (label) => ({
  validator: (_, v) => (!v || !v.isAfter(new Date(), 'day') ? Promise.resolve() : Promise.reject(new Error(`${label} không được sau hôm nay`))),
})

// Ngày này phải từ ngày kia trở đi (đọc ngày kia qua form).
export const notBefore = (otherName, message) => ({ getFieldValue }) => ({
  validator: (_, v) => {
    const other = getFieldValue(otherName)
    return !v || !other || !v.isBefore(other, 'day') ? Promise.resolve() : Promise.reject(new Error(message))
  },
})

// Đối tác, tàu, danh mục (bản sao của backend/src/utils/field_rules.js).
export const ownerRules = {
  companyPhone: [phoneRule('Số điện thoại công ty không hợp lệ: gồm 8–15 chữ số và không được toàn số 0', true)],
  taxId: [
    ...pattern(/^[0-9A-Za-z\-. ]{5,50}$/, 'Mã số thuế gồm 5–50 chữ, số hoặc dấu - .'),
    {
      validator: (_, value) => /^0+$/.test(String(value ?? '').replace(/[\s.-]/g, ''))
        ? Promise.reject(new Error('Mã số thuế không hợp lệ: không được toàn số 0'))
        : Promise.resolve(),
    },
  ],
  phone: [phoneRule('Số điện thoại gồm 8–15 chữ số')],
  website: [{
    validator: (_, value) => {
      const website = String(value ?? '').trim()
      if (!website) return Promise.resolve()
      const message = 'URL không hợp lệ. Website phải dùng http:// hoặc https:// và có cổng hợp lệ.'
      if (!/^https?:\/\/[^\s/]+\.[^\s/]+\S*$/i.test(website)) return Promise.reject(new Error(message))
      try {
        // Bộ phân tích URL kiểm tra cả hostname và cổng, kể cả cổng vượt giới hạn.
        new URL(website)
        return Promise.resolve()
      } catch {
        return Promise.reject(new Error(message))
      }
    },
  }],
}

export const vesselRules = {
  mmsi: pattern(/^(?!0{9}$)\d{9}$/, 'MMSI không hợp lệ: phải gồm 9 chữ số và không được toàn số 0'),
  callSign: pattern(/^[A-Z0-9]{3,10}$/i, 'Call Sign gồm 3–10 chữ và số'),
  // Số dương không quá `max`; zeroIsEmpty=false để kiểm cả giá trị 0.
  positive: (label, max, zeroIsEmpty = true) => [{ validator: (_, v) => (v == null || v === '' || (zeroIsEmpty && Number(v) === 0) || (Number(v) > 0 && Number(v) <= max) ? Promise.resolve() : Promise.reject(new Error(`${label} phải là số dương, không quá ${max.toLocaleString('en-US')}`))) }],
  netNotOverGross: ({ getFieldValue }) => ({
    validator: (_, v) => (!(Number(v) > 0) || !(Number(getFieldValue('gross_tonnage')) > 0) || Number(v) <= Number(getFieldValue('gross_tonnage')) ? Promise.resolve() : Promise.reject(new Error('NT không được lớn hơn GRT'))),
  }),
}

export const masterRules = {
  code: pattern(/^[A-Za-z0-9_.-]{1,30}$/, 'Mã gồm 1–30 chữ, số hoặc dấu _ . -'),
  unLocode: pattern(/^[A-Za-z]{2}[A-Za-z0-9]{3}$/, 'UN/LOCODE gồm 5 ký tự: 2 chữ rồi 3 chữ hoặc số'),
}
export const blank = (label) => ({ whitespace: true, message: `${label} không được để trống` })
export const upperCode = (v) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9_.-]/g, '').toUpperCase() : v)
