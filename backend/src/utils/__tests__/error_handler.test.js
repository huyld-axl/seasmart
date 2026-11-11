import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Fastify = require('fastify')
const { errorHandler } = require('../error_handler')

async function responseFor(error, method = 'POST') {
  const app = Fastify()
  app.setErrorHandler(errorHandler)
  app.route({ method, url: '/test', handler: async () => { throw error } })
  try {
    const response = await app.inject({ method, url: '/test' })
    return { status: response.statusCode, body: response.json() }
  } finally {
    await app.close()
  }
}

describe('API error messages', () => {
  it.each([
    ['country_code', 'Mã quốc gia'],
    ['rank_code', 'Mã chức danh'],
    ['port_un_locode', 'Mã cảng (UN/LOCODE)'],
    ['user_email', 'Email'],
    ['contract_bill_code_key', 'Mã yêu cầu thanh toán'],
  ])('explains duplicate %s without leaking database details', async (constraint, label) => {
    const result = await responseFor(Object.assign(new Error('SQL secret'), { code: '23505', constraint, detail: 'private value' }))
    expect(result).toEqual({ status: 409, body: { error: `${label} đã tồn tại. Vui lòng nhập giá trị khác.` } })
  })
  it('explains unknown duplicate constraints safely', async () => {
    const result = await responseFor({ code: '23505', constraint: 'internal_name', message: 'SQL secret' })
    expect(result.status).toBe(409)
    expect(result.body.error).toContain('Dữ liệu bị trùng')
    expect(JSON.stringify(result)).not.toMatch(/SQL secret|internal_name/)
  })
  it('explains why linked records cannot be deleted', async () => {
    const result = await responseFor({ code: '23503' }, 'DELETE')
    expect(result.status).toBe(409)
    expect(result.body.error).toContain('đang được sử dụng')
  })
  it('asks users to select missing related data again', async () => {
    const result = await responseFor({ code: '23503' })
    expect(result.body.error).toContain('chọn lại')
  })
  it('preserves business errors and blocked bills', async () => {
    expect(await responseFor({ statusCode: 409, message: 'Chưa thể sửa hợp đồng', blocked_bills: [1] })).toEqual({
      status: 409, body: { error: 'Chưa thể sửa hợp đồng', blocked_bills: [1] },
    })
  })
  it('keeps unexpected internal failures private', async () => {
    expect(await responseFor(new Error('SQL secret'))).toEqual({
      status: 500, body: { error: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau' },
    })
  })
})
