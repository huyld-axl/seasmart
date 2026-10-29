import { describe, it, expect } from 'vitest'
import { docState, formMissing } from '../submissionView'

describe('hồ sơ nộp', () => {
  it('chữ và tông cho từng tình trạng giấy', () => {
    expect(docState({ state: 'missing', certificate: null })).toEqual({ tone: 'bad', text: 'Chưa có trên hồ sơ' })
    expect(docState({ state: 'no_file', certificate: { id: 1 } }).tone).toBe('warn')
    expect(docState({ state: 'expires_early', expiry: '2026-10-20', needed_until: '2027-06-15' }).text).toBe('Hết hạn 20/10/2026, trước mốc cần 15/06/2027')
    expect(docState({ state: 'ok', certificate: { certificate_number: 'A1' }, expiry: null })).toEqual({ tone: 'ok', text: 'Số A1' })
  })

  it('ô điền thêm còn trống; null khi bộ chưa có mẫu đó', () => {
    expect(formMissing('qddd', null)).toBeNull()
    expect(formMissing('qddd', { docs: ['qddd'], inputs: {} })).toEqual(['Ngày xuống tàu'])
    expect(formMissing('qddd', { docs: ['qddd'], inputs: { 'Ngày xuống tàu': '20/09/2026' } })).toEqual([])
  })
})
