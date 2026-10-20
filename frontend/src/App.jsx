import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, App as AntApp } from 'antd'
// Bản ESM: bản CommonJS 'antd/locale/vi_VN' qua Vite thành { default: … }, ConfigProvider rơi về tiếng Anh.
import viVN from 'antd/es/locale/vi_VN'
import { antTheme } from './theme/tokens'

import ProtectedRoute from './components/common/ProtectedRoute'
import useAuthStore from './stores/authStore'
import { sectionsFor } from './layouts/navConfig'
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/admin/LoginPage'
import SeafarerListPage from './pages/admin/SeafarerListPage'
import SeafarerDetailPage from './pages/admin/SeafarerDetailPage'
import SeafarerImportPage from './pages/admin/SeafarerImportPage'
import SeafarerFormPage from './pages/admin/SeafarerFormPage'
import TrainingCenterListPage from './pages/admin/TrainingCenterListPage'
import TrainingCenterDetailPage from './pages/admin/TrainingCenterDetailPage'
import CourseListPage from './pages/admin/CourseListPage'
import CourseDetailPage from './pages/admin/CourseDetailPage'
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
import MessagingPage from './pages/admin/MessagingPage'
import UserListPage from './pages/admin/users/UserListPage'
import UserDetailPage from './pages/admin/users/UserDetailPage'
import DesignSystemPage from './pages/DesignSystemPage'
import ExportListPage from './pages/admin/exports/ExportListPage'
import ReviewPage from './pages/admin/review/ReviewPage'
import UploadPage from './pages/admin/UploadPage'
import PackCreatePage from './pages/admin/exports/PackCreatePage'
import PackDetailPage from './pages/admin/exports/PackDetailPage'
import StandaloneError from './pages/errors/StandaloneError'
import NoRolePage from './pages/errors/NoRolePage'
import RoleMatrixPage from './pages/admin/roles/RoleMatrixPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

// Vào `/`: tới mục đầu tiên người dùng xem được; không có mục nào thì sang /no-role.
function HomeRedirect() {
  const { user, ready } = useAuthStore()
  if (!ready) return null
  return <Navigate to={sectionsFor(user)[0]?.to || '/no-role'} replace />
}

// Lấy quyền mới từ máy chủ một lần khi mở app (đổi quyền có hiệu lực ở lần tải trang tới).
function useRefreshAccess() {
  const token = useAuthStore((state) => state.token)
  useEffect(() => {
    if (token) useAuthStore.getState().refreshUser().catch(() => {})
  }, [token])
}

const guard = (perm, element) => <ProtectedRoute perm={perm}>{element}</ProtectedRoute>

export default function App() {
  useRefreshAccess()
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={antTheme}>
        <AntApp notification={{ bottom: 96 }}>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="/" element={<ProtectedRoute allowNoRole><HomeRedirect /></ProtectedRoute>} />
              <Route path="/no-role" element={<ProtectedRoute allowNoRole><NoRolePage /></ProtectedRoute>} />

              <Route
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/seafarers" element={guard('seafarer.view', <SeafarerListPage />)} />
                <Route path="/seafarers/new" element={guard('seafarer.create', <SeafarerFormPage />)} />
                <Route path="/seafarers/import" element={guard('seafarer.import', <SeafarerImportPage />)} />
                <Route path="/seafarers/:id" element={guard('seafarer.view', <SeafarerDetailPage />)} />
                <Route path="/seafarers/:id/edit" element={guard('seafarer.update', <SeafarerFormPage />)} />
                <Route path="/seafarers/:id/upload" element={guard('seafarer.docs', <UploadPage />)} />
                <Route path="/seafarers/:id/review" element={guard('seafarer.docs', <ReviewPage />)} />
                <Route path="/exports" element={guard('export.view', <ExportListPage />)} />
                <Route path="/exports/new" element={guard('export.create', <PackCreatePage />)} />
                <Route path="/exports/:packId" element={guard('export.view', <PackDetailPage />)} />
                <Route path="/training-centers" element={guard('training.view', <TrainingCenterListPage />)} />
                <Route path="/training-centers/:id" element={guard('training.view', <TrainingCenterDetailPage />)} />
                <Route path="/courses" element={guard('training.view', <CourseListPage />)} />
                <Route path="/courses/:id" element={guard('training.view', <CourseDetailPage />)} />
                <Route path="/vessels" element={guard('vessel.view', <VesselListPage />)} />
                <Route path="/vessels/new" element={guard('vessel.create', <VesselFormPage />)} />
                <Route path="/vessels/:id" element={guard('vessel.view', <VesselDetailPage />)} />
                <Route path="/vessels/:id/edit" element={guard('vessel.update', <VesselFormPage />)} />
                <Route path="/partners" element={guard('partner.view', <PartnerListPage />)} />
                <Route path="/partners/new" element={guard('partner.create', <PartnerFormPage />)} />
                <Route path="/partners/:id" element={guard('partner.view', <PartnerDetailPage />)} />
                <Route path="/partners/:id/edit" element={guard('partner.update', <PartnerFormPage />)} />
                <Route path="/voyages" element={guard('voyage.view', <VoyageListPage />)} />
                <Route path="/voyages/new" element={guard('voyage.create', <VoyageFormPage />)} />
                <Route path="/voyages/:id" element={guard('voyage.view', <VoyageDetailPage />)} />
                <Route path="/voyages/:id/edit" element={guard('voyage.update', <VoyageFormPage />)} />
                <Route path="/contracts" element={guard('contract.view', <ContractListPage />)} />
                <Route path="/contracts/new" element={guard('contract.create', <ContractFormPage />)} />
                <Route path="/contracts/:id" element={guard('contract.view', <ContractDetailPage />)} />
                <Route path="/contracts/:id/edit" element={guard('contract.update', <ContractFormPage />)} />
                <Route path="/fleet" element={<Navigate to="/vessels" replace />} />
                <Route path="/fleet/vessels" element={<Navigate to="/vessels" replace />} />
                <Route path="/fleet/ship-owners" element={<Navigate to="/partners" replace />} />
                <Route path="/master-data" element={<Navigate to="/master-data/cert" replace />} />
                <Route path="/master-data/:tab" element={guard('catalog.view', <MasterSubPage />)} />
                <Route path="/messages" element={guard('message.view', <MessagingPage />)} />
                <Route path="/admin/users" element={guard('account.view', <UserListPage />)} />
                <Route path="/admin/users/:id" element={guard('account.view', <UserDetailPage />)} />
                <Route path="/admin/roles" element={guard('role.manage', <RoleMatrixPage />)} />
              </Route>

              <Route path="/403" element={<StandaloneError code={403} />} />

              <Route path="*" element={<StandaloneError code={404} />} />
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
