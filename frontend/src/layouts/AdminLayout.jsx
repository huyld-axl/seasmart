import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Drawer, Grid } from 'antd'
import NotificationBell from '../components/common/NotificationBell'
import {
  TeamOutlined,
  BankOutlined,
  BookOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  CarOutlined,
  GlobalOutlined,
  FileTextOutlined,
  ReadOutlined,
  AimOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import useAuthStore from '../stores/authStore'
import './AdminLayout.css'

const { Sider, Header, Content } = Layout
const { useBreakpoint } = Grid

function getMenuItems(role) {
  if (role === 'training_center') {
    return [
      { key: '/courses', icon: <BookOutlined />, label: 'Khóa học' },
      { key: '/messages', icon: <MessageOutlined />, label: 'Tin nhắn' },
    ]
  }
  return [
    { key: '/seafarers', icon: <TeamOutlined />, label: 'Thuyền viên' },
    { key: '/training-centers', icon: <BankOutlined />, label: 'Trung tâm đào tạo' },
    { key: '/courses', icon: <BookOutlined />, label: 'Khóa học' },
    { key: '/messages', icon: <MessageOutlined />, label: 'Tin nhắn' },
    { key: '/admin/users', icon: <UsergroupAddOutlined />, label: 'Quản lý User' },
    {
      key: '/master-data',
      icon: <DatabaseOutlined />,
      label: 'Danh mục',
      children: [
        { key: '/master-data/cert', icon: <SafetyCertificateOutlined />, label: 'Chứng chỉ' },
        { key: '/master-data/vessel', icon: <CarOutlined />, label: 'Loại tàu' },
        { key: '/master-data/contract', icon: <FileTextOutlined />, label: 'Loại hợp đồng' },
        { key: '/master-data/course', icon: <ReadOutlined />, label: 'Loại khóa học' },
        { key: '/master-data/port', icon: <AimOutlined />, label: 'Cảng biển' },
      ],
    },
  ]
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const userMenu = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true }],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
        navigate('/login')
      }
    },
  }

  const selectedKey = location.pathname
  const openKeys = location.pathname.startsWith('/master-data') ? ['/master-data'] : []

  const handleMenuClick = ({ key }) => {
    navigate(key)
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
        >
          <div
            className={[
              'admin-layout__logo',
              collapsed ? 'admin-layout__logo--collapsed' : 'admin-layout__logo--expanded',
            ].join(' ')}
          >
            {collapsed ? 'MP' : 'MarinePort'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={openKeys}
            items={getMenuItems(user?.role)}
            onClick={handleMenuClick}
            className="admin-layout__menu"
          />
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

          <NotificationBell />

          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="admin-layout__user">
              <Avatar size={32} icon={<UserOutlined />} style={{ background: '#003366' }} />
              <span className="admin-layout__user-email">{user?.email}</span>
            </div>
          </Dropdown>
        </Header>

        <Content className="admin-layout__content">
          <Outlet />
        </Content>
      </Layout>

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={240}
        styles={{
          body: { padding: 0, background: '#001529' },
          header: { background: '#001529', borderBottom: '1px solid rgba(255,255,255,0.1)' },
        }}
        title={<span className="admin-layout__drawer-title">MarinePort</span>}
        closeIcon={<span className="admin-layout__drawer-close">✕</span>}
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={getMenuItems(user?.role)}
          onClick={handleMenuClick}
          className="admin-layout__menu"
        />
      </Drawer>
    </Layout>
  )
}
