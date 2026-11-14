import { defineConfig } from 'vitest/config'

// Test chạy trên DB riêng mcah_cloud_test (Postgres máy dev, scripts/dev-db.js), xoá sạch trước mỗi tệp test.
export default defineConfig({
  // SMTP_HOST rỗng: thư chỉ in ra log, không bao giờ gửi thư thật khi chạy test (dotenv không ghi đè biến đã có).
  test: { env: { CLOUD_DB_NAME: 'mcah_cloud_test', SMTP_HOST: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }, fileParallelism: false, testTimeout: 20000 },
})
