import { Dropdown, Select } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import Banner from '../../../components/ds/Banner'
import ToggleRow from '../../../components/ds/ToggleRow'
import { SegmentedPick } from '../fleet/FleetParts'
import RoleIcon from './RoleIcon'
import { SCOPE_LABEL, cellChanged, effectiveScope, roleChangeCount, viewCodeOf } from './roleMatrix'

const SCOPE_OPTIONS = [
  { value: 'all', label: SCOPE_LABEL.all },
  { value: 'own', label: SCOPE_LABEL.own },
]

// Điện thoại (< 640px): chọn một vai trò, mỗi mục một khối, phạm vi là SegmentedPick, mỗi quyền là một ToggleRow.
export default function RolePhoneView({
  modules,
  roles,
  draft,
  total,
  roleId,
  onRole,
  onCell,
  onScope,
  menuFor,
}) {
  const role = roles.find((r) => r.id === roleId) || roles[roles.length - 1]
  const locked = role.is_system
  const draftRole = draft[role.id]
  const count = locked ? total : draftRole.perms.size
  const changes = locked ? 0 : roleChangeCount(modules, role, draftRole)
  const has = (code) => (locked ? true : draftRole.perms.has(code))

  return (
    <div className="rm-phone">
      <label className="rm-phone__field">
        <span className="rm-phone__label">Vai trò</span>
        <Select
          value={role.id}
          onChange={onRole}
          size="large"
          options={roles.map((r) => ({
            value: r.id,
            label: `${r.name}${r.is_system ? ' (cố định)' : ''}`,
          }))}
          aria-label="Vai trò"
        />
      </label>

      <div className="rm-mrole">
        <div className="rm-mrole__top">
          <b>{role.name}</b>
          {locked ? (
            <span className="rm-chip rm-chip--lock">
              <RoleIcon name="lock" />
              Cố định
            </span>
          ) : null}
          {changes ? <span className="rm-chip">Đã sửa {changes}</span> : null}
          <Dropdown menu={menuFor(role)} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              className="rm-rh__menu"
              aria-label={`Thao tác với vai trò ${role.name}`}
            >
              <RoleIcon name="more" />
            </button>
          </Dropdown>
        </div>
        {role.description ? <span className="rm-phone__muted">{role.description}</span> : null}
        <span className="rm-rh__meta">
          {role.user_count} tài khoản · {locked ? 'toàn quyền' : `${count}/${total} quyền`}
        </span>
        {locked ? (
          <Banner
            tone="neutral"
            icon={LockOutlined}
            title="Quản trị viên luôn có toàn quyền, kể cả quyền thêm sau này. Không sửa được."
          />
        ) : null}
      </div>

      {modules.map((module) => {
        const on = module.permissions.filter((p) => has(p.code)).length
        const showScope = module.scoped && !locked && has(viewCodeOf(module))
        return (
          <section className="rm-mmod" key={module.key}>
            <div className="rm-mmod__head">
              <span className="rm-mod-ic">
                <RoleIcon name={module.key} />
              </span>
              {module.label}
              <small>
                {on}/{module.permissions.length}
              </small>
            </div>
            <div className="rm-mmod__body">
              {showScope ? (
                <div className="rm-phone__field">
                  <span className="rm-phone__label rm-phone__label--sm">Phạm vi dữ liệu</span>
                  <SegmentedPick
                    label={`Phạm vi ${module.label}`}
                    value={effectiveScope(draftRole, module)}
                    options={SCOPE_OPTIONS}
                    onChange={(value) => onScope(role.id, module.key, value)}
                  />
                </div>
              ) : null}
              {module.permissions.map((perm) => (
                <ToggleRow
                  key={perm.code}
                  label={perm.name}
                  hint={perm.description || undefined}
                  value={has(perm.code)}
                  disabled={locked || perm.admin_only}
                  changed={!locked && cellChanged(role, draftRole, perm.code)}
                  onChange={() => onCell(role.id, module, perm.code)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
