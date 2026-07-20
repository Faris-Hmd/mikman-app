import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';

import LoadingScreen from './components/LoadingScreen';
import SignIn from './components/SignIn';
import PlansPage from './pages/Plans';
import AppShell from './components/AppShell';

// Eager — needed on first load
import AuthCallback from './pages/AuthCallback';

// Lazy-loaded pages
const LandingPage = lazy(() => import('./pages/Landing'));
const AccountPage = lazy(() => import('./pages/Account'));
const RegisterRouterPage = lazy(() => import('./pages/RegisterRouter'));
const RouterDashboardPage = lazy(() => import('./pages/router/Dashboard'));
const VouchersPage = lazy(() => import('./pages/router/Vouchers'));
const ProfilesPage = lazy(() => import('./pages/router/Profiles'));
const BatchPage = lazy(() => import('./pages/router/Batch'));
const UsersPage = lazy(() => import('./pages/router/Users'));
const ApsPage = lazy(() => import('./pages/router/Aps'));
const RecordsPage = lazy(() => import('./pages/router/Records'));
const RevenuePage = lazy(() => import('./pages/router/Revenue'));
const SettingsPage = lazy(() => import('./pages/router/Settings'));

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid var(--glass-border)', borderTopColor: 'var(--primary)', animation: 'spin 0.6s linear infinite' }} />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}

function AppContent() {
  const { user, accountInfo, isAuthLoading, isSubLoading } = useAuth();
  const location = useLocation();
  const isAuthCallback = location.pathname === '/auth/callback';

  // Loading state — skip if we're on the auth callback (Supabase is processing the hash)
  if (isAuthLoading) {
    return (
      <LoadingScreen
        loadingTitle="Verifying session"
        loadingSubtitle="Checking authentication state..."
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
        loadingTitle="Verifying permissions"
        loadingSubtitle="Checking admin approval status..."
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
