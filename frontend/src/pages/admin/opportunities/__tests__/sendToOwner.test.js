import { describe, it, expect } from 'vitest'
import { mailBody, mailSubject, pickContact } from '../sendToOwner'

const o = { rank_name: 'Máy hai', rank_name_en: '2nd Engineer', vessel_name: 'MV Lotus Star', planned_join_date: '2026-10-25', planned_join_port_name: 'Hải Phòng' }

describe('thư gửi chủ tàu', () => {
  it('chọn liên hệ chính có email, không thì người đầu có email', () => {
    expect(pickContact([{ name: 'A', email: '' , is_primary: true }, { name: 'B', email: 'b@x.vn' }])).toMatchObject({ name: 'B' })
    expect(pickContact([{ name: 'A', email: 'a@x.vn', is_primary: true }, { name: 'B', email: 'b@x.vn' }])).toMatchObject({ name: 'A' })
    expect(pickContact([{ name: 'A' }])).toBeNull()
  })

  it('tiêu đề và nội dung tiếng Anh, tên in hoa không dấu', () => {
    expect(mailSubject(o)).toBe('2nd Engineer candidates for MV Lotus Star · join 25/10/2026')
    const body = mailBody(o, { name: 'Park Ji-ho' }, [{ full_name: 'Hồ Văn Lực' }, { full_name: 'Trịnh Quang Vinh' }], 'Nguyễn Hà')
    expect(body).toContain('Dear Park Ji-ho,')
    expect(body).toContain('Please find attached 2 candidates for 2nd Engineer on MV Lotus Star, joining 25/10/2026.')
    expect(body).toContain('1. HO VAN LUC\n2. TRINH QUANG VINH')
    expect(body.endsWith('Best regards,\nNguyen Ha')).toBe(true)
  })
})
