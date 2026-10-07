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
import TrainingCenterListPage from './pages/admin/TrainingCenterListPage'
import TrainingCenterDetailPage from './pages/admin/TrainingCenterDetailPage'
import CourseListPage from './pages/admin/CourseListPage'
import CourseDetailPage from './pages/admin/CourseDetailPage'
import MasterSubPage from './pages/admin/MasterSubPage'
import MessagingPage from './pages/admin/MessagingPage'
import SeafarerRegisterPage from './pages/seafarer/RegisterPage'
import SeafarerVerifyPage from './pages/seafarer/VerifyPage'
import SeafarerProfilePage from './pages/seafarer/ProfilePage'
import SeafarerCertificatesPage from './pages/seafarer/CertificatesPage'
import SeafarerCoursesPage from './pages/seafarer/CoursesPage'
import SeafarerHistoryPage from './pages/seafarer/HistoryPage'
import QREnrollPage from './pages/QREnrollPage'
import UserListPage from './pages/admin/users/UserListPage'
import UserDetailPage from './pages/admin/users/UserDetailPage'
import DesignSystemPage from './pages/DesignSystemPage'
import ExportListPage from './pages/admin/exports/ExportListPage'
import ReviewPage from './pages/admin/review/ReviewPage'
import PackCreatePage from './pages/admin/exports/PackCreatePage'
import PackSignPage from './pages/admin/exports/PackSignPage'
import RemoteSignPage from './pages/sign/RemoteSignPage'
import StandaloneError from './pages/errors/StandaloneError'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={antTheme}>
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="/sign/:packId" element={<RemoteSignPage />} />
              <Route path="/" element={<Navigate to="/seafarers" replace />} />

              <Route
                element={
                  <ProtectedRoute roles={['admin', 'operator', 'reviewer', 'training_center', 'manning_agent']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/seafarers" element={<SeafarerListPage />} />
                <Route path="/seafarers/new" element={<SeafarerFormPage />} />
                <Route path="/seafarers/import" element={<SeafarerImportPage />} />
                <Route path="/seafarers/:id" element={<SeafarerDetailPage />} />
                <Route path="/seafarers/:id/edit" element={<SeafarerFormPage />} />
                <Route path="/seafarers/:id/review" element={<ReviewPage />} />
                <Route path="/exports" element={<ExportListPage />} />
                <Route path="/exports/new" element={<PackCreatePage />} />
                <Route path="/exports/:packId" element={<PackSignPage />} />
                <Route path="/training-centers" element={<TrainingCenterListPage />} />
                <Route path="/training-centers/:id" element={<TrainingCenterDetailPage />} />
                <Route path="/courses" element={<CourseListPage />} />
                <Route path="/courses/:id" element={<CourseDetailPage />} />
                <Route path="/master-data" element={<Navigate to="/master-data/vessels" replace />} />
                <Route path="/master-data/:tab" element={<MasterSubPage />} />
                <Route path="/messages" element={<MessagingPage />} />
                <Route path="/admin/users" element={<UserListPage />} />
                <Route path="/admin/users/:id" element={<UserDetailPage />} />
              </Route>

              <Route path="/403" element={<StandaloneError code={403} />} />
              <Route path="/tc/*" element={<Navigate to="/courses" replace />} />

              {/* Seafarer public routes */}
              <Route path="/seafarer/register" element={<SeafarerRegisterPage />} />
              <Route path="/enroll/:token" element={<QREnrollPage />} />

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
                <Route path="/seafarer/courses" element={<SeafarerCoursesPage />} />
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
