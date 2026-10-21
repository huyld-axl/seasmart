// Hàm thuần của ma trận vai trò: tính trạng thái ô, áp quy tắc "Xem là quyền gốc của mục", đếm và so nháp với bản đã lưu.
// Dữ liệu vào là `modules` (từ GET /roles/catalog) và `roles` (từ GET /roles). Nháp của một vai trò: { perms: Set<string>, scopes: { [mục]: 'all' | 'own' } }.

export const SCOPE_LABEL = { all: 'Tất cả', own: 'Do mình tạo' }

export const permsOf = (module) => module.permissions
export const grantableOf = (module) => module.permissions.filter((p) => !p.admin_only)
export const viewCodeOf = (module) => `${module.key}.view`
export const moduleOfCode = (modules, code) => modules.find((m) => code.startsWith(`${m.key}.`))

export function buildDraft(roles) {
  return Object.fromEntries(
    roles
      .filter((role) => !role.is_system)
      .map((role) => [role.id, { perms: new Set(role.permissions), scopes: { ...role.scopes } }])
  )
}

// Giữ nháp của vai trò đã có, thêm vai trò mới từ bản đã lưu, bỏ vai trò đã xoá.
export function reconcileDraft(draft, roles) {
  const fresh = buildDraft(roles)
  return Object.fromEntries(Object.keys(fresh).map((id) => [id, draft[id] || fresh[id]]))
}

// Phạm vi thực sự có hiệu lực: không có Xem của mục thì coi như 'all' (giao diện ẩn ô chọn phạm vi).
export function effectiveScope(draftRole, module) {
  if (!module.scoped || !draftRole.perms.has(viewCodeOf(module))) return 'all'
  return draftRole.scopes[module.key] === 'own' ? 'own' : 'all'
}

export function moduleState(perms, module) {
  const list = grantableOf(module)
  if (!list.length) return 'true'
  const on = list.filter((p) => perms.has(p.code)).length
  return on === 0 ? 'false' : on === list.length ? 'true' : 'mixed'
}

// Tích / bỏ một quyền. Tích quyền khác thì tự tích Xem của mục; bỏ Xem thì bỏ hết quyền khác của mục.
// Trả { draftRole, autoAdded: mã Xem vừa tự tích | null, autoRemoved: mã các quyền vừa bị bỏ theo }.
export function toggleCell(draftRole, module, code) {
  const perm = module.permissions.find((p) => p.code === code)
  if (!perm || perm.admin_only) return { draftRole, autoAdded: null, autoRemoved: [] }
  const perms = new Set(draftRole.perms)
  let autoAdded = null
  let autoRemoved = []
  const view = viewCodeOf(module)
  if (perms.has(code)) {
    perms.delete(code)
    if (code === view) {
      autoRemoved = grantableOf(module)
        .map((p) => p.code)
        .filter((c) => c !== view && perms.has(c))
      autoRemoved.forEach((c) => perms.delete(c))
    }
  } else {
    perms.add(code)
    if (code !== view && module.permissions.some((p) => p.code === view) && !perms.has(view)) {
      perms.add(view)
      autoAdded = view
    }
  }
  return { draftRole: { ...draftRole, perms }, autoAdded, autoRemoved }
}

// Ô ở dòng mục: đang đủ cả mục thì bỏ hết, ngược lại tích hết (chỉ quyền cấp được).
export function toggleModule(draftRole, module) {
  const list = grantableOf(module)
  if (!list.length) return draftRole
  const perms = new Set(draftRole.perms)
  const all = list.every((p) => perms.has(p.code))
  list.forEach((p) => (all ? perms.delete(p.code) : perms.add(p.code)))
  return { ...draftRole, perms }
}

export function setScope(draftRole, moduleKey, value) {
  return {
    ...draftRole,
    scopes: { ...draftRole.scopes, [moduleKey]: value === 'own' ? 'own' : 'all' },
  }
}

const savedPerms = (role) => new Set(role.permissions)
const savedScope = (role, module) =>
  module.scoped &&
  role.permissions.includes(viewCodeOf(module)) &&
  role.scopes?.[module.key] === 'own'
    ? 'own'
    : 'all'

export function cellChanged(role, draftRole, code) {
  return savedPerms(role).has(code) !== draftRole.perms.has(code)
}

export function scopeChanged(role, draftRole, module) {
  return module.scoped && savedScope(role, module) !== effectiveScope(draftRole, module)
}

// Mọi thay đổi của một vai trò: quyền thêm, quyền bỏ (theo thứ tự danh mục) và phạm vi đổi.
export function diffRole(modules, role, draftRole) {
  const add = []
  const rm = []
  const scope = []
  const before = savedPerms(role)
  for (const module of modules) {
    for (const p of module.permissions) {
      if (before.has(p.code) && !draftRole.perms.has(p.code)) rm.push({ ...p, module })
      if (!before.has(p.code) && draftRole.perms.has(p.code)) add.push({ ...p, module })
    }
    if (scopeChanged(role, draftRole, module))
      scope.push({ module, to: effectiveScope(draftRole, module) })
  }
  return { add, rm, scope }
}

// Số ô và phạm vi đã sửa của một vai trò (hiện ở chip "Đã sửa n" đầu cột).
export const roleChangeCount = (modules, role, draftRole) =>
  modules.reduce(
    (n, module) =>
      n +
      module.permissions.filter((p) => cellChanged(role, draftRole, p.code)).length +
      (scopeChanged(role, draftRole, module) ? 1 : 0),
    0
  )

export const diffCount = (diff) => diff.add.length + diff.rm.length + diff.scope.length

// Danh sách vai trò có thay đổi: [{ role, add, rm, scope }].
export function allChanges(modules, roles, draft) {
  return roles
    .filter((role) => !role.is_system && draft[role.id])
    .map((role) => ({ role, ...diffRole(modules, role, draft[role.id]) }))
    .filter((change) => diffCount(change) > 0)
}

export const totalChanges = (changes) => changes.reduce((n, change) => n + diffCount(change), 0)

// Dữ liệu gửi PUT /roles/permissions: chỉ các vai trò có thay đổi, phạm vi chỉ gồm mục 'own' có Xem.
export function toSavePayload(modules, changes, draft) {
  return changes.map(({ role }) => {
    const d = draft[role.id]
    const scopes = {}
    for (const module of modules)
      if (effectiveScope(d, module) === 'own') scopes[module.key] = 'own'
    return { id: role.id, permissions: [...d.perms], scopes }
  })
}

// Dòng mục / quyền hiện khi tìm kiếm: khớp tên mục, tên quyền hoặc mô tả (không phân biệt hoa thường).
export function matchesQuery(module, perm, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [module.label, perm.name, perm.description || ''].some((text) =>
    text.toLowerCase().includes(q)
  )
}
