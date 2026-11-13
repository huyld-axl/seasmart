import { describe, it, expect } from 'vitest'
import { conflictRows, keptValues } from '../conflictMerge'

describe('conflictRows', () => {
  const base = { phone: '1', address: 'A', email: 'x', note: null }
  it('tách ô người kia đổi, ô mình đổi, ô cả hai đổi', () => {
    const rows = conflictRows({ base, mine: { ...base, address: 'B', email: 'y' }, theirs: { ...base, phone: '2', email: 'z' } })
    expect(rows).toEqual([
      { key: 'phone', kind: 'theirs', mine: '1', theirs: '2' },
      { key: 'address', kind: 'mine', mine: 'B', theirs: 'A' },
      { key: 'email', kind: 'both', mine: 'y', theirs: 'z' },
    ])
  })
  it('hai bên đổi cùng giá trị thì bỏ qua', () => {
    expect(conflictRows({ base, mine: { ...base, phone: '9' }, theirs: { ...base, phone: '9' } })).toEqual([])
  })
})

describe('keptValues', () => {
  const rows = [
    { key: 'phone', kind: 'theirs', mine: '1', theirs: '2' },
    { key: 'address', kind: 'mine', mine: 'B' },
    { key: 'email', kind: 'both', mine: 'y', theirs: 'z' },
    { key: 'zalo', kind: 'both', mine: 'm', theirs: 't' },
  ]
  it('giữ ô mình đổi; ô cả hai đổi theo lựa chọn, mặc định của mình', () => {
    expect(keptValues(rows, { zalo: 'theirs' })).toEqual({ address: 'B', email: 'y' })
  })
})
