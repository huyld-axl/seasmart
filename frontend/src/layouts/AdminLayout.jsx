import { Fragment, forwardRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Dropdown, Drawer, Grid } from 'antd'
import Icon from '@ant-design/icons'
import {
  TeamOutlined,
  AccountBookOutlined,
  SendOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  LogoutOutlined,
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
import './AdminLayout.css'

const { useBreakpoint } = Grid

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
  team: <TeamOutlined />,
  send: <SendOutlined />,
  database: <DatabaseOutlined />,
  ship: <Icon component={ShipSvg} />,
  anchor: <Icon component={AnchorSvg} />,
  file: <FileTextOutlined />,
  bill: <AccountBookOutlined />,
  building: <Icon component={BuildingSvg} />,
  shield: <SafetyCertificateOutlined />,
  book: <BookOutlined />,
}

const NavItem = forwardRef(function NavItem({ section, active, collapsed, onNavigate, ...rest }, ref) {
  return (
    <NavLink
      ref={ref}
      {...rest}
      to={section.to}
      className={section.tabs ? 'app-shell__nav-item app-shell__nav-item--parent' : 'app-shell__nav-item'}
      aria-current={section.tabs ? false : active ? 'page' : undefined}
      aria-expanded={section.tabs && !collapsed ? active : undefined}
      data-active={active || undefined}
      title={collapsed && !section.tabs ? section.label : undefined}
      onClick={onNavigate}
    >
      {ICONS[section.icon]}
      <span className="app-shell__nav-label">{section.label}</span>
      {section.tabs && <RightOutlined className="app-shell__nav-chev" />}
    </NavLink>
  )
})

// Mục có trang con (Danh mục, Quản trị): trang con là menu con thụt vào dưới mục cha, chỉ mở ở phân hệ đang xem.
// Sidebar thu gọn thì rê vào icon để hiện danh sách trang con.
function SideNav({ sections, current, currentTab, collapsed, onNavigate }) {
  const navigate = useNavigate()
  return (
    <nav className="app-shell__nav" aria-label="Điều hướng chính">
      {sections.map((section, i) => {
        const groupStart = section.group != null && section.group !== sections[i - 1]?.group
        const active = current?.key === section.key
        let item = <NavItem section={section} active={active} collapsed={collapsed} onNavigate={onNavigate} />
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
            {section.tabs && active && !collapsed && (
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
    </nav>
  )
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const sections = sectionsFor(user)
  const current = activeSection(sections, pathname)
  const currentTab = activeTab(current, pathname)

  const userMenu = {
    items: [
      { key: 'meta', type: 'group', label: `${user?.email || ''} · ${user?.role?.name || 'Chưa có vai trò'}` },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
        navigate('/login')
      }
    },
  }

  return (
    <div className="app-shell">
      {!isMobile && (
        <aside className={collapsed ? 'app-shell__sider app-shell__sider--collapsed' : 'app-shell__sider'}>
          <div className="app-shell__brand">
            <ProductBrand collapsed={collapsed} />
          </div>
          <SideNav sections={sections} current={current} currentTab={currentTab} collapsed={collapsed} />
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
              current?.label || 'MCAH'
            )}
          </h1>

          <div className="app-shell__right">
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

        <main className="app-shell__content">
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
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
      >
        <SideNav sections={sections} current={current} currentTab={currentTab} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  )
}
