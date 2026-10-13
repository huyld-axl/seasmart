import { describe, it, expect } from 'vitest'
import { toTableCerts, attentionCount, toPayload } from '../certificateView'

describe('chứng chỉ', () => {
  const rows = [
    { id: 1, display_name: 'Advanced Fire Fighting', certificate_number: 'A2949', issued_date: '2020-07-02T00:00:00.000Z', expiry_date: '2025-07-02', no_expiry: 0, expiry_status: 'EXPIRED', source: 'document', source_file_name: 'IMG.jpg', source_upload_id: 4 },
    { id: 2, display_name: 'Medical First Aid', certificate_number: null, issued_date: '2021-03-21', expiry_date: null, no_expiry: 1, expiry_status: 'NO_EXPIRY', source: 'manual' },
  ]

  it('đổi dòng API sang dòng bảng', () => {
    const out = toTableCerts(rows)
    expect(out[0]).toMatchObject({ name: 'Advanced Fire Fighting', issuedOn: '02/07/2020', expiresOn: '02/07/2025', status: 'EXPIRED', manual: false, uploadId: 4 })
    expect(out[1]).toMatchObject({ number: '—', expiresOn: '', status: 'NO_EXPIRY', manual: true })
  })

  it('đếm chứng chỉ cần chú ý', () => {
    expect(attentionCount([...rows, { expiry_status: 'EXPIRING' }, { expiry_status: 'VALID' }])).toBe(2)
  })

  it('form thêm tay: ngày dd/mm/yyyy sang ISO, báo lỗi từng ô', () => {
    expect(toPayload({ certificateTypeId: 3, number: ' BST/1 ', issuedOn: '14/05/2023', expiresOn: '14/05/2028' }).payload)
      .toEqual({ certificate_type_id: 3, certificate_number: 'BST/1', issued_date: '2023-05-14', expiry_date: '2028-05-14', no_expiry: false, issued_by: undefined })
    expect(toPayload({ certificateTypeId: 3, issuedOn: '14/05/2023', noExpiry: true, expiresOn: '' }).payload).toMatchObject({ no_expiry: true })
    expect(toPayload({ certificateTypeId: 3, issuedOn: '14/05/2023', noExpiry: true, expiresOn: '' }).payload).not.toHaveProperty('expiry_date')
    const bad = toPayload({ issuedOn: '31/02/2023', expiresOn: '' })
    expect(bad.errors).toMatchObject({ certificateTypeId: expect.any(String), issuedOn: expect.any(String), expiresOn: expect.any(String) })
  })
})
