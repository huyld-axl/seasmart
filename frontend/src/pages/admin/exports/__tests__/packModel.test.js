import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import {
  matchName, matchVessel, rankCandidates, paperImoState, overlappingContracts, readinessRules, readinessLevel,
  TEMPLATES, stagePick, toggleTemplate, packInputs, packMissing, packSignatures,
} from '../packModel'

const paper = { name: 'HALONG SPIRIT', gt: '300', flag: 'VN', owner: 'CHỦ TÀU DEMO A' }
const spirit = { id: 1, vessel_name: 'MV Halong Spirit', imo_number: '9194945', gross_tonnage: '300.00', flag_name: 'Việt Nam', ship_owner_name: 'Chủ tàu Demo A' }
const spirit2 = { id: 2, vessel_name: 'Halong Spirit II', imo_number: '9302051', gross_tonnage: '4120.00', flag_name: 'Panama', ship_owner_name: 'Chủ tàu Demo B' }
const today = dayjs('2026-10-07')

describe('đối chiếu tàu', () => {
  it('tên: bỏ dấu, bỏ tiền tố MV; chứa nhau là gần giống', () => {
    expect(matchName('HALONG SPIRIT', 'MV Halong Spirit')).toBe(true)
    expect(matchName('HALONG SPIRIT', 'Halong Spirit II')).toBe('near')
    expect(matchName('CHỦ TÀU DEMO A', 'Chủ tàu Demo A')).toBe(true)
    expect(matchName('', 'X')).toBeNull()
  })

  it('từng ô khớp, cờ VN = Việt Nam, GT lệch tối đa 1', () => {
    expect(matchVessel(paper, spirit)).toEqual({ name: true, imo: null, gt: true, flag: true, owner: true })
    expect(matchVessel(paper, spirit2)).toEqual({ name: 'near', imo: null, gt: false, flag: false, owner: false })
  })

  it('xếp ứng viên khớp nhiều lên trước, IMO khớp đứng đầu', () => {
    expect(rankCandidates(paper, [spirit2, spirit]).map((c) => c.vessel.id)).toEqual([1, 2])
    expect(rankCandidates({ ...paper, imo: '9302051' }, [spirit, spirit2])[0].vessel.id).toBe(2)
  })

  it('IMO trên giấy', () => {
    expect(paperImoState('')).toBe('none')
    expect(paperImoState('9194945')).toBe('ok')
    expect(paperImoState('9194946')).toBe('invalid')
  })
})

describe('kiểm tra sẵn sàng', () => {
  const ok = { full_name: 'A', date_of_birth: '1990-01-01', nationality_id: 1, national_id: '1', current_rank_id: 1, seaman_book_number: 'S', passport_expiry: '2030-01-01' }

  it('hợp đồng chồng thời gian', () => {
    expect(overlappingContracts([{ start_date: '2025-01-01', end_date: '2025-06-01' }, { start_date: '2025-07-01', end_date: '2025-12-01' }], today)).toHaveLength(0)
    expect(overlappingContracts([{ start_date: '2025-01-01', end_date: '2025-08-01' }, { start_date: '2025-07-01' }], today)).toHaveLength(1)
  })

  it('đủ hết là sẵn sàng; chờ duyệt là cần xem lại; thiếu hay hết hạn là bị chặn', () => {
    expect(readinessLevel(readinessRules({ seafarer: ok, today }))).toBe('READY_IN_SCOPE')
    expect(readinessLevel(readinessRules({ seafarer: ok, pendingReview: 2, today }))).toBe('NEEDS_REVIEW')
    const blocked = readinessRules({ seafarer: { ...ok, seaman_book_number: null, passport_expiry: '2025-01-01' }, today })
    expect(readinessLevel(blocked)).toBe('BLOCKED')
    expect(blocked[0].reason).toBe('Còn thiếu: Số sổ thuyền viên')
    expect(blocked[3].reason).toBe('Hộ chiếu hết hạn 01/01/2025')
  })
})

describe('bộ giấy 12 mẫu', () => {
  it('đủ 12 mẫu, chọn nhanh Lên tàu không lấy đơn không tham gia BHXH', () => {
    expect(TEMPLATES).toHaveLength(12)
    expect(stagePick('di-tau')).toEqual(['qddd', 'bhxh', 'bl', 'uqcn', 'uql'])
  })

  it('hai đơn BHXH loại trừ nhau, giữ thứ tự mẫu', () => {
    expect(toggleTemplate(['qddd', 'bhxh'], 'kbhxh')).toEqual(['qddd', 'kbhxh'])
    expect(toggleTemplate(['uql'], 'qddd')).toEqual(['qddd', 'uql'])
    expect(toggleTemplate(['qddd', 'uql'], 'qddd')).toEqual(['uql'])
  })

  it('ô điền chung, trường thiếu, chữ ký cần', () => {
    expect(packInputs(['qddd', 'qdrt'])).toEqual(['Tên tàu', 'Ngày xuống tàu', 'Ngày rời tàu', 'Cảng rời tàu'])
    expect(packMissing(['bl', 'uql'])).toEqual([{ field: 'Người bảo lãnh', doc: 'Thư bảo lãnh' }, { field: 'Số tài khoản', doc: 'Ủy quyền nhận lương' }])
    expect(packSignatures(['tl', 'cv'])).toEqual([{ doc: 'tl', who: 'Thuyền viên' }, { doc: 'tl', who: 'Giám đốc' }])
  })
})
