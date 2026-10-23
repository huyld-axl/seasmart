import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { toPartnerFields } = require('../business_card_scan.service')

describe('business_card_scan', () => {
  it('tách thông tin công ty và người liên hệ, bỏ ô trống', () => {
    const result = toPartnerFields({
      company_name: ' ACME Shipping ', company_name_en: null, address: '1 Sea Rd', phone: '', fax: null, email: 'INFO@ACME.COM', website: null, tax_id: null,
      contact_name: 'John Tan', contact_position: 'Crewing Manager', contact_phone: '+65 9123', contact_email: 'John@ACME.com', contact_whatsapp: '+65 9123', contact_line: 'johntan', contact_wechat: null,
    })
    expect(result.company).toEqual({ company_name: 'ACME Shipping', address: '1 Sea Rd', email: 'info@acme.com' })
    expect(result.contact).toEqual({ name: 'John Tan', position: 'Crewing Manager', phone: '+65 9123', email: 'john@acme.com', whatsapp: '+65 9123', line_id: 'johntan', wechat_id: null })
  })

  it('không có tên người thì không tạo liên hệ', () => {
    expect(toPartnerFields({ company_name: 'ACME', contact_name: null, contact_phone: '123' }).contact).toBeNull()
  })
})
