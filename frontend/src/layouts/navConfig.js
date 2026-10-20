// Điều hướng của khung app (UI Kit, tab Màn hình): sidebar 3 nhóm (`group`, ngăn bằng đường kẻ), mục có trang con thì hiện hàng tab dưới topbar.
// `match`: các tiền tố đường dẫn làm mục sáng lên. `tabs`: trang con của mục.

export const NAV_GROUP_LABELS = { 1: 'Hồ sơ', 2: 'Vận hành', 3: 'Hệ thống' }

export const NAV_SECTIONS = [
  { key: 'seafarers', group: 1, label: 'Thuyền viên', icon: 'team', to: '/seafarers', match: ['/seafarers'] },
  { key: 'ship-owners', group: 1, label: 'Đối tác', icon: 'building', to: '/partners', match: ['/partners'] },
  { key: 'vessels', group: 1, label: 'Tàu', icon: 'ship', to: '/vessels', match: ['/vessels'] },
  { key: 'exports', group: 1, label: 'Bản xuất', icon: 'send', to: '/exports', match: ['/exports'] },
  { key: 'voyages', group: 2, label: 'Chuyến tàu', icon: 'anchor', to: '/voyages', match: ['/voyages'] },
  { key: 'contracts', group: 2, label: 'Hợp đồng', icon: 'file', to: '/contracts', match: ['/contracts'] },
  {
    key: 'catalog',
    group: 3,
    label: 'Danh mục',
    icon: 'database',
    to: '/master-data/cert',
    match: ['/master-data'],
    tabs: [
      { to: '/master-data/cert', label: 'Chứng chỉ' },
      { to: '/master-data/vessel', label: 'Loại tàu' },
      { to: '/master-data/contract', label: 'Loại hợp đồng' },
      { to: '/master-data/course', label: 'Loại khóa học' },
      { to: '/master-data/port', label: 'Cảng biển' },
      { to: '/master-data/country', label: 'Quốc gia' },
    ],
  },
  {
    key: 'admin',
    group: 3,
    label: 'Quản trị',
    icon: 'shield',
    to: '/admin/users',
    match: ['/admin', '/training-centers', '/courses', '/messages'],
    tabs: [
      { to: '/admin/users', label: 'Tài khoản' },
      { to: '/training-centers', label: 'Trung tâm đào tạo' },
      { to: '/courses', label: 'Khóa học' },
      { to: '/messages', label: 'Tin nhắn' },
    ],
  },
]

export function sectionsFor() {
  return NAV_SECTIONS
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
