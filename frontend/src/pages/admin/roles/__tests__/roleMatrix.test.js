import { describe, it, expect } from 'vitest'
import {
  buildDraft,
  reconcileDraft,
  moduleState,
  toggleCell,
  toggleModule,
  setScope,
  effectiveScope,
  diffRole,
  allChanges,
  totalChanges,
  toSavePayload,
  matchesQuery,
  cellChanged,
  scopeChanged,
} from '../roleMatrix'

const p = (code, name, admin_only = false) => ({
  code,
  action: code.split('.')[1],
  name,
  description: null,
  admin_only,
})
const MODULES = [
  {
    key: 'seafarer',
    label: 'Thuyền viên',
    scoped: true,
    permissions: [
      p('seafarer.view', 'Xem'),
      p('seafarer.create', 'Thêm'),
      p('seafarer.update', 'Sửa'),
      p('seafarer.delete', 'Xoá'),
    ],
  },
  {
    key: 'vessel',
    label: 'Tàu',
    scoped: false,
    permissions: [p('vessel.view', 'Xem'), p('vessel.create', 'Thêm')],
  },
  {
    key: 'role',
    label: 'Vai trò',
    scoped: false,
    permissions: [p('role.manage', 'Sửa vai trò', true)],
  },
]
const admin = {
  id: 1,
  code: 'admin',
  is_system: true,
  name: 'Quản trị viên',
  permissions: [],
  scopes: {},
  user_count: 1,
}
const staff = (over = {}) => ({
  id: 2,
  code: null,
  is_system: false,
  name: 'Nhân viên',
  permissions: ['seafarer.view', 'seafarer.update'],
  scopes: {},
  user_count: 3,
  ...over,
})
const draftOf = (role) => buildDraft([role])[role.id]
const codes = (d) => [...d.perms].sort()

describe('buildDraft / reconcileDraft', () => {
  it('bỏ vai trò hệ thống, chép quyền và phạm vi', () => {
    const d = buildDraft([admin, staff({ scopes: { seafarer: 'own' } })])
    expect(Object.keys(d)).toEqual(['2'])
    expect(d[2].perms.has('seafarer.view')).toBe(true)
    expect(d[2].scopes).toEqual({ seafarer: 'own' })
  })
  it('giữ nháp vai trò đã có, thêm mới, bỏ vai trò đã xoá', () => {
    const edited = { perms: new Set(['vessel.view']), scopes: {} }
    const next = reconcileDraft({ 2: edited, 9: edited }, [
      admin,
      staff(),
      staff({ id: 3, name: 'Mới' }),
    ])
    expect(next[2]).toBe(edited)
    expect(next[3].perms.has('seafarer.view')).toBe(true)
    expect(next[9]).toBeUndefined()
  })
})

describe('moduleState', () => {
  it('false / mixed / true theo quyền cấp được', () => {
    expect(moduleState(new Set(), MODULES[0])).toBe('false')
    expect(moduleState(new Set(['seafarer.view']), MODULES[0])).toBe('mixed')
    expect(moduleState(new Set(MODULES[0].permissions.map((x) => x.code)), MODULES[0])).toBe('true')
  })
  it('mục chỉ có quyền adminOnly luôn coi là true', () => {
    expect(moduleState(new Set(), MODULES[2])).toBe('true')
  })
})

describe('toggleCell: Xem là quyền gốc', () => {
  it('tích quyền khác thì tự tích Xem', () => {
    const r = toggleCell({ perms: new Set(), scopes: {} }, MODULES[0], 'seafarer.delete')
    expect(codes(r.draftRole)).toEqual(['seafarer.delete', 'seafarer.view'])
    expect(r.autoAdded).toBe('seafarer.view')
  })
  it('đã có Xem thì không báo tự thêm', () => {
    const r = toggleCell(
      { perms: new Set(['seafarer.view']), scopes: {} },
      MODULES[0],
      'seafarer.create'
    )
    expect(r.autoAdded).toBeNull()
  })
  it('bỏ Xem thì bỏ hết quyền khác của mục, không đụng mục khác', () => {
    const start = {
      perms: new Set(['seafarer.view', 'seafarer.update', 'seafarer.delete', 'vessel.view']),
      scopes: {},
    }
    const r = toggleCell(start, MODULES[0], 'seafarer.view')
    expect(codes(r.draftRole)).toEqual(['vessel.view'])
    expect(r.autoRemoved.sort()).toEqual(['seafarer.delete', 'seafarer.update'])
  })
  it('bỏ quyền thường chỉ bỏ quyền đó', () => {
    const r = toggleCell(
      { perms: new Set(['seafarer.view', 'seafarer.update']), scopes: {} },
      MODULES[0],
      'seafarer.update'
    )
    expect(codes(r.draftRole)).toEqual(['seafarer.view'])
  })
  it('quyền adminOnly không đổi được', () => {
    const start = { perms: new Set(), scopes: {} }
    expect(toggleCell(start, MODULES[2], 'role.manage').draftRole).toBe(start)
  })
  it('không sửa nháp gốc (bất biến)', () => {
    const start = { perms: new Set(['seafarer.view']), scopes: {} }
    toggleCell(start, MODULES[0], 'seafarer.update')
    expect(codes(start)).toEqual(['seafarer.view'])
  })
})

describe('toggleModule', () => {
  it('chưa đủ thì tích hết, đủ rồi thì bỏ hết', () => {
    const on = toggleModule({ perms: new Set(['seafarer.view']), scopes: {} }, MODULES[0])
    expect(codes(on)).toEqual([
      'seafarer.create',
      'seafarer.delete',
      'seafarer.update',
      'seafarer.view',
    ])
    expect(codes(toggleModule(on, MODULES[0]))).toEqual([])
  })
  it('không thêm quyền adminOnly', () => {
    const d = { perms: new Set(), scopes: {} }
    expect(toggleModule(d, MODULES[2])).toBe(d)
  })
})

describe('phạm vi', () => {
  it('chỉ có hiệu lực khi mục có phạm vi và có Xem', () => {
    const d = setScope({ perms: new Set(['seafarer.view']), scopes: {} }, 'seafarer', 'own')
    expect(effectiveScope(d, MODULES[0])).toBe('own')
    expect(effectiveScope({ ...d, perms: new Set() }, MODULES[0])).toBe('all')
    expect(effectiveScope(setScope(d, 'vessel', 'own'), MODULES[1])).toBe('all')
  })
})

describe('so nháp với bản đã lưu', () => {
  it('chưa sửa thì không có thay đổi', () => {
    const role = staff()
    expect(allChanges(MODULES, [admin, role], { [role.id]: draftOf(role) })).toEqual([])
  })
  it('thêm, bỏ, đổi phạm vi; số thay đổi cộng đủ', () => {
    const role = staff({ scopes: {} })
    let d = draftOf(role)
    d = toggleCell(d, MODULES[0], 'seafarer.update').draftRole // bỏ
    d = toggleCell(d, MODULES[0], 'seafarer.delete').draftRole // thêm
    d = setScope(d, 'seafarer', 'own')
    d = toggleCell(d, MODULES[1], 'vessel.create').draftRole // thêm vessel.create + vessel.view
    const diff = diffRole(MODULES, role, d)
    expect(diff.add.map((x) => x.code)).toEqual(['seafarer.delete', 'vessel.view', 'vessel.create'])
    expect(diff.rm.map((x) => x.code)).toEqual(['seafarer.update'])
    expect(diff.scope.map((x) => [x.module.key, x.to])).toEqual([['seafarer', 'own']])
    const changes = allChanges(MODULES, [admin, role], { [role.id]: d })
    expect(totalChanges(changes)).toBe(5)
  })
  it('sửa rồi trả về như cũ thì hết thay đổi', () => {
    const role = staff()
    let d = draftOf(role)
    d = toggleCell(d, MODULES[0], 'seafarer.update').draftRole
    d = toggleCell(d, MODULES[0], 'seafarer.update').draftRole
    expect(diffRole(MODULES, role, d)).toEqual({ add: [], rm: [], scope: [] })
  })
  it('cellChanged / scopeChanged', () => {
    const role = staff()
    const d = toggleCell(draftOf(role), MODULES[0], 'seafarer.update').draftRole
    expect(cellChanged(role, d, 'seafarer.update')).toBe(true)
    expect(cellChanged(role, d, 'seafarer.view')).toBe(false)
    expect(scopeChanged(role, setScope(draftOf(role), 'seafarer', 'own'), MODULES[0])).toBe(true)
  })
  it('đổi phạm vi khi chưa có Xem không tính là thay đổi', () => {
    const role = staff({ permissions: [] })
    expect(scopeChanged(role, setScope(draftOf(role), 'seafarer', 'own'), MODULES[0])).toBe(false)
  })
})

describe('toSavePayload', () => {
  it('chỉ vai trò có thay đổi, phạm vi chỉ gồm own có Xem', () => {
    const a = staff()
    const b = staff({ id: 3, name: 'B' })
    const draft = {
      2: setScope(
        toggleCell(draftOf(a), MODULES[0], 'seafarer.delete').draftRole,
        'seafarer',
        'own'
      ),
      3: draftOf(b),
    }
    const changes = allChanges(MODULES, [admin, a, b], draft)
    const payload = toSavePayload(MODULES, changes, draft)
    expect(payload).toHaveLength(1)
    expect(payload[0].id).toBe(2)
    expect(payload[0].scopes).toEqual({ seafarer: 'own' })
    expect(payload[0].permissions.sort()).toEqual([
      'seafarer.delete',
      'seafarer.update',
      'seafarer.view',
    ])
  })
})

describe('matchesQuery', () => {
  it('khớp tên mục, tên quyền, mô tả; rỗng thì khớp hết', () => {
    const perm = { name: 'Duyệt và từ chối', description: 'Hợp đồng chờ' }
    expect(matchesQuery(MODULES[0], perm, '')).toBe(true)
    expect(matchesQuery(MODULES[0], perm, 'DUYỆT')).toBe(true)
    expect(matchesQuery(MODULES[0], perm, 'thuyền')).toBe(true)
    expect(matchesQuery(MODULES[0], perm, 'chờ')).toBe(true)
    expect(matchesQuery(MODULES[0], perm, 'tàu')).toBe(false)
  })
})
