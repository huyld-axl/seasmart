import { useState, useMemo } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Drawer, Grid, Space } from 'antd'
import {
  TeamOutlined,
  BankOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
  SwapOutlined,
  ClusterOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import useAuthStore from '../stores/authStore'
import useTranslation from '../hooks/useTranslation'
import './AdminLayout.css'

const { Sider, Header, Content } = Layout
const { useBreakpoint } = Grid

function getMenuItems(role, t) {
  const mainItems = [
    {
      key: '/dashboard',
      icon: <AppstoreOutlined />,
      label: <Link to="/dashboard">{t('menu.dashboard')}</Link>,
    },
    {
      key: '/seafarers',
      icon: <TeamOutlined />,
      label: <Link to="/seafarers">{t('menu.seafarers')}</Link>,
    },
    {
      key: '/partners',
      icon: <BankOutlined />,
      label: <Link to="/partners">{t('menu.partners')}</Link>,
    },
    { key: '/jobs', icon: <FileTextOutlined />, label: <Link to="/jobs">{t('menu.jobs')}</Link> },
    {
      key: '/deployments',
      icon: <SwapOutlined />,
      label: <Link to="/deployments">{t('menu.deployments')}</Link>,
    },
    {
      key: '/finance',
      icon: <DollarOutlined />,
      label: <Link to="/finance">{t('menu.finance')}</Link>,
    },
    {
      key: '/vessels',
      icon: <ClusterOutlined />,
      label: <Link to="/vessels">{t('menu.vesselCatalog')}</Link>,
    },
  ]

  return mainItems
}

function getBottomMenuItems(role, t) {
  if (role === 'admin') {
    return [
      {
        key: '/admin/users',
        icon: <UsergroupAddOutlined />,
        label: <Link to="/admin/users">{t('menu.users')}</Link>,
      },
    ]
  }
  return []
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { t } = useTranslation()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const menuItems = useMemo(() => getMenuItems(user?.role, t), [user?.role, t])
  const bottomMenuItems = useMemo(() => getBottomMenuItems(user?.role, t), [user?.role, t])

  const userMenu = useMemo(
    () => ({
      items: [{ key: 'logout', icon: <LogoutOutlined />, label: t('auth.logout'), danger: true }],
      onClick: ({ key }) => {
        if (key === 'logout') {
          logout()
          navigate('/login')
        }
      },
    }),
    [t, logout, navigate]
  )

  const selectedKey = location.pathname.startsWith('/deployments/')
    ? '/deployments'
    : location.pathname

  const handleMenuClick = () => {
    if (isMobile) setDrawerOpen(false)
  }

  return (
    <Layout className="admin-layout">
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={240}
          className="admin-layout__sider"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div
            className={[
              'admin-layout__logo',
              collapsed ? 'admin-layout__logo--collapsed' : 'admin-layout__logo--expanded',
            ].join(' ')}
          >
            {collapsed ? t('brand.short') : t('brand.title')}
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={handleMenuClick}
              className="admin-layout__menu"
            />
          </div>
          {user?.role === 'admin' && (
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={bottomMenuItems}
              onClick={handleMenuClick}
              style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
            />
          )}
        </Sider>
      )}

      <Layout>
        <Header className="admin-layout__header">
          <span
            className="admin-layout__header-trigger"
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
          >
            {isMobile ? (
              <MenuUnfoldOutlined />
            ) : collapsed ? (
              <MenuUnfoldOutlined />
            ) : (
              <MenuFoldOutlined />
            )}
          </span>

          {/* <NotificationBell /> */}

          <Space size="middle" className="admin-layout__header-actions">
            <Dropdown menu={userMenu} placement="bottomRight">
              <div className="admin-layout__user">
                <Avatar size={32} icon={<UserOutlined />} style={{ background: '#003366' }} />
                <span className="admin-layout__user-email">{user?.email}</span>
              </div>
            </Dropdown>
          </Space>
        </Header>

        <Content
          className={`admin-layout__content${isMobile ? ' admin-layout__content--mobile' : ''}`}
        >
          <Outlet />
        </Content>
      </Layout>

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="default"
        styles={{
          body: { padding: 0, background: '#001529', display: 'flex', flexDirection: 'column' },
          header: { background: '#001529', borderBottom: '1px solid rgba(255,255,255,0.1)' },
        }}
        title={<span className="admin-layout__drawer-title">{t('brand.title')}</span>}
        closeIcon={<span className="admin-layout__drawer-close">✕</span>}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
            className="admin-layout__menu"
          />
        </div>
        {user?.role === 'admin' && (
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={bottomMenuItems}
            onClick={handleMenuClick}
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          />
        )}
      </Drawer>
    </Layout>
  )
}
