import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppToastContainer } from './lib/appToast'
import GlobalLoading from './components/ui/GlobalLoading'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ArtisanDashboard from './pages/artisan/ArtisanDashboard'
import ArtisanOrderDetailPage from './pages/artisan/ArtisanOrderDetailPage'
import ArtisanCustomOrderDetailPage from './pages/artisan/ArtisanCustomOrderDetailPage'
import ArtisanCustomRequestDetailPage from './pages/artisan/ArtisanCustomRequestDetailPage'

import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import CustomerLayout from './pages/customer/CustomerLayout'
import ProfilePage from './pages/customer/ProfilePage'
import PaymentPage from './pages/customer/PaymentPage'
import PaymentDetailPage from './pages/customer/PaymentDetailPage'
import OrderHistoryPage from './pages/customer/OrderHistoryPage'
import RegisterForm from './components/RegisterForm/RegisterForm'
import ProductDetailsPage from './pages/ProductDetailsPage'
import ArtisanDirectoryPage from './pages/ArtisanDirectoryPage'
import ArtisanProfilePage from './pages/ArtisanProfilePage'
import ArtisanCentrePage from './pages/ArtisanCentrePage'
import ShopPage from './pages/ShopPage'
import CustomRequestsManagePage from './pages/customer/CustomRequestsManagePage'
import CustomRequestPage from './pages/customer/CustomRequestPage'
import ManageCustomRequestPage from './pages/customer/ManageCustomRequest'
import CustomRequestDetailPage from './pages/customer/CustomRequestDetailPage'
import PendingCustomOrdersPage from './pages/customer/PendingCustomOrdersPage'
import ChatPage from './pages/customer/ChatPage'
import TemplateOrderPage from './pages/TemplateOrderPage'
import TemplateCatalogPage from './pages/TemplateCatalogPage'
import AboutUsPage from './pages/AboutUsPage'

import CheckoutPage from './pages/CheckoutPage'
import CartPage from './pages/CartPage'
import PaymentSuccessPage from './pages/PaymentResultPage'
import PaymentFailedPage from './pages/PaymentFailedPage'
import OrderTrackingPage from './pages/customer/OrderTrackingPage'
import MyFeedbacksPage from './pages/customer/MyFeedbacksPage'
import ComplaintCenterPage from './pages/customer/ComplaintCenterPage'
import ComplaintHistoryPage from './pages/customer/ComplaintHistoryPage'
import RefundSupportPage from './pages/customer/RefundSupportPage'
import CartDrawer from './components/CartDrawer/CartDrawer'
import ChatBox from './components/ChatBox'

import AdminLayout from './pages/admin/AdminLayout'
import AdminWithdrawals from './pages/admin/AdminWithdrawals'
import AdminRefundTransactionsPage from './pages/admin/AdminRefundTransactionsPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import SystemConfig from './pages/admin/SystemConfig'
import UserManager from './pages/admin/UserManager'
import CustomerManager from './pages/admin/CustomerManager'
import CustomerDetailPage from './pages/admin/CustomerDetailPage'
import ArtisanManager from './pages/admin/ArtisanManager'
import ProductManager from './pages/admin/ProductManager'
import CategoryManager from './pages/admin/CategoryManager'
import ArtisanApplications from './pages/admin/ArtisanApplications'
import AdminComingSoon from './pages/admin/AdminComingSoon'
import CommissionManagement from './pages/admin/CommissionManagement'
import AdminComplaintManagementPage from './pages/admin/AdminComplaintManagementPage'
import AdminRecoveryManagementPage from './pages/admin/AdminRecoveryManagementPage'
import ShipmentDemoStatusPage from './pages/admin/ShipmentDemoStatusPage'
import AdminWallets from './pages/admin/AdminWallets'
import AdminTemplateReviewPage from './pages/admin/AdminTemplateReviewPage'

function ArtisanOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  const role = String(user?.role || '').toUpperCase()
  if (role !== 'ARTISAN') {
    return <Navigate to="/" replace />
  }

  return children
}

function AuthenticatedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  return (
    <>
      <AppToastContainer />
      <GlobalLoading />
      <CartDrawer />
      <ChatBox />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/products" element={<ShopPage />} />
        <Route path="/about" element={<AboutUsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/product/:id" element={<ProductDetailsPage />} />
        <Route path="/artisans" element={<ArtisanDirectoryPage />} />
        <Route path="/artisans/:id" element={<ArtisanProfilePage />} />
        <Route path="/artisan-centre" element={<ArtisanCentrePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/result" element={<PaymentSuccessPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/error" element={<PaymentFailedPage />} />
        <Route path="/payment/failed" element={<PaymentFailedPage />} />
        <Route path="/cart" element={<CartPage />} />

        <Route path="/artisan" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/profile" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/templates" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/portfolio" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/requests" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/wallet" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/messages" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/requests/:id" element={<ArtisanOnlyRoute><ArtisanCustomRequestDetailPage /></ArtisanOnlyRoute>} />
        <Route path="/artisan/requests/:id/custom-order" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/orders" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/template-orders" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/ready-orders" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/readyOrders" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/complaints" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/shipments" element={<ArtisanOnlyRoute><ArtisanDashboard /></ArtisanOnlyRoute>} />
        <Route path="/artisan/orders/:id" element={<ArtisanOnlyRoute><ArtisanCustomOrderDetailPage /></ArtisanOnlyRoute>} />
        <Route path="/artisan/custom-orders/:id" element={<ArtisanOnlyRoute><ArtisanCustomOrderDetailPage /></ArtisanOnlyRoute>} />
        <Route path="/order/:orderId" element={<ArtisanOnlyRoute><ArtisanOrderDetailPage /></ArtisanOnlyRoute>} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="settings" element={<SystemConfig />} />
          <Route path="commission" element={<CommissionManagement />} />
          <Route path="users" element={<UserManager />} />
          <Route path="customers" element={<CustomerManager />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="artisans" element={<ArtisanManager />} />
          <Route path="products" element={<ProductManager />} />
          <Route path="orders" element={<ShipmentDemoStatusPage />} />
          <Route path="payments" element={<AdminComingSoon title="Thanh toán" />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="complaints" element={<AdminComplaintManagementPage />} />
          <Route path="refund-transactions" element={<AdminRefundTransactionsPage />} />
          <Route path="recovery-management" element={<AdminRecoveryManagementPage />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="categories" element={<CategoryManager />} />
          <Route path="template-reviews" element={<AdminTemplateReviewPage />} />
          <Route path="artisan-applications" element={<ArtisanApplications />} />
        </Route>

        <Route path="/complaints" element={<ComplaintCenterPage />} />
        <Route path="/complaint-history" element={<ComplaintHistoryPage />} />
        <Route path="/refund-support" element={<RefundSupportPage />} />
        <Route path="/messages" element={<AuthenticatedRoute><ChatPage /></AuthenticatedRoute>} />
        <Route path="/custom-order" element={<CustomRequestPage />} />
        <Route path="/templates" element={<TemplateCatalogPage />} />
        <Route path="/template-order" element={<TemplateOrderPage />} />
        <Route path="/custom-requests" element={<CustomRequestsManagePage />} />
        <Route path="/manage-custom-request" element={<ManageCustomRequestPage />} />
        <Route path="/custom-requests/pending-confirmation" element={<PendingCustomOrdersPage />} />
        <Route path="/custom-requests/:id" element={<CustomRequestDetailPage />} />

        <Route element={<CustomerLayout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/payments" element={<PaymentPage />} />
          <Route path="/payments/:paymentId" element={<PaymentDetailPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/my-feedbacks" element={<MyFeedbacksPage />} />
          <Route path="/orders/:orderId" element={<OrderTrackingPage />} />
          <Route path="/orders/:orderId/tracking" element={<OrderTrackingPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
