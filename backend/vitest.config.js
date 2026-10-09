const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    globals: true,
    env: { JWT_SECRET: 'test-only-secret-at-least-32-characters', DB_HOST: '127.0.0.1', DB_USER: 'mcah_test', DB_NAME: 'mcah_test', MCAH_INSTANCE: 'mcah_test', UPLOAD_DIR: './storage/mcah-test/uploads' },
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
