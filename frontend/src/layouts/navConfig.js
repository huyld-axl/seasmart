// Điều hướng của khung app (UI Kit, tab Màn hình): sidebar 3 nhóm (`group`, ngăn bằng đường kẻ), mục có trang con thì trang con hiện thành menu con thụt vào dưới mục cha.
// `match`: các tiền tố đường dẫn làm mục sáng lên. `tabs`: trang con của mục.

export const NAV_GROUP_LABELS = { 1: 'Hồ sơ', 2: 'Vận hành', 3: 'Hệ thống' }

export const NAV_SECTIONS = [
  { key: 'seafarers', group: 1, label: 'Thuyền viên', icon: 'team', to: '/seafarers', match: ['/seafarers'], perm: 'seafarer.view' },
  { key: 'ship-owners', group: 1, label: 'Đối tác', icon: 'building', to: '/partners', match: ['/partners'], perm: 'partner.view' },
  { key: 'vessels', group: 1, label: 'Tàu', icon: 'ship', to: '/vessels', match: ['/vessels'], perm: 'vessel.view' },
  { key: 'exports', group: 1, label: 'Bản xuất', icon: 'send', to: '/exports', match: ['/exports'], perm: 'export.view' },
  { key: 'voyages', group: 2, label: 'Chuyến tàu', icon: 'anchor', to: '/voyages', match: ['/voyages'], perm: 'voyage.view' },
  { key: 'contracts', group: 2, label: 'Hợp đồng', icon: 'file', to: '/contracts', match: ['/contracts'], perm: 'contract.view' },
  { key: 'bills', group: 2, label: 'Yêu cầu thanh toán', icon: 'bill', to: '/bills', match: ['/bills'], perm: 'bill.view' },
  {
    key: 'catalog',
    group: 3,
    label: 'Danh mục',
    icon: 'database',
    to: '/master-data/cert',
    match: ['/master-data'],
    perm: 'catalog.view',
    tabs: [
      { to: '/master-data/cert', label: 'Chứng chỉ', perm: 'catalog.view' },
      { to: '/master-data/vessel', label: 'Loại tàu', perm: 'catalog.view' },
      { to: '/master-data/contract', label: 'Loại hợp đồng', perm: 'catalog.view' },
      { to: '/master-data/port', label: 'Cảng biển', perm: 'catalog.view' },
      { to: '/master-data/country', label: 'Quốc gia', perm: 'catalog.view' },
    ],
  },
  {
    key: 'admin',
    group: 3,
    label: 'Quản trị',
    icon: 'shield',
    to: '/admin/users',
    match: ['/admin'],
    tabs: [
      { to: '/admin/users', label: 'Tài khoản', perm: 'account.view' },
      { to: '/admin/roles', label: 'Vai trò và quyền', perm: 'role.manage' },
    ],
  },
]

// Mục và tab người dùng được xem. Mục có tab thì ẩn khi không còn tab nào, `to` trỏ tới tab đầu tiên còn lại.
export function sectionsFor(user) {
  const has = (perm) => !perm || (user?.permissions || []).includes(perm)
  return NAV_SECTIONS.flatMap((section) => {
    if (section.tabs) {
      const tabs = section.tabs.filter((tab) => has(tab.perm))
      return tabs.length && has(section.perm) ? [{ ...section, tabs, to: tabs[0].to }] : []
    }
    return has(section.perm) ? [section] : []
  })
}

const startsWithPath = (pathname, prefix) => pathname === prefix || pathname.startsWith(prefix + '/')

export function activeSection(sections, pathname) {
  return sections.find((section) => section.match.some((prefix) => startsWithPath(pathname, prefix))) || null
}

export function activeTab(section, pathname) {
  if (!section?.tabs) return null
  return section.tabs.find((tab) => startsWithPath(pathname, tab.to)) || null
}

// Chữ trong ô avatar: hai chữ đầu của phần trước @, viết hoa.
export function initialsOf(email = '') {
  const local = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
  return (local.slice(0, 2) || '?').toUpperCase()
}
