import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { loadEnvironment } = require('../environment')
const { allowed, assertApprover } = require('../../constants/mcah_permissions')
const env = { JWT_SECRET: 'integration-test-secret-at-least-32', DB_HOST: 'localhost', DB_USER: 'mcah', DB_NAME: 'mcah_test', MCAH_INSTANCE: 'mcah_test', UPLOAD_DIR: './storage/test/uploads' }
describe('MCAH boundary', () => {
  it('requires explicit independent database, instance, secret and storage', () => {
    expect(loadEnvironment(env).db.database).toBe('mcah_test')
    for (const patch of [{ DB_NAME: 'marineport' }, { MCAH_INSTANCE: '' }, { JWT_SECRET: 'secret' }, { UPLOAD_DIR: '../../Crew-Manning/backend/uploads' }, { UPLOAD_DIR: '' }, { UPLOAD_DIR: './public/documents' }, { PORT: 'NaN' }, { MAX_FILE_SIZE: '26214401' }]) {
      expect(() => loadEnvironment({ ...env, ...patch })).toThrow()
    }
  })
  it('legacy roles have no MCAH read or write access', () => {
    for (const role of ['training_center', 'manning_agent', 'seafarer', undefined]) {
      expect(allowed(role, 'GET', '/api/v1/seafarers')).toBe(false)
      expect(allowed(role, 'POST', '/api/v1/documents/seafarer/1')).toBe(false)
    }
  })
  it('reviewer can read sources/review but cannot create records or exports', () => {
    expect(allowed('reviewer', 'GET', '/api/v1/documents/1/file')).toBe(true)
    expect(allowed('reviewer', 'PUT', '/api/v1/documents/1/fields/name')).toBe(true)
    expect(allowed('reviewer', 'POST', '/api/v1/seafarers')).toBe(false)
    expect(allowed('reviewer', 'POST', '/api/v1/exports')).toBe(false)
    expect(allowed('reviewer', 'GET', '/api/v1/users')).toBe(false)
  })
  it('operator cannot approve/reject; maker cannot be checker even with admin', () => {
    expect(allowed('operator', 'POST', '/api/v1/exports/1/approve')).toBe(false)
    expect(allowed('reviewer', 'POST', '/api/v1/exports/1/reject')).toBe(true)
    expect(() => assertApprover({ role: 'admin', id: 1 }, '1')).toThrow()
    expect(() => assertApprover({ role: 'operator', id: 2 }, 1)).toThrow()
    expect(() => assertApprover({ role: 'reviewer', id: 2 }, 1)).not.toThrow()
  })
})
