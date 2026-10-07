// Chỉ dùng ở môi trường dev: cho công cụ chụp, đo giao diện (probe.mjs) mở thẳng route cần đăng nhập
// bằng `?devToken=<JWT>`. Token vẫn là JWT thật, backend kiểm như thường. Vite bỏ khối này khi build
// production. File phải được import TRƯỚC App trong main.jsx, vì authStore đọc localStorage lúc nạp module.
if (import.meta.env.DEV) {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('devToken')

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      const user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        linked_entity_id: payload.linked_entity_id ?? null,
        linked_entity_type: payload.linked_entity_type ?? null,
      }
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    } catch {
      // Token hỏng thì bỏ qua, app tự chuyển về /login như thường.
    }
    url.searchParams.delete('devToken')
    window.history.replaceState(null, '', url)
  }
}
