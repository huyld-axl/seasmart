// Mã yêu cầu cho form thêm mới (docs/mcah-ke-hoach-desktop-gd3.md 3.4): một mã cho mỗi lần mở form, gửi kèm POST
// tạo mới; bấm lại sau khi mạng đứt giữa chừng thì máy chủ trả bản đã tạo thay vì tạo bản thứ hai.
export const newRequestKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)
export const keyHeader = (key) => ({ headers: { 'Idempotency-Key': key } })
