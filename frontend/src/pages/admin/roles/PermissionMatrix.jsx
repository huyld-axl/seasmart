import { useRef } from 'react'
import { Button, Dropdown } from 'antd'
import PermissionCheck from '../../../components/ds/PermissionCheck'
import { SegmentedPick } from '../fleet/FleetParts'
import RoleIcon from './RoleIcon'
import {
  SCOPE_LABEL,
  cellChanged,
  effectiveScope,
  grantableOf,
  matchesQuery,
  moduleState,
  roleChangeCount,
  scopeChanged,
  viewCodeOf,
} from './roleMatrix'

const SCOPE_OPTIONS = [
  { value: 'all', label: SCOPE_LABEL.all },
  { value: 'own', label: SCOPE_LABEL.own },
]

// Đầu cột vai trò: hai dòng cố định (tên + menu, rồi số tài khoản và số quyền). Mọi phần đổi theo nháp
// nằm trong ô có bề rộng cố định, nên tích quyền không làm đầu cột xê dịch.
function RoleHead({ role, draftRole, modules, total, flash, menu }) {
  const locked = role.is_system
  const count = locked ? total : draftRole.perms.size
  const changes = locked ? 0 : roleChangeCount(modules, role, draftRole)
  return (
    <th scope="col" className={locked ? 'rm-c-role is-locked' : 'rm-c-role'} data-c={role.id}>
      <div className={flash ? 'rm-rh rm-rh--flash' : 'rm-rh'}>
        <span className="rm-rh__name" title={role.description || role.name}>
          {locked ? (
            <span className="rm-rh__lock" title="Luôn có mọi quyền, kể cả quyền thêm sau này">
              <RoleIcon name="lock" />
            </span>
          ) : null}
          <span className="rm-rh__text">{role.name}</span>
        </span>
        <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
          <button type="button" className="rm-rh__menu" aria-label={`Thao tác với vai trò ${role.name}`}>
            <RoleIcon name="more" />
          </button>
        </Dropdown>
        <span className="rm-rh__meta">
          {role.user_count} tài khoản · {count}/{total}
        </span>
        <span className="rm-rh__changed" aria-live="polite">
          {changes ? (
            <span className="rm-rh__dot" title={`${changes} thay đổi chưa lưu`}>
              {changes}
            </span>
          ) : null}
        </span>
      </div>
    </th>
  )
}

// Ma trận quyền: hàng là quyền (nhóm theo mục menu), cột là vai trò. Cột đầu là Quản trị viên (khoá).
export default function PermissionMatrix({
  modules,
  roles,
  draft,
  total,
  query,
  collapsed,
  flashId,
  scrollRef,
  menuFor,
  onCell,
  onModule,
  onScope,
  onCollapse,
  toolbar,
  onClearQuery,
}) {
  const headRef = useRef(null)
  const has = (role, code) => (role.is_system ? true : draft[role.id]?.perms.has(code))

  // Rê vào một ô thì cả cột sáng nhẹ (gắn class trực tiếp, không dựng lại bảng).
  const highlight = (event) => {
    const table = event.currentTarget
    const cell = event.target.closest('td[data-c], th[data-c]')
    const id = cell ? cell.dataset.c : null
    if (table.dataset.hcol === (id ?? '')) return
    table.querySelectorAll('.is-hcol').forEach((el) => el.classList.remove('is-hcol'))
    table.dataset.hcol = id ?? ''
    if (id)
      table.querySelectorAll(`td[data-c="${id}"]`).forEach((el) => el.classList.add('is-hcol'))
  }
  const clearHighlight = (event) => {
    event.currentTarget.querySelectorAll('.is-hcol').forEach((el) => el.classList.remove('is-hcol'))
    event.currentTarget.dataset.hcol = ''
  }

  let group = ''
  let shown = 0
  const rows = []
  for (const module of modules) {
    const perms = module.permissions.filter((p) => matchesQuery(module, p, query))
    if (!perms.length) continue
    shown += perms.length
    if (module.group !== group) {
      group = module.group
      rows.push(
        <tr key={`g-${group}`} className="rm-row-sec">
          <td className="rm-c-perm">{group}</td>
          {roles.map((role) => (
            <td key={role.id} className="rm-c-role" />
          ))}
          <td className="rm-c-fill" />
        </tr>
      )
    }
    const open = Boolean(query.trim()) || !collapsed.has(module.key)
    const grantable = grantableOf(module)
    rows.push(
      <tr
        key={`m-${module.key}`}
        className={module.scoped ? 'rm-row-mod rm-row-mod--scoped' : 'rm-row-mod'}
      >
        <td className="rm-c-perm">
          <button
            type="button"
            className="rm-mod-btn"
            aria-expanded={open}
            onClick={() => onCollapse(module.key)}
          >
            <span className="rm-chev">
              <RoleIcon name="down" />
            </span>
            <span className="rm-mod-ic">
              <RoleIcon name={module.key} />
            </span>
            <span>
              {module.label}
              {module.scoped ? (
                <span className="rm-perm-desc" style={{ fontWeight: 400 }}>
                  Có phạm vi dữ liệu
                </span>
              ) : null}
            </span>
            <small>{module.permissions.length} quyền</small>
          </button>
        </td>
        {roles.map((role) => {
          const locked = role.is_system
          const cls = locked ? 'rm-c-role is-locked' : 'rm-c-role'
          if (!grantable.length) {
            return (
              <td key={role.id} className={cls} data-c={role.id}>
                <PermissionCheck checked disabled label={`${module.label}: ${role.name}`} />
              </td>
            )
          }
          const perms = locked ? new Set(grantable.map((p) => p.code)) : draft[role.id]?.perms
          const state = locked ? 'true' : moduleState(perms, module)
          const on = grantable.filter((p) => perms.has(p.code)).length
          const anyChanged =
            !locked && grantable.some((p) => cellChanged(role, draft[role.id], p.code))
          const box = (
            <PermissionCheck
              checked={state === 'mixed' ? 'mixed' : state === 'true'}
              disabled={locked}
              changed={anyChanged && !open}
              label={`Cả mục ${module.label} cho ${role.name}`}
              title={
                locked
                  ? 'Quản trị viên luôn có toàn quyền'
                  : `${on}/${grantable.length} quyền. Bấm để ${state === 'true' ? 'bỏ' : 'tích'} cả mục`
              }
              onChange={() => onModule(role.id, module)}
            />
          )
          if (!module.scoped) {
            return (
              <td key={role.id} className={cls} data-c={role.id}>
                {box}
              </td>
            )
          }
          let scope
          if (locked) scope = <span className="rm-scope-fixed">Tất cả</span>
          else if (perms.has(viewCodeOf(module))) {
            scope = (
              <SegmentedPick
                size="small"
                label={`Phạm vi ${module.label} của ${role.name}`}
                value={effectiveScope(draft[role.id], module)}
                options={SCOPE_OPTIONS}
                onChange={(value) => onScope(role.id, module.key, value)}
                className={scopeChanged(role, draft[role.id], module) ? 'is-changed' : ''}
              />
            )
          } else scope = <span className="rm-scope-fixed">—</span>
          return (
            <td key={role.id} className={cls} data-c={role.id}>
              <span className="rm-cellstack">
                {box}
                {scope}
              </span>
            </td>
          )
        })}
        <td className="rm-c-fill" />
      </tr>
    )
    if (!open) continue
    for (const perm of perms) {
      rows.push(
        <tr key={perm.code} className="rm-row-perm">
          <td className="rm-c-perm">
            <span className="rm-perm-name">
              {perm.name}
              {perm.action === 'view' && module.permissions.length > 1 ? (
                <span className="rm-perm-root">· quyền gốc của mục</span>
              ) : null}
              {perm.admin_only ? (
                <span className="rm-chip rm-chip--lock">
                  <RoleIcon name="lock" />
                  Chỉ Quản trị viên
                </span>
              ) : null}
            </span>
            {perm.description && !perm.admin_only ? (
              <span className="rm-perm-desc">{perm.description}</span>
            ) : null}
          </td>
          {roles.map((role) => {
            if (perm.admin_only && !role.is_system) {
              return (
                <td key={role.id} className="rm-c-role is-locked" data-c={role.id}>
                  <span className="rm-dash" title="Chỉ Quản trị viên">
                    —
                  </span>
                </td>
              )
            }
            const changed = !role.is_system && cellChanged(role, draft[role.id], perm.code)
            return (
              <td
                key={role.id}
                className={`rm-c-role${role.is_system ? ' is-locked' : ''}${changed ? ' is-changed' : ''}`}
                data-c={role.id}
              >
                <PermissionCheck
                  checked={Boolean(has(role, perm.code))}
                  disabled={role.is_system}
                  changed={changed}
                  label={`${perm.name} (${module.label}) cho ${role.name}`}
                  title={
                    role.is_system
                      ? 'Quản trị viên luôn có toàn quyền'
                      : changed
                        ? 'Đã sửa, chưa lưu'
                        : undefined
                  }
                  onChange={() => onCell(role.id, module, perm.code)}
                />
              </td>
            )
          })}
          <td className="rm-c-fill" />
        </tr>
      )
    }
  }

  // Cùng bề rộng cột cho bảng đầu và bảng thân, để hai bảng thẳng cột khi tách.
  const cols = (
    <colgroup>
      <col className="rm-col-perm" />
      {roles.map((role) => (
        <col key={role.id} className="rm-col-role" />
      ))}
      <col />
    </colgroup>
  )
  // Cuộn ngang thân bảng thì kéo theo hàng tiêu đề.
  const syncHead = (event) => {
    if (headRef.current) headRef.current.scrollLeft = event.currentTarget.scrollLeft
  }

  return (
    <section className="ds-card rm-card">
      {toolbar}
      {/* Như bảng antd của các màn danh sách: hàng tiêu đề đứng yên, chỉ thân bảng cuộn. */}
      <div className="rm-grid">
        <div className="rm-head-scroll" ref={headRef}>
          <table className="rm-table rm-table--head">
            {cols}
            <thead>
              <tr>
                <th scope="col" className="rm-c-perm">
                  Quyền
                </th>
                {roles.map((role) => (
                  <RoleHead
                    key={role.id}
                    role={role}
                    draftRole={draft[role.id]}
                    modules={modules}
                    total={total}
                    flash={flashId === role.id}
                    menu={menuFor(role)}
                  />
                ))}
                <th className="rm-c-fill" aria-hidden="true" />
              </tr>
            </thead>
          </table>
        </div>
        <div className="rm-scroll" ref={scrollRef} onScroll={syncHead}>
          <table className="rm-table" onMouseOver={highlight} onMouseLeave={clearHighlight}>
            {cols}
            <tbody>
              {shown ? (
                rows
              ) : (
                <tr>
                  <td colSpan={roles.length + 2}>
                    <div className="rm-empty">
                      Không có quyền nào khớp &quot;{query}&quot;.{' '}
                      <Button size="small" onClick={onClearQuery}>
                        Xoá tìm kiếm
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="ds-table-foot rm-foot">
        <span className="ds-num">
          {roles.length} vai trò · {total} quyền trong {modules.length} mục
        </span>
        <span className="rm-legend">
          <span>
            <span className="pc__box pc__box--on">
              <RoleIcon name="check" />
            </span>
            Có quyền
          </span>
          <span>
            <span className="pc__box pc__box--on">
              <RoleIcon name="minus" />
            </span>
            Có một phần mục
          </span>
          <span>
            <span className="pc__box pc__box--changed" />
            Đã sửa, chưa lưu
          </span>
        </span>
      </div>
    </section>
  )
}
