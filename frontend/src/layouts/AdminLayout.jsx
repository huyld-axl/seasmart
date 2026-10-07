import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Dropdown, Drawer, Grid } from 'antd'
import {
  TeamOutlined,
  SendOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  MessageOutlined,
  LogoutOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DownOutlined,
} from '@ant-design/icons'
import NotificationBell from '../components/common/NotificationBell'
import ProductBrand from '../components/common/ProductBrand'
import useAuthStore from '../stores/authStore'
import { ROLE_LABELS } from '../constants/roles'
import { sectionsFor, activeSection, activeTab, initialsOf } from './navConfig'
import './AdminLayout.css'

const { useBreakpoint } = Grid

const ICONS = {
  team: <TeamOutlined />,
  send: <SendOutlined />,
  database: <DatabaseOutlined />,
  shield: <SafetyCertificateOutlined />,
  book: <BookOutlined />,
  message: <MessageOutlined />,
}

function SideNav({ sections, current, collapsed, onNavigate }) {
  return (
    <nav className="app-shell__nav" aria-label="Điều hướng chính">
      {sections.map((section) => (
        <NavLink
          key={section.key}
          to={section.to}
          className="app-shell__nav-item"
          aria-current={current?.key === section.key ? 'page' : undefined}
          title={collapsed ? section.label : undefined}
          onClick={onNavigate}
        >
          {ICONS[section.icon]}
          <span className="app-shell__nav-label">{section.label}</span>
        </NavLink>
      ))}
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

  const sections = sectionsFor(user?.role)
  const current = activeSection(sections, pathname)
  const currentTab = activeTab(current, pathname)

  const userMenu = {
    items: [
      { key: 'meta', type: 'group', label: `${user?.email || ''} · ${ROLE_LABELS[user?.role] || ''}` },
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
          <SideNav sections={sections} current={current} collapsed={collapsed} />
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
          <h1 className="app-shell__title">{current?.label || 'MCAH'}</h1>

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

        {current?.tabs && (
          <nav className="app-shell__tabs" aria-label={current.label}>
            {current.tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="app-shell__tab"
                aria-current={currentTab?.to === tab.to ? 'page' : undefined}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}

        <main className="app-shell__content">
          <Outlet />
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
        <SideNav sections={sections} current={current} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  )
}
