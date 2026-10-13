import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Chỉ tệp *.test.*: tệp hỗ trợ trong __tests__ (demoDocs.js) không phải bộ test.
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test-setup.js'],
  },
})
