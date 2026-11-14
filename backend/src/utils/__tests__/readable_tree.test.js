import { describe, it, expect } from 'vitest'
import { clean, certificatePath, photoPath, sentPath, logoPath, unique, fit } from '../readable_tree'
import { markSuperseded } from '../../services/file_layout.service'

const s = { id: 7, full_name: 'Nguyễn Văn An', seafarer_code: 'TV0123' }

describe('readable_tree', () => {
  it('đặt giấy tờ theo nhóm, loại, số, hạn', () => {
    expect(certificatePath(s, { type_name: 'Hộ chiếu', category: 'DOCUMENT', certificate_number: 'C1234567', expiry_date: '2030-05-01' }, '.pdf'))
      .toBe('Thuyền viên/NGUYỄN VĂN AN - TV0123/01 Tuỳ thân/Hộ chiếu - C1234567 - hết hạn 2030-05-01.pdf')
    expect(certificatePath(s, { type_name: 'GCN Huấn luyện cơ bản', category: 'STCW', superseded: true }, '.jpg'))
      .toBe('Thuyền viên/NGUYỄN VĂN AN - TV0123/03 Chứng chỉ (COP)/Bản cũ/GCN Huấn luyện cơ bản.jpg')
  })
  it('bỏ ký tự cấm, không kết thúc bằng dấu chấm, giữ dấu tiếng Việt (NFC)', () => {
    expect(clean('A/B:C?*"<>| tên.')).toBe('A B C tên')
    expect(clean('Nguyễn')).toBe('Nguyễn')
    expect(clean('   ')).toBe('Không tên')
  })
  it('ảnh, hồ sơ đã gửi, logo', () => {
    expect(photoPath(s, '.jpg')).toBe('Thuyền viên/NGUYỄN VĂN AN - TV0123/06 Ảnh/Chân dung.jpg')
    expect(sentPath(s, { sent_at: '2026-11-05T03:00:00Z', partner_name: 'Công ty A/B' })).toBe('Thuyền viên/NGUYỄN VĂN AN - TV0123/07 Hồ sơ đã gửi/2026-11-05 - gửi Công ty A B.zip')
    expect(logoPath({ company_name: 'Ocean Line' }, '.png')).toBe('Đối tác/Ocean Line/Logo.png')
  })
  it('trùng tên thêm (2), (3); đường dẫn dài bị cắt dưới 200 ký tự', () => {
    const taken = new Set()
    expect(['a/x.pdf', 'a/x.pdf', 'a/X.pdf'].map((p) => unique(p, taken))).toEqual(['a/x.pdf', 'a/x (2).pdf', 'a/X (3).pdf'])
    const long = fit(`Thuyền viên/A/${'x'.repeat(300)}.pdf`)
    expect(long.length).toBeLessThanOrEqual(200)
    expect(long.endsWith('.pdf')).toBe(true)
  })
  it('bản cũ: cùng loại, không phải bản mới nhất', () => {
    const out = markSuperseded([
      { id: 1, certificate_type_id: 5, issued_date: '2020-01-01' },
      { id: 2, certificate_type_id: 5, issued_date: '2024-01-01' },
      { id: 3, certificate_type_id: 6, issued_date: '2019-01-01' },
    ])
    expect(out.map((c) => c.superseded)).toEqual([true, false, false])
  })
})
