import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MerchantAuthProvider } from "@/contexts/MerchantAuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MerchantProtectedRoute } from "@/components/auth/MerchantProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CustomerLogin from "./pages/CustomerLogin";
import CustomerSignup from "./pages/CustomerSignup";
import CustomerVerify from "./pages/CustomerVerify";
import ResetPassword from "./pages/ResetPassword";
import CustomerDashboard from "./pages/CustomerDashboard";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import CustomerKyc from "./pages/CustomerKyc";
import SecuritySettings from "./pages/SecuritySettings";
import NotificationSettings from "./pages/NotificationSettings";
import PrivacySettings from "./pages/PrivacySettings";
import SupportTicketDetail from "./pages/SupportTicketDetail";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import OrderTracking from "./pages/OrderTracking";
import ConfirmDelivery from "./pages/ConfirmDelivery";
import ReportIssue from "./pages/ReportIssue";
import Wallet from "./pages/Wallet";
import WalletTransactions from "./pages/WalletTransactions";
import BankAccount from "./pages/BankAccount";
import WalletWithdraw from "./pages/WalletWithdraw";
import NewPayment from "./pages/NewPayment";
import PaymentReview from "./pages/PaymentReview";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentStatus from "./pages/PaymentStatus";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import RaiseDispute from "./pages/RaiseDispute";
import UploadProof from "./pages/UploadProof";
import DisputeStatus from "./pages/DisputeStatus";
import DisputeResult from "./pages/DisputeResult";
import RefundInitiated from "./pages/RefundInitiated";
import RefundSuccess from "./pages/RefundSuccess";
import RefundFailed from "./pages/RefundFailed";
import Refunds from "./pages/Refunds";
import Notifications from "./pages/Notifications";
import Disputes from "./pages/Disputes";
import HelpSupport from "./pages/HelpSupport";
import ChangePassword from "./pages/ChangePassword";
import DeleteAccount from "./pages/DeleteAccount";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import About from "./pages/About";
import RefundPolicy from "./pages/RefundPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import GrievanceRedressal from "./pages/GrievanceRedressal";
import AmlKycPolicy from "./pages/AmlKycPolicy";
import Disclaimer from "./pages/Disclaimer";
import Contact from "./pages/Contact";
// Merchant pages
import MerchantLogin from "./pages/MerchantLogin";
import MerchantSignup from "./pages/MerchantSignup";
import MerchantVerify from "./pages/MerchantVerify";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantOrders from "./pages/MerchantOrders";
import MerchantOrderDetails from "./pages/MerchantOrderDetails";
import MerchantAddTracking from "./pages/MerchantAddTracking";
import MerchantEditTracking from "./pages/MerchantEditTracking";
import MerchantDeliveryProof from "./pages/MerchantDeliveryProof";
import MerchantDisputes from "./pages/MerchantDisputes";
import MerchantDisputeResponse from "./pages/MerchantDisputeResponse";
import MerchantDisputeUpload from "./pages/MerchantDisputeUpload";
import MerchantDisputeResult from "./pages/MerchantDisputeResult";
import MerchantPayouts from "./pages/MerchantPayouts";
import MerchantBankAccount from "./pages/MerchantBankAccount";
import MerchantWithdraw from "./pages/MerchantWithdraw";
import MerchantWithdrawSuccess from "./pages/MerchantWithdrawSuccess";
import MerchantPayoutHistory from "./pages/MerchantPayoutHistory";
import MerchantProfile from "./pages/MerchantProfile";
import MerchantProfileEdit from "./pages/MerchantProfileEdit";
import MerchantNotifications from "./pages/MerchantNotifications";
import MerchantSupport from "./pages/MerchantSupport";
import MerchantSupportTicket from "./pages/MerchantSupportTicket";
import MerchantRefunds from "./pages/MerchantRefunds";
import MerchantRefundDetail from "./pages/MerchantRefundDetail";
import MerchantSettings from "./pages/MerchantSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MerchantAuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
            <Route path="/customer-login" element={<CustomerLogin />} />
            <Route path="/customer-signup" element={<CustomerSignup />} />
            <Route path="/customer-verify" element={<CustomerVerify />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><CustomerDashboard /></ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute><Orders /></ProtectedRoute>
            } />
            <Route path="/orders/:id" element={
              <ProtectedRoute><OrderDetails /></ProtectedRoute>
            } />
            <Route path="/orders/:id/tracking" element={
              <ProtectedRoute><OrderTracking /></ProtectedRoute>
            } />
            <Route path="/orders/:id/confirm" element={
              <ProtectedRoute><ConfirmDelivery /></ProtectedRoute>
            } />
            <Route path="/orders/:id/report" element={
              <ProtectedRoute><ReportIssue /></ProtectedRoute>
            } />
            <Route path="/wallet" element={
              <ProtectedRoute><Wallet /></ProtectedRoute>
            } />
            <Route path="/wallet/transactions" element={
              <ProtectedRoute><WalletTransactions /></ProtectedRoute>
            } />
            <Route path="/wallet/bank-account" element={
              <ProtectedRoute><BankAccount /></ProtectedRoute>
            } />
            <Route path="/wallet/bank-account/:accountId" element={
              <ProtectedRoute><BankAccount /></ProtectedRoute>
            } />
            <Route path="/wallet/withdraw" element={
              <ProtectedRoute><WalletWithdraw /></ProtectedRoute>
            } />
            <Route path="/refunds" element={
              <ProtectedRoute><Refunds /></ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />
            <Route path="/profile/edit" element={
              <ProtectedRoute><ProfileEdit /></ProtectedRoute>
            } />
            <Route path="/profile/kyc" element={
              <ProtectedRoute><CustomerKyc /></ProtectedRoute>
            } />
            <Route path="/settings/security" element={
              <ProtectedRoute><SecuritySettings /></ProtectedRoute>
            } />
            <Route path="/settings/notifications" element={
              <ProtectedRoute><NotificationSettings /></ProtectedRoute>
            } />
            <Route path="/settings/privacy" element={
              <ProtectedRoute><PrivacySettings /></ProtectedRoute>
            } />
            <Route path="/payment/new" element={
              <ProtectedRoute><NewPayment /></ProtectedRoute>
            } />
            <Route path="/payment/review" element={
              <ProtectedRoute><PaymentReview /></ProtectedRoute>
            } />
            <Route path="/payment/success" element={
              <ProtectedRoute><PaymentSuccess /></ProtectedRoute>
            } />
            <Route path="/payment/status" element={
              <ProtectedRoute><PaymentStatus /></ProtectedRoute>
            } />
            <Route path="/transactions" element={
              <ProtectedRoute><Transactions /></ProtectedRoute>
            } />
            <Route path="/transactions/:transactionId" element={
              <ProtectedRoute><TransactionDetail /></ProtectedRoute>
            } />
            <Route path="/dispute/:orderId" element={
              <ProtectedRoute><RaiseDispute /></ProtectedRoute>
            } />
            <Route path="/disputes/:disputeId/upload" element={
              <ProtectedRoute><UploadProof /></ProtectedRoute>
            } />
            <Route path="/disputes" element={
              <ProtectedRoute><Disputes /></ProtectedRoute>
            } />
            <Route path="/disputes/:disputeId" element={
              <ProtectedRoute><DisputeStatus /></ProtectedRoute>
            } />
            <Route path="/disputes/:disputeId/result" element={
              <ProtectedRoute><DisputeResult /></ProtectedRoute>
            } />
            <Route path="/refunds/:refundId" element={
              <ProtectedRoute><RefundInitiated /></ProtectedRoute>
            } />
            <Route path="/refunds/:refundId/success" element={
              <ProtectedRoute><RefundSuccess /></ProtectedRoute>
            } />
            <Route path="/refunds/:refundId/failed" element={
              <ProtectedRoute><RefundFailed /></ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute><Notifications /></ProtectedRoute>
            } />
            <Route path="/help" element={
              <ProtectedRoute><HelpSupport /></ProtectedRoute>
            } />
            <Route path="/help/tickets/:ticketId" element={
              <ProtectedRoute><SupportTicketDetail /></ProtectedRoute>
            } />
            <Route path="/settings/change-password" element={
              <ProtectedRoute><ChangePassword /></ProtectedRoute>
            } />
            <Route path="/change-password" element={
              <ProtectedRoute><ChangePassword /></ProtectedRoute>
            } />
            <Route path="/delete-account" element={
              <ProtectedRoute><DeleteAccount /></ProtectedRoute>
            } />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/grievance-redressal" element={<GrievanceRedressal />} />
            <Route path="/aml-kyc-policy" element={<AmlKycPolicy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            {/* Merchant Auth Routes */}
            <Route path="/merchant-login" element={<MerchantLogin />} />
            <Route path="/merchant-signup" element={<MerchantSignup />} />
            <Route path="/merchant-verify" element={<MerchantVerify />} />
            <Route path="/merchant-dashboard" element={
              <MerchantProtectedRoute><MerchantDashboard /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-orders" element={
              <MerchantProtectedRoute><MerchantOrders /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-order/:orderId" element={
              <MerchantProtectedRoute><MerchantOrderDetails /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-add-tracking/:orderId" element={
              <MerchantProtectedRoute><MerchantAddTracking /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-edit-tracking/:orderId" element={
              <MerchantProtectedRoute><MerchantEditTracking /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-delivery-proof/:orderId" element={
              <MerchantProtectedRoute><MerchantDeliveryProof /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-disputes" element={
              <MerchantProtectedRoute><MerchantDisputes /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-dispute-response/:disputeId" element={
              <MerchantProtectedRoute><MerchantDisputeResponse /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-dispute-upload/:disputeId" element={
              <MerchantProtectedRoute><MerchantDisputeUpload /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-dispute-result/:disputeId" element={
              <MerchantProtectedRoute><MerchantDisputeResult /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-payouts" element={
              <MerchantProtectedRoute><MerchantPayouts /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-bank-account" element={
              <MerchantProtectedRoute><MerchantBankAccount /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-withdraw" element={
              <MerchantProtectedRoute><MerchantWithdraw /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-withdraw-success" element={
              <MerchantProtectedRoute><MerchantWithdrawSuccess /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-payout-history" element={
              <MerchantProtectedRoute><MerchantPayoutHistory /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-profile" element={
              <MerchantProtectedRoute><MerchantProfile /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-profile/edit" element={
              <MerchantProtectedRoute><MerchantProfileEdit /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-notifications" element={
              <MerchantProtectedRoute><MerchantNotifications /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-support" element={
              <MerchantProtectedRoute><MerchantSupport /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-support/:ticketId" element={
              <MerchantProtectedRoute><MerchantSupportTicket /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-refunds" element={
              <MerchantProtectedRoute><MerchantRefunds /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-refunds/:refundId" element={
              <MerchantProtectedRoute><MerchantRefundDetail /></MerchantProtectedRoute>
            } />
            <Route path="/merchant-settings" element={
              <MerchantProtectedRoute><MerchantSettings /></MerchantProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </MerchantAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
