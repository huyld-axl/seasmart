import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Drawer, Grid } from 'antd'
import {
  UserOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import useAuthStore from '../stores/authStore'

const { useBreakpoint } = Grid

const { Header, Content } = Layout

const menuItems = [
  { key: '/seafarer/profile', icon: <UserOutlined />, label: 'Hồ sơ' },
  { key: '/seafarer/certificates', icon: <SafetyCertificateOutlined />, label: 'Chứng chỉ' },
  { key: '/seafarer/courses', icon: <BookOutlined />, label: 'Khóa học' },
  { key: '/seafarer/history', icon: <HistoryOutlined />, label: 'Lịch sử' },
]

export default function SeafarerLayout() {
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

  const handleMenuClick = ({ key }) => {
    navigate(key)
    setDrawerOpen(false)
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header
        style={{
          background: '#001529',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 32 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
            MarinePort
          </span>
          {!isMobile && (
            <Menu
              theme="dark"
              mode="horizontal"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ background: 'transparent', borderBottom: 'none', flex: 1 }}
            />
          )}
          {isMobile && (
            <span
              style={{ color: '#fff', fontSize: 18, cursor: 'pointer' }}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuOutlined />
            </span>
          )}
        </div>

        <Dropdown menu={userMenu} placement="bottomRight">
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar size={32} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
            {!isMobile && (
              <span
                style={{
                  color: '#fff',
                  fontSize: 13,
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email}
              </span>
            )}
          </div>
        </Dropdown>
      </Header>

      <Content
        style={{ padding: isMobile ? 12 : 24, maxWidth: 800, margin: '0 auto', width: '100%' }}
      >
        <Outlet />
      </Content>

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={240}
        styles={{
          body: { padding: 0, background: '#001529' },
          header: { background: '#001529', borderBottom: '1px solid rgba(255,255,255,0.1)' },
        }}
        title={<span style={{ color: '#fff', fontWeight: 700 }}>MarinePort</span>}
        closeIcon={<span style={{ color: '#fff' }}>✕</span>}
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ marginTop: 8 }}
        />
      </Drawer>
    </Layout>
  )
}
