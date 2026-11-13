import HelpLink, { GUIDE_HOME_URL } from '../components/ds/HelpLink'
import { Fragment, forwardRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Button, Dropdown, Drawer } from 'antd'
import Icon from '@ant-design/icons'
import {
  DashboardOutlined,
  TeamOutlined,
  AccountBookOutlined,
  SendOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  LogoutOutlined,
  SettingOutlined,
  CloudDownloadOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DownOutlined,
  FileTextOutlined,
  RightOutlined,
} from '@ant-design/icons'
import NotificationBell from '../components/common/NotificationBell'
import ErrorBoundary from '../components/common/ErrorBoundary'
import ProductBrand from '../components/common/ProductBrand'
import useAuthStore from '../stores/authStore'
import { NAV_GROUP_LABELS, sectionsFor, activeSection, activeTab, initialsOf } from './navConfig'
import { TargetSvg } from '../pages/admin/fleet/FleetParts'
import './AdminLayout.css'
import useViewport from '../hooks/useViewport'
import PdfComponentModal from '../components/common/PdfComponentModal'
import AiConsentModal from '../components/common/AiConsentModal'
import OfflineRibbon from '../components/common/OfflineRibbon'
import MainLinkRibbon from '../components/common/MainLinkRibbon'
import WhatsNewRibbon from '../components/common/WhatsNew'
import DesktopLock from '../components/common/DesktopLock'
import { desktop, isDesktop } from '../lib/desktop'

// Trang có hướng dẫn trong app (public/huong-dan/): hiện link Hướng dẫn ở thanh trên, mở đúng mục của trang hướng dẫn theo đường dẫn.
const guideUrl = (section) => `${GUIDE_HOME_URL}#${section}`
const GUIDE_PATHS = [
  ['/voyages', guideUrl('chuyen-tau')], ['/contracts', guideUrl('hop-dong')], ['/bills', guideUrl('thanh-toan')],
  ['/dashboard', guideUrl('tong-quan')], ['/admin/kpi-targets', guideUrl('muc-tieu')],
]

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ShipSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <path d="M12 3v9M12 5h5l-5 4M3 15l2 4h14l2-4-9-3z" />
    <path d="M2 21c2 0 2-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
  </svg>
)
const BuildingSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <path d="M4 21V5l9-2v18M13 9l7 2v10M2 21h20M8 8h1M8 12h1M8 16h1M16 15h1M16 18h1" />
  </svg>
)

const AnchorSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...stroke}>
    <path d="M12 22V8" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
    <circle cx="12" cy="5" r="3" />
  </svg>
)

const ICONS = {
  dashboard: <DashboardOutlined />,
  team: <TeamOutlined />,
  send: <SendOutlined />,
  database: <DatabaseOutlined />,
  ship: <Icon component={ShipSvg} />,
  anchor: <Icon component={AnchorSvg} />,
  target: <Icon component={TargetSvg} />,
  file: <FileTextOutlined />,
  bill: <AccountBookOutlined />,
  building: <Icon component={BuildingSvg} />,
  shield: <SafetyCertificateOutlined />,
  book: <BookOutlined />,
}

const NavItem = forwardRef(function NavItem({ section, active, expanded, collapsed, onNavigate, onToggle, ...rest }, ref) {
  return (
    <NavLink
      ref={ref}
      {...rest}
      to={section.to}
      className={section.tabs ? 'app-shell__nav-item app-shell__nav-item--parent' : 'app-shell__nav-item'}
      aria-current={section.tabs ? false : active ? 'page' : undefined}
      aria-expanded={section.tabs && !collapsed ? expanded : undefined}
      data-active={active || undefined}
      title={collapsed && !section.tabs ? section.label : undefined}
      onClick={(e) => {
        if (section.tabs && !collapsed) {
          e.preventDefault()
          onToggle()
        } else onNavigate?.(e)
      }}
    >
      {ICONS[section.icon]}
      <span className="app-shell__nav-label">{section.label}</span>
      {section.tabs && <RightOutlined className="app-shell__nav-chev" />}
    </NavLink>
  )
})

// Mục có trang con (Danh mục, Quản trị): bấm vào mục cha chỉ mở / đóng menu con thụt vào, không tự chuyển trang. Mặc định mở ở phân hệ đang xem.
// Sidebar thu gọn thì rê vào icon để hiện danh sách trang con.
function SideNav({ sections, current, currentTab, collapsed, onNavigate, guideHref }) {
  const navigate = useNavigate()
  const [toggled, setToggled] = useState({})
  return (
    <nav className="app-shell__nav" aria-label="Điều hướng chính">
      {sections.map((section, i) => {
        const groupStart = section.group != null && section.group !== sections[i - 1]?.group
        const active = current?.key === section.key
        const expanded = toggled[section.key] ?? active
        let item = (
          <NavItem
            section={section}
            active={active}
            expanded={expanded}
            collapsed={collapsed}
            onNavigate={onNavigate}
            onToggle={() => setToggled({ ...toggled, [section.key]: !expanded })}
          />
        )
        if (section.tabs && collapsed) {
          item = (
            <Dropdown
              placement="bottomLeft"
              align={{ points: ['tl', 'tr'], offset: [8, 0] }}
              menu={{
                items: [{ key: 'title', type: 'group', label: section.label, children: section.tabs.map((tab) => ({ key: tab.to, label: tab.label })) }],
                selectedKeys: active && currentTab ? [currentTab.to] : [],
                onClick: ({ key }) => navigate(key),
              }}
            >
              {item}
            </Dropdown>
          )
        }
        return (
          <Fragment key={section.key}>
            {groupStart && (
              <div className="app-shell__nav-group" aria-hidden="true">
                <span>{NAV_GROUP_LABELS[section.group]}</span>
              </div>
            )}
            {item}
            {section.tabs && expanded && !collapsed && (
              <div className="app-shell__subnav" role="group" aria-label={section.label}>
                {section.tabs.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className="app-shell__nav-item app-shell__nav-item--sub"
                    aria-current={currentTab?.to === tab.to ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <span className="app-shell__nav-label">{tab.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </Fragment>
        )
      })}
      <a
        className="app-shell__nav-item app-shell__nav-item--guide"
        href={guideHref}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? 'Hướng dẫn sử dụng' : undefined}
        onClick={onNavigate}
      >
        <BookOutlined />
        <span className="app-shell__nav-label">Hướng dẫn sử dụng</span>
      </a>
    </nav>
  )
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const guide = GUIDE_PATHS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] || GUIDE_HOME_URL
  const { user, logout } = useAuthStore()
  const isMobile = useViewport().isCompact

  const sections = sectionsFor(user)
  const current = activeSection(sections, pathname)
  const currentTab = activeTab(current, pathname)

  const signOut = () => {
    logout()
    navigate('/login')
  }

  const userMenu = {
    items: [
      { key: 'meta', type: 'group', label: `${user?.email || ''} · ${user?.role?.name || 'Chưa có vai trò'}` },
      { type: 'divider' },
      // App máy tính: cài đặt theo máy và kiểm bản mới (docs/mcah-ke-hoach-desktop-gd1.md 3.6).
      ...(isDesktop()
        ? [
            { key: 'device', icon: <SettingOutlined />, label: 'Cài đặt trên máy này' },
            { key: 'update', icon: <CloudDownloadOutlined />, label: 'Kiểm tra bản mới' },
            { type: 'divider' },
          ]
        : []),
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') signOut()
      if (key === 'device') navigate('/cai-dat-may')
      if (key === 'update') desktop.checkUpdate()
    },
  }

  return (
    <div className="app-shell">
      {!isMobile && (
        <aside className={collapsed ? 'app-shell__sider app-shell__sider--collapsed' : 'app-shell__sider'}>
          <div className="app-shell__brand">
            <ProductBrand collapsed={collapsed} />
          </div>
          <SideNav sections={sections} current={current} currentTab={currentTab} collapsed={collapsed} guideHref={guide} />
        </aside>
      )}

      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <button
            type="button"
            className="app-shell__icon-btn"
            aria-label={isMobile ? 'Mở menu' : collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
          >
            {isMobile ? <MenuOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
          <h1 className="app-shell__title">
            {currentTab ? (
              <>
                <span className="app-shell__title-parent">{current.label} /</span> {currentTab.label}
              </>
            ) : (
              current?.label || (pathname === '/cai-dat-may' ? 'Cài đặt trên máy này' : 'MCAH')
            )}
          </h1>

          <div className="app-shell__right">
            <HelpLink href={guide} />
            <NotificationBell />
            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
              <button type="button" className="app-shell__user" aria-haspopup="menu">
                <span className="app-shell__avatar">{initialsOf(user?.email)}</span>
                <span className="app-shell__user-name">{user?.email}</span>
                <DownOutlined className="app-shell__user-caret" />
              </button>
            </Dropdown>
          </div>
        </header>
        {isDesktop() ? <OfflineRibbon /> : null}
        {isDesktop() ? <MainLinkRibbon /> : null}
        {isDesktop() ? <WhatsNewRibbon /> : null}

        <main className="app-shell__content">
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
            {isDesktop() ? <PdfComponentModal /> : null}
            <AiConsentModal />
            {isDesktop() ? <DesktopLock /> : null}
          </ErrorBoundary>
        </main>
      </div>

      <Drawer
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={280}
        closable={false}
        rootClassName="app-shell__drawer"
        title={<ProductBrand />}
        footer={
          // Ở ngăn kéo hiện luôn tài khoản và Đăng xuất, khỏi mở thêm menu avatar.
          <div className="app-shell__drawer-foot">
            <div className="app-shell__me">
              <span className="app-shell__avatar">{initialsOf(user?.email)}</span>
              <span className="app-shell__me-text">
                <span className="app-shell__me-email">{user?.email}</span>
                <span className="app-shell__me-role">{user?.role?.name || 'Chưa có vai trò'}</span>
              </span>
            </div>
            <Button type="text" block icon={<LogoutOutlined />} onClick={signOut}>
              Đăng xuất
            </Button>
          </div>
        }
      >
        <SideNav sections={sections} current={current} currentTab={currentTab} onNavigate={() => setDrawerOpen(false)} guideHref={guide} />
      </Drawer>
    </div>
  )
}
