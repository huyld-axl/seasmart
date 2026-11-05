// Phần trước @ ngắn hơn mức này thì không dùng để so (tránh chặn nhầm). Máy chủ dùng cùng số: backend/src/services/user.service.js.
export const MIN_LOCAL_LENGTH = 3

// Mật khẩu có dùng email không: trùng cả email, hoặc chứa phần trước @ (từ 3 ký tự), không phân biệt hoa thường.
export function containsEmail(password = '', email = '') {
  const pass = String(password).toLowerCase()
  const mail = String(email).toLowerCase()
  if (!pass || !mail) return false
  const local = mail.split('@')[0]
  return pass === mail || pass.includes(mail) || (local.length >= MIN_LOCAL_LENGTH && pass.includes(local))
}

// Luật mật khẩu: máy chủ kiểm lại cùng luật này. Luật hiện sẵn dưới ô, đổi màu khi đạt.
export function passwordRules(password = '', email = '') {
  return [
    { key: 'length', label: 'Từ 8 ký tự trở lên', ok: password.length >= 8 },
    { key: 'mix', label: 'Có cả chữ và số', ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    {
      key: 'email',
      label: 'Không trùng hoặc chứa tên email',
      ok: password.length > 0 && !containsEmail(password, email),
    },
  ]
}

export const isPasswordValid = (password, email) => passwordRules(password, email).every((r) => r.ok)
