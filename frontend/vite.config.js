import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Chia sẻ qua một tunnel duy nhất: `vite preview` chuyển /api sang backend, nên VITE_API_URL=/api/v1.
  preview: {
    allowedHosts: ['.trycloudflare.com'],
    // Trình duyệt gửi Origin của tunnel, backend không có trong CORS_ORIGINS nên trả 500; qua proxy là cùng origin, bỏ header đi.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
})
