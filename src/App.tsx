import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';

import LoadingScreen from './components/LoadingScreen';
import SignIn from './components/SignIn';
import PlansPage from './pages/Plans';
import AppShell from './components/AppShell';

import LandingPage from './pages/Landing';
import AccountPage from './pages/Account';
import RegisterRouterPage from './pages/RegisterRouter';
import AuthCallback from './pages/AuthCallback';
import RouterDashboardPage from './pages/router/Dashboard';
import VouchersPage from './pages/router/Vouchers';
import ProfilesPage from './pages/router/Profiles';
import BatchPage from './pages/router/Batch';
import UsersPage from './pages/router/Users';
import ApsPage from './pages/router/Aps';
import RecordsPage from './pages/router/Records';
import RevenuePage from './pages/router/Revenue';
import SettingsPage from './pages/router/Settings';

function AppContent() {
  const { user, accountInfo, isAuthLoading, isSubLoading } = useAuth();

  // Loading state
  if (isAuthLoading || (user && isSubLoading && !accountInfo)) {
    return (
      <LoadingScreen
        loadingTitle={isAuthLoading ? 'Verifying session' : 'Verifying permissions'}
        loadingSubtitle={isAuthLoading ? 'Checking authentication state...' : 'Checking admin approval status...'}
      />
    );
  }

  // Not logged in
  if (!user) {
    return <SignIn />;
  }

  // Block unapproved/expired/no-plan users — redirect to plans page
  if (!accountInfo || accountInfo.subscriptionState !== 'active') {
    return <PlansPage />;
  }

  // Authenticated + subscribed — render app
  return (
    <ModalProvider>
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