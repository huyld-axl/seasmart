// Build frontend/ cho app máy tính: dùng nguyên cấu hình của frontend, chỉ đổi biến môi trường và nơi ra bản build.
// Không đọc frontend/.env (tài khoản demo, địa chỉ dev): envDir trỏ vào thư mục không có tệp .env nào.
// Giao diện gọi API qua chính giao thức app:// bằng đường dẫn tương đối (axios từ chối URL tuyệt đối dạng app:);
// tiến trình chính chuyển tiếp sang Fastify ở cổng ngẫu nhiên.
// Trang hướng dẫn và ghi chú phát hành không gói vào app: app mở bản trên web (desktop/src/main.js, webPageUrl).
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.join(here, '../frontend')
const { default: base } = await import(pathToFileURL(path.join(frontendDir, 'vite.config.js')).href)
const outDir = path.join(here, 'dist/frontend')
const webOnly = {
  name: 'mcah-web-only-pages',
  closeBundle: () => ['huong-dan', 'phat-hanh'].forEach((dir) => fs.rmSync(path.join(outDir, dir), { recursive: true, force: true })),
}

export default {
  ...base,
  plugins: [...(base.plugins || []), webOnly],
  root: frontendDir,
  envDir: path.join(here, 'src'),
  define: { ...base.define, 'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1') },
  build: { outDir, emptyOutDir: true },
}
