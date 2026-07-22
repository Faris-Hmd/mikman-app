import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';
import { useLanguage } from './context/LanguageContext';

import LoadingScreen from './components/LoadingScreen';
import SignIn from './components/SignIn';
import PlansPage from './pages/Plans';
import AppShell from './components/AppShell';
import AuthCallback from './pages/AuthCallback';
import LandingPage from './pages/Landing';
import AccountPage from './pages/Account';
import RegisterRouterPage from './pages/RegisterRouter';
import RouterDashboardPage from './pages/router/Dashboard';
import VouchersPage from './pages/router/Vouchers';
import ProfilesPage from './pages/router/Profiles';
import BatchPage from './pages/router/Batch';
import BatchDetailPage from './pages/router/BatchDetail';
import UsersPage from './pages/router/Users';
import ApsPage from './pages/router/Aps';
import RecordsPage from './pages/router/Records';
import RevenuePage from './pages/router/Revenue';
import SettingsPage from './pages/router/Settings';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/register-router" element={<RegisterRouterPage />} />
        
        {/* Router-scoped routes */}
        <Route path="/:routerId" element={<RouterDashboardPage />} />
        <Route path="/:routerId/vouchers" element={<VouchersPage />} />
        <Route path="/:routerId/profiles" element={<ProfilesPage />} />
        <Route path="/:routerId/batch" element={<BatchPage />} />
        <Route path="/:routerId/batch/detail" element={<BatchDetailPage />} />
        <Route path="/:routerId/users" element={<UsersPage />} />
        <Route path="/:routerId/aps" element={<ApsPage />} />
        <Route path="/:routerId/records" element={<RecordsPage />} />
        <Route path="/:routerId/revenue" element={<RevenuePage />} />
        <Route path="/:routerId/settings" element={<SettingsPage />} />
      </Route>
      
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { user, accountInfo, isAuthLoading, isSubLoading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const isAuthCallback = location.pathname === '/auth/callback';

  // Loading state — skip if we're on the auth callback (Supabase is processing the hash)
  if (isAuthLoading) {
    return (
      <LoadingScreen
        loadingTitle={t('common.verifyingSession')}
        loadingSubtitle={t('common.checkingAuthState')}
      />
    );
  }

  // Not logged in
  if (!user) {
    return <SignIn />;
  }

  // Auth callback page — always render, even if accountInfo is still loading.
  // The callback component itself waits for accountInfo before redirecting.
  if (isAuthCallback) {
    return <AuthCallback />;
  }

  // Still loading account info (but not on callback)
  if (isSubLoading && !accountInfo) {
    return (
      <LoadingScreen
        loadingTitle={t('common.verifyingPermissions')}
        loadingSubtitle={t('common.checkingApproval')}
      />
    );
  }

  // Block unapproved/expired/no-plan users — redirect to plans page
  if (!accountInfo || accountInfo.subscriptionState !== 'active') {
    return <PlansPage />;
  }

  // Authenticated + subscribed — render app
  return (
    <ModalProvider>
      <AppRoutes />
    </ModalProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
