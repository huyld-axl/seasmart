// Câu báo lỗi từ phản hồi API: backend trả { error: "câu tiếng Việt" } cho mọi lỗi 4xx/5xx.
export default function apiErrorText(error, fallback) {
  return error?.response?.data?.error || error?.response?.data?.message || fallback
}
