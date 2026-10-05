import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}', 'src/**/__tests__/**/*.{js,jsx}'],
    setupFiles: ['./src/test-setup.js'],
  },
})
