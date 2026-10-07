// Điều hướng của khung app (UI Kit, tab Màn hình): sidebar 4 mục, mục có trang con thì hiện hàng tab dưới topbar.
// `match`: các tiền tố đường dẫn làm mục sáng lên. `tabs`: trang con của mục.

export const NAV_SECTIONS = [
  {
    key: 'seafarers',
    label: 'Thuyền viên',
    icon: 'team',
    to: '/seafarers',
    match: ['/seafarers'],
  },
  {
    key: 'exports',
    label: 'Bản xuất',
    icon: 'send',
    to: '/exports',
    match: ['/exports'],
  },
  {
    key: 'catalog',
    label: 'Danh mục',
    icon: 'database',
    to: '/master-data/vessels',
    match: ['/master-data'],
    tabs: [
      { to: '/master-data/vessels', label: 'Tàu' },
      { to: '/master-data/ship-owners', label: 'Chủ tàu' },
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

// Trung tâm đào tạo chỉ thấy khóa học và tin nhắn của mình.
export const TRAINING_CENTER_SECTIONS = [
  { key: 'courses', label: 'Khóa học', icon: 'book', to: '/courses', match: ['/courses'] },
  { key: 'messages', label: 'Tin nhắn', icon: 'message', to: '/messages', match: ['/messages'] },
]

export function sectionsFor(role) {
  return role === 'training_center' ? TRAINING_CENTER_SECTIONS : NAV_SECTIONS
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
