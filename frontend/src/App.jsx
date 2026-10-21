import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp } from 'antd'
// Bản ESM: bản CommonJS 'antd/locale/vi_VN' qua Vite thành { default: … }, ConfigProvider rơi về tiếng Anh.
import viVN from 'antd/es/locale/vi_VN'
import { antTheme } from './theme/tokens'

import ProtectedRoute from './components/common/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import SeafarerLayout from './layouts/SeafarerLayout'
import LoginPage from './pages/admin/LoginPage'
import SeafarerListPage from './pages/admin/SeafarerListPage'
import SeafarerDetailPage from './pages/admin/SeafarerDetailPage'
import SeafarerImportPage from './pages/admin/SeafarerImportPage'
import SeafarerFormPage from './pages/admin/SeafarerFormPage'
import MasterSubPage from './pages/admin/MasterSubPage'
import VesselListPage from './pages/admin/fleet/VesselListPage'
import VesselDetailPage from './pages/admin/fleet/VesselDetailPage'
import VesselFormPage from './pages/admin/fleet/VesselFormPage'
import PartnerListPage from './pages/admin/fleet/PartnerListPage'
import PartnerDetailPage from './pages/admin/fleet/PartnerDetailPage'
import PartnerFormPage from './pages/admin/fleet/PartnerFormPage'
import VoyageListPage from './pages/admin/voyages/VoyageListPage'
import VoyageFormPage from './pages/admin/voyages/VoyageFormPage'
import VoyageDetailPage from './pages/admin/voyages/VoyageDetailPage'
import ContractListPage from './pages/admin/contracts/ContractListPage'
import ContractFormPage from './pages/admin/contracts/ContractFormPage'
import ContractDetailPage from './pages/admin/contracts/ContractDetailPage'
import SeafarerRegisterPage from './pages/seafarer/RegisterPage'
import SeafarerVerifyPage from './pages/seafarer/VerifyPage'
import SeafarerProfilePage from './pages/seafarer/ProfilePage'
import SeafarerCertificatesPage from './pages/seafarer/CertificatesPage'
import SeafarerHistoryPage from './pages/seafarer/HistoryPage'
import UserListPage from './pages/admin/users/UserListPage'
import UserDetailPage from './pages/admin/users/UserDetailPage'
import DesignSystemPage from './pages/DesignSystemPage'
import ExportListPage from './pages/admin/exports/ExportListPage'
import ReviewPage from './pages/admin/review/ReviewPage'
import UploadPage from './pages/admin/UploadPage'
import PackCreatePage from './pages/admin/exports/PackCreatePage'
import PackDetailPage from './pages/admin/exports/PackDetailPage'
import StandaloneError from './pages/errors/StandaloneError'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={antTheme}>
        <AntApp notification={{ bottom: 96 }}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="/" element={<Navigate to="/seafarers" replace />} />

              <Route
                element={
                  <ProtectedRoute roles={['admin', 'operator', 'reviewer', 'manning_agent']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/seafarers" element={<SeafarerListPage />} />
                <Route path="/seafarers/new" element={<SeafarerFormPage />} />
                <Route path="/seafarers/import" element={<SeafarerImportPage />} />
                <Route path="/seafarers/:id" element={<SeafarerDetailPage />} />
                <Route path="/seafarers/:id/edit" element={<SeafarerFormPage />} />
                <Route path="/seafarers/:id/upload" element={<UploadPage />} />
                <Route path="/seafarers/:id/review" element={<ReviewPage />} />
                <Route path="/exports" element={<ExportListPage />} />
                <Route path="/exports/new" element={<PackCreatePage />} />
                <Route path="/exports/:packId" element={<PackDetailPage />} />
                <Route path="/vessels" element={<VesselListPage />} />
                <Route path="/vessels/new" element={<VesselFormPage />} />
                <Route path="/vessels/:id" element={<VesselDetailPage />} />
                <Route path="/vessels/:id/edit" element={<VesselFormPage />} />
                <Route path="/partners" element={<PartnerListPage />} />
                <Route path="/partners/new" element={<PartnerFormPage />} />
                <Route path="/partners/:id" element={<PartnerDetailPage />} />
                <Route path="/partners/:id/edit" element={<PartnerFormPage />} />
                <Route path="/voyages" element={<VoyageListPage />} />
                <Route path="/voyages/new" element={<VoyageFormPage />} />
                <Route path="/voyages/:id" element={<VoyageDetailPage />} />
                <Route path="/voyages/:id/edit" element={<VoyageFormPage />} />
                <Route path="/contracts" element={<ContractListPage />} />
                <Route path="/contracts/new" element={<ContractFormPage />} />
                <Route path="/contracts/:id" element={<ContractDetailPage />} />
                <Route path="/contracts/:id/edit" element={<ContractFormPage />} />
                <Route path="/fleet" element={<Navigate to="/vessels" replace />} />
                <Route path="/fleet/vessels" element={<Navigate to="/vessels" replace />} />
                <Route path="/fleet/ship-owners" element={<Navigate to="/partners" replace />} />
                <Route path="/master-data" element={<Navigate to="/master-data/cert" replace />} />
                <Route path="/master-data/:tab" element={<MasterSubPage />} />
                <Route path="/admin/users" element={<UserListPage />} />
                <Route path="/admin/users/:id" element={<UserDetailPage />} />
              </Route>

              <Route path="/403" element={<StandaloneError code={403} />} />
              <Route path="/tc/*" element={<Navigate to="/seafarers" replace />} />

              {/* Seafarer public routes */}
              <Route path="/seafarer/register" element={<SeafarerRegisterPage />} />

              {/* Seafarer protected routes */}
              <Route
                element={
                  <ProtectedRoute roles={['seafarer']}>
                    <SeafarerLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/seafarer/verify" element={<SeafarerVerifyPage />} />
                <Route path="/seafarer/profile" element={<SeafarerProfilePage />} />
                <Route path="/seafarer/certificates" element={<SeafarerCertificatesPage />} />
                <Route path="/seafarer/history" element={<SeafarerHistoryPage />} />
              </Route>

              <Route path="*" element={<StandaloneError code={404} />} />
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
