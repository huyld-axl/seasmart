// Luật mật khẩu: máy chủ kiểm lại cùng luật này. Luật hiện sẵn dưới ô, đổi màu khi đạt.
export function passwordRules(password = '', email = '') {
  return [
    { key: 'length', label: 'Từ 8 ký tự trở lên', ok: password.length >= 8 },
    { key: 'mix', label: 'Có cả chữ và số', ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    {
      key: 'email',
      label: 'Không trùng email',
      ok: password.length > 0 && password.toLowerCase() !== String(email).toLowerCase(),
    },
  ]
}

export const isPasswordValid = (password, email) => passwordRules(password, email).every((r) => r.ok)
