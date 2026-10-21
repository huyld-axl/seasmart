import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { App, Button, Input, Skeleton } from 'antd'
import {
  CheckCircleFilled,
  ExpandAltOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  ShrinkOutlined,
} from '@ant-design/icons'
import { EmptyState } from '../../../components/ds/Controls'
import useToast from '../../../components/ds/useToast'
import useMediaQuery from '../../../hooks/useMediaQuery'
import {
  useDeleteRole,
  useRoleCatalog,
  useRoles,
  useSaveRolePermissions,
} from '../../../hooks/useRoles'
import apiErrorText from '../../../utils/apiError'
import PermissionMatrix from './PermissionMatrix'
import RoleDeleteModal from './RoleDeleteModal'
import RoleFormModal from './RoleFormModal'
import RoleIcon from './RoleIcon'
import RolePhoneView from './RolePhoneView'
import RoleSaveModal from './RoleSaveModal'
import {
  allChanges,
  buildDraft,
  reconcileDraft,
  setScope,
  toSavePayload,
  toggleCell,
  toggleModule,
  totalChanges,
} from './roleMatrix'
import '../seafarers/SeafarerForm.css'
import './roles.css'

// Quản trị › Vai trò và quyền: ma trận quyền (hàng) × vai trò (cột). Sửa nhiều ô rồi lưu một lần qua hộp thoại tóm tắt.
export default function RoleMatrixPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { modal } = App.useApp()
  const catalogQuery = useRoleCatalog()
  const rolesQuery = useRoles()
  const save = useSaveRolePermissions()
  const remove = useDeleteRole()

  const [draftState, setDraft] = useState({})
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [flashId, setFlashId] = useState(null)
  const [form, setForm] = useState(null) // { mode: 'add' | 'edit', role?, initial? }
  const [deleting, setDeleting] = useState(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [phoneRoleId, setPhoneRoleId] = useState(null)
  const isPhone = useMediaQuery('(max-width: 639px)')
  const scrollRef = useRef(null)

  const modules = catalogQuery.data?.modules
  const total = catalogQuery.data?.total ?? 0
  const roles = useMemo(() => rolesQuery.data || [], [rolesQuery.data])
  // Nháp của vai trò đã có được giữ nguyên khi thêm / sửa / xoá vai trò khác; vai trò mới lấy từ bản đã lưu.
  const draft = useMemo(() => reconcileDraft(draftState, roles), [draftState, roles])
  const changes = useMemo(
    () => (modules ? allChanges(modules, roles, draft) : []),
    [modules, roles, draft]
  )
  const count = totalChanges(changes)
  const dirty = count > 0

  const update = useCallback(
    (roleId, fn) =>
      setDraft((prev) => ({
        ...reconcileDraft(prev, roles),
        [roleId]: fn(reconcileDraft(prev, roles)[roleId]),
      })),
    [roles]
  )

  // Rời trang khi còn thay đổi chưa lưu thì hỏi xác nhận.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    modal.confirm({
      title: 'Rời trang này?',
      content: `Còn ${count} thay đổi quyền chưa lưu. Rời trang sẽ mất các thay đổi này.`,
      okText: 'Rời trang',
      cancelText: 'Ở lại',
      okButtonProps: { danger: true },
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
  }, [blocker, modal, count])
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Vai trò mới tạo: cuộn ngang tới cột cuối, đầu cột nháy sáng.
  useEffect(() => {
    if (flashId == null || !roles.some((r) => r.id === flashId)) return undefined
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
    const timer = setTimeout(() => setFlashId(null), 3500)
    return () => clearTimeout(timer)
  }, [flashId, roles])

  const onCell = (roleId, module, code) => {
    const role = roles.find((r) => r.id === roleId)
    const result = toggleCell(draft[roleId], module, code)
    update(roleId, () => result.draftRole)
    if (result.autoAdded) {
      const view = module.permissions.find((p) => p.code === result.autoAdded)
      toast.info(`Đã tự tích "${view.name}"`, { description: `Cần quyền Xem của ${module.label} mới làm được việc khác.` })
    } else if (result.autoRemoved.length) {
      toast.info(`Đã bỏ luôn ${result.autoRemoved.length} quyền khác của ${module.label}`, {
        description: `Không có quyền Xem thì ${role.name} không làm được các việc này.`,
      })
    }
  }
  const onModule = (roleId, module) => update(roleId, (d) => toggleModule(d, module))
  const onScope = (roleId, moduleKey, value) => update(roleId, (d) => setScope(d, moduleKey, value))
  const onCollapse = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const allCollapsed = modules ? collapsed.size === modules.length : false

  const discard = () => {
    setDraft(buildDraft(roles))
    toast.info('Đã bỏ các thay đổi chưa lưu')
  }

  async function confirmSave() {
    try {
      const saved = await save.mutateAsync(toSavePayload(modules, changes, draft))
      setDraft(buildDraft(saved))
      setSaveOpen(false)
      toast.success(`Đã lưu ${count} thay đổi quyền`)
    } catch (error) {
      setSaveOpen(false)
      toast.error('Không lưu được thay đổi quyền', { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  async function confirmDelete(role) {
    try {
      await remove.mutateAsync(role.id)
      setDeleting(null)
      toast.success(`Đã xoá vai trò ${role.name}`)
    } catch (error) {
      setDeleting(null)
      toast.error(`Không xoá được vai trò ${role.name}`, { description: apiErrorText(error, 'Thử lại sau ít phút.') })
    }
  }

  const viewUsers = (role) => navigate(`/admin/users?role_id=${role.id}`)

  const menuFor = (role) => {
    const users = {
      key: 'users',
      icon: <RoleIcon name="users" />,
      label: `Xem ${role.user_count} tài khoản`,
    }
    const items = role.is_system
      ? [{ key: 'meta', type: 'group', label: 'Vai trò cố định' }, users]
      : [
          { key: 'edit', icon: <RoleIcon name="edit" />, label: 'Sửa tên và mô tả' },
          { key: 'dup', icon: <RoleIcon name="copy" />, label: 'Nhân bản vai trò' },
          users,
          { type: 'divider' },
          { key: 'del', icon: <RoleIcon name="trash" />, label: 'Xoá vai trò', danger: true },
        ]
    return {
      items,
      onClick: ({ key }) => {
        if (key === 'edit') setForm({ mode: 'edit', role })
        else if (key === 'dup')
          setForm({
            mode: 'add',
            initial: {
              name: `Bản sao của ${role.name}`,
              description: role.description || '',
              copy: role.id,
            },
          })
        else if (key === 'users') viewUsers(role)
        else if (key === 'del') setDeleting(role)
      },
    }
  }

  const ready =
    Boolean(modules) && !rolesQuery.isLoading && !rolesQuery.isError && !catalogQuery.isError
  const addButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ mode: 'add' })}>
      Thêm vai trò
    </Button>
  )
  // Toolbar trong card, cùng khuôn các màn danh sách: tìm, thu gọn, nút chính ở cuối.
  const toolbar = (
    <div className="ds-toolbar">
      {ready && !isPhone ? (
        <>
          <Input
            className="ds-toolbar__search"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm quyền, ví dụ: duyệt"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Tìm quyền"
          />
          <Button
            icon={allCollapsed ? <ExpandAltOutlined /> : <ShrinkOutlined />}
            onClick={() =>
              setCollapsed(allCollapsed ? new Set() : new Set(modules.map((m) => m.key)))
            }
          >
            {allCollapsed ? 'Mở tất cả' : 'Thu gọn tất cả'}
          </Button>
        </>
      ) : null}
      <span className="ds-toolbar__end">{addButton}</span>
    </div>
  )

  let body
  if (catalogQuery.isError || rolesQuery.isError) {
    body = (
      <EmptyState
        isError
        title="Không tải được vai trò và quyền"
        description="Mất kết nối tới máy chủ."
        action={
          <Button
            onClick={() => {
              catalogQuery.refetch()
              rolesQuery.refetch()
            }}
          >
            Thử lại
          </Button>
        }
      />
    )
  } else if (!modules || rolesQuery.isLoading) {
    body = (
      <section className="ds-card rm-card" aria-busy="true">
        {toolbar}
        <div style={{ padding: 20 }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </section>
    )
  } else {
    body = (
      <>
        {isPhone ? (
          <>
          {toolbar}
          <RolePhoneView
            modules={modules}
            roles={roles}
            draft={draft}
            total={total}
            roleId={phoneRoleId}
            onRole={setPhoneRoleId}
            onCell={onCell}
            onScope={onScope}
            menuFor={menuFor}
          />
          </>
        ) : (
          <PermissionMatrix
            modules={modules}
            roles={roles}
            draft={draft}
            total={total}
            query={query}
            collapsed={collapsed}
            flashId={flashId}
            scrollRef={scrollRef}
            menuFor={menuFor}
            onCell={onCell}
            onModule={onModule}
            onScope={onScope}
            onCollapse={onCollapse}
            toolbar={toolbar}
            onClearQuery={() => setQuery('')}
          />
        )}
        <div className="sf-savebar">
          {dirty ? (
            <div className="sf-savebar__msg">
              <InfoCircleOutlined aria-hidden />
              <span>
                <b>{count} thay đổi chưa lưu</b> ở {changes.map((c) => c.role.name).join(', ')}
              </span>
            </div>
          ) : (
            <div className="sf-savebar__msg sf-savebar__msg--ok">
              <CheckCircleFilled aria-hidden />
              <span>Đã lưu. Chưa có thay đổi mới.</span>
            </div>
          )}
          <div className="sf-savebar__actions">
            {dirty ? <Button onClick={discard}>Bỏ thay đổi</Button> : null}
            <Button type="primary" disabled={!dirty} onClick={() => setSaveOpen(true)}>
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="ds-page rm-page">
      {body}
      <RoleSaveModal
        open={saveOpen}
        changes={changes}
        saving={save.isPending}
        onBack={() => setSaveOpen(false)}
        onConfirm={confirmSave}
      />
      <RoleFormModal
        open={Boolean(form)}
        mode={form?.mode}
        role={form?.role}
        initial={form?.initial}
        roles={roles}
        onClose={() => setForm(null)}
        onCreated={(role) => {
          setFlashId(role.id)
          setPhoneRoleId(role.id)
        }}
      />
      <RoleDeleteModal
        role={deleting}
        deleting={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        onViewUsers={viewUsers}
      />
    </div>
  )
}
