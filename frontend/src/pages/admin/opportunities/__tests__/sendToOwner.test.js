import { describe, it, expect } from 'vitest'
import { buildMailto, mailBody, mailSubject, pickContact } from '../sendToOwner'
import { MAILTO_MAX } from '../../../../constants/opportunityVoyage'

const o = { rank_name: 'Máy hai', rank_name_en: '2nd Engineer', vessel_name: 'MV Lotus Star', planned_join_date: '2026-10-25', planned_join_port_name: 'Hải Phòng' }

describe('gửi chủ tàu qua mailto', () => {
  it('chọn liên hệ chính có email, không thì người đầu có email', () => {
    expect(pickContact([{ name: 'A', email: '' , is_primary: true }, { name: 'B', email: 'b@x.vn' }])).toMatchObject({ name: 'B' })
    expect(pickContact([{ name: 'A', email: 'a@x.vn', is_primary: true }, { name: 'B', email: 'b@x.vn' }])).toMatchObject({ name: 'A' })
    expect(pickContact([{ name: 'A' }])).toBeNull()
  })

  it('tiêu đề và nội dung tiếng Anh, tên in hoa không dấu', () => {
    expect(mailSubject(o)).toBe('MCAH · 2nd Engineer candidates for MV Lotus Star · join 25/10/2026 Hai Phong')
    const body = mailBody(o, { name: 'Park Ji-ho' }, [{ full_name: 'Hồ Văn Lực' }, { full_name: 'Trịnh Quang Vinh' }], 'ha@mcah.vn')
    expect(body).toContain('Dear Park Ji-ho,')
    expect(body).toContain('Please find attached 2 candidates for 2nd Engineer on MV Lotus Star, joining 25/10/2026.')
    expect(body).toContain('1. HO VAN LUC\n2. TRINH QUANG VINH')
  })

  it('URL mailto có CC; dài quá giới hạn thì rút gọn danh sách', () => {
    const url = buildMailto({ opportunity: o, contact: { email: 'crew@owner.com' }, people: [{ full_name: 'A' }], cc: 'me@mcah.vn' })
    expect(url.startsWith('mailto:crew%40owner.com?cc=me%40mcah.vn&subject=')).toBe(true)
    const many = Array.from({ length: 80 }, (_, i) => ({ full_name: `Nguyễn Văn Thuyền Viên Số ${i}` }))
    const long = buildMailto({ opportunity: o, contact: { email: 'crew@owner.com' }, people: many })
    expect(long.length).toBeLessThanOrEqual(MAILTO_MAX)
    expect(decodeURIComponent(long)).toContain('more, see attachments')
  })
})
