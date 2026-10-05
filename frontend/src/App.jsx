import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp } from 'antd'
import { useEffect } from 'react'

import AppLocaleProvider from './components/common/AppLocaleProvider'
import ProtectedRoute from './components/common/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/admin/LoginPage'
import SeafarerListPage from './pages/admin/SeafarerListPage'
import SeafarerDetailPage from './pages/admin/SeafarerDetailPage'
import SeafarerImportPage from './pages/admin/SeafarerImportPage'
import SeafarerFormPage from './pages/admin/SeafarerFormPage'
import MasterSubPage from './pages/admin/MasterSubPage'
import MasterDataHubPage from './pages/admin/MasterDataHubPage'
import MessagingPage from './pages/admin/MessagingPage'
import QREnrollPage from './pages/QREnrollPage'
import UserListPage from './pages/admin/users/UserListPage'
import UserDetailPage from './pages/admin/users/UserDetailPage'
import FormTemplatePage from './pages/admin/FormTemplatePage'
import PartnerListPage from './pages/admin/partners/PartnerListPage'
import PartnerDetailPage from './pages/admin/partners/PartnerDetailPage'
import JobListPage from './pages/admin/partners/JobListPage'
import JobDetailPage from './pages/admin/partners/JobDetailPage'
import DeploymentListPage from './pages/admin/DeploymentListPage'
import DeploymentDetailPage from './pages/admin/DeploymentDetailPage'
import PartnerDashboardPage from './pages/admin/partners/PartnerDashboardPage'
import VesselDetailPage from './pages/admin/partners/VesselDetailPage'
import VesselEditPage from './pages/admin/partners/VesselEditPage'
import VesselCatalogPage from './pages/admin/VesselCatalogPage'
import FinancePage from './pages/admin/finance/FinancePage'

import SeafarerProfilePage from './pages/seafarer/ProfilePage'
import SeafarerHistoryPage from './pages/seafarer/HistoryPage'
import SeafarerCertificatesPage from './pages/seafarer/CertificatesPage'
import { setErrorNotifier } from './utils/notify'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

const antTheme = {
  token: {
    colorPrimary: '#003366',
    colorSuccess: '#07bc0c',
    colorWarning: '#f1c40f',
    colorError: '#e74c3c',
    colorInfo: '#3498db',
    colorTextBase: '#121212',
    colorBgBase: '#ffffff',
    colorBorder: '#D9D9D9',
    borderRadius: 2,
    fontFamily: "'Roboto', -apple-system, 'Segoe UI', sans-serif",
    fontSize: 14,
  },
}

function AppMessageBridge() {
  const { message } = AntApp.useApp()

  useEffect(() => {
    setErrorNotifier((text) => message.error(text))
    return () => setErrorNotifier(null)
  }, [message])

  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLocaleProvider theme={antTheme}>
        <AntApp>
          <AppMessageBridge />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route
                element={
                  <ProtectedRoute roles={['admin', 'operator', 'accountant']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/seafarers" element={<SeafarerListPage />} />
                <Route path="/seafarers/new" element={<SeafarerFormPage />} />
                <Route path="/seafarers/import" element={<SeafarerImportPage />} />
                <Route path="/seafarers/:id" element={<SeafarerDetailPage />} />
                <Route path="/seafarers/:id/edit" element={<SeafarerFormPage />} />
                <Route path="/dashboard" element={<PartnerDashboardPage />} />
                <Route path="/partners" element={<PartnerListPage />} />
                <Route path="/partners/:id" element={<PartnerDetailPage />} />
                <Route path="/partners/vessels/:id" element={<VesselDetailPage />} />
                <Route path="/partners/vessels/:id/edit" element={<VesselEditPage />} />
                <Route path="/jobs" element={<JobListPage />} />
                <Route path="/jobs/:id" element={<JobDetailPage />} />
                <Route path="/deployments" element={<DeploymentListPage />} />
                <Route path="/deployments/:id" element={<DeploymentDetailPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/vessels" element={<VesselCatalogPage />} />
                <Route path="/master-data/vessels" element={<Navigate to="/vessels" replace />} />
                <Route path="/master-data" element={<MasterDataHubPage />} />
                <Route path="/master-data/:tab" element={<MasterSubPage />} />
                <Route path="/messages" element={<MessagingPage />} />
                <Route path="/admin/users" element={<UserListPage />} />
                <Route path="/admin/users/:id" element={<UserDetailPage />} />
                <Route path="/master-data/admin/form-templates" element={<FormTemplatePage />} />
              </Route>

              <Route
                path="/403"
                element={<div style={{ padding: 40 }}>Không có quyền truy cập</div>}
              />

              {/* Public QR enroll */}
              <Route path="/enroll/:token" element={<QREnrollPage />} />

              {/* Seafarer portal (read/write only for seafarer) */}
              <Route path="/portal" element={<Navigate to="/portal/profile" replace />} />
              <Route
                path="/portal/profile"
                element={
                  <ProtectedRoute roles={['seafarer']}>
                    <SeafarerProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portal/history"
                element={
                  <ProtectedRoute roles={['seafarer']}>
                    <SeafarerHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portal/certificates"
                element={
                  <ProtectedRoute roles={['seafarer']}>
                    <SeafarerCertificatesPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AntApp>
      </AppLocaleProvider>
    </QueryClientProvider>
  )
}
