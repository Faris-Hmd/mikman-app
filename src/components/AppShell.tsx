import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { setServerUrl, setSupabaseIdToken } from '../api';
import { RouterConfig } from '../store';
import Header from './Header';
import Sidebar from './Sidebar';
import { ModalProvider } from '../context/ModalContext';
import { supabase } from '../lib/supabase';
import LogoutConfirmModal from './LogoutConfirmModal';
import LoadingScreen from './LoadingScreen';
import { useLanguage } from '../context/LanguageContext';

export default function AppShell() {
  const { t } = useLanguage();
  const params = useParams();
  const navigate = useNavigate();
  const routerId = params?.routerId as string | undefined;

  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savedRouters, setSavedRouters] = useState<RouterConfig[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('@cached_routers_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedRouters(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to restore cached routers:', err);
    }
  }, []);

  const activeRouter = routerId ? ({ id: routerId, name: routerId } as RouterConfig) : null;
  const isRouterConnected = Boolean(routerId);
  const isConnected = isRouterConnected;

  useEffect(() => {
    const storedTheme = localStorage.getItem('@theme') as 'dark' | 'light';
    if (storedTheme) {
      setTheme(storedTheme);
      if (storedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('@theme', newTheme);
    if (newTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setSupabaseIdToken(session.access_token);
        setUser(session.user);
      } else {
        setSupabaseIdToken(null);
        setUser(null);
        localStorage.removeItem('@cached_routers_list');
      }
      setIsAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let storedUrl = localStorage.getItem('@server_url') || '';
    if (!storedUrl || storedUrl === 'https://2a02-4780-7-43e7--1.sslip.io') storedUrl = '';
    setServerUrl(storedUrl);
  }, [user]);

  const connectRouter = async (router: RouterConfig): Promise<boolean> => {
    const targetRouterId = router.id || '';
    navigate(`/${targetRouterId}`);
    return true;
  };

  const disconnectRouter = async () => {
    localStorage.removeItem('selectedRouterId');
    localStorage.removeItem('@router_config');
    navigate('/');
  };

  if (isAuthLoading) {
    return <LoadingScreen loadingTitle={t('common.verifyingSession')} loadingSubtitle={t('common.checkingAuthState')} />;
  }

  return (
    <ModalProvider>
      <div className="layout-container" style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--background)', overflow: 'hidden' }}>
        {user && (
          <Sidebar
            activeRouter={activeRouter}
            savedRouters={savedRouters}
            isConnected={isConnected}
            onConnectRouter={connectRouter}
            theme={theme}
            toggleTheme={toggleTheme}
            isRouterConnected={isRouterConnected}
            onDisconnect={disconnectRouter}
            user={user}
            onSignOutRequest={() => setShowLogoutConfirm(true)}
            onProfileClick={() => navigate('/account')}
          />
        )}
        <div className="layout-content-wrapper" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Header
            activeRouter={activeRouter}
            isConnected={isRouterConnected ? isConnected : false}
            resources={null}
            health={null}
            onDisconnect={disconnectRouter}
            user={user}
            onProfileClick={() => navigate('/account')}
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
            theme={theme}
            toggleTheme={toggleTheme}
          />
          <main className="layout-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="layout-page-inner" style={{ width: '100%', maxWidth: '1200px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="layout-page-content" style={{ width: '100%', maxWidth: '1200px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
              </div>
            </div>
          </main>
        </div>

        {isMobileMenuOpen && (
          <div className="mobile-nav modal-overlay"
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-start', alignItems: 'stretch' }}
            onClick={() => setIsMobileMenuOpen(false)}>
            <div style={{ width: '280px', height: '100%', backgroundColor: 'var(--card-bg)', borderRight: '1px solid var(--glass-border)', padding: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 0 20px rgba(0, 0, 0, 0.3)' }}
              onClick={(e) => e.stopPropagation()}>
              <Sidebar
                activeRouter={activeRouter} savedRouters={savedRouters} isConnected={isConnected}
                onConnectRouter={connectRouter} theme={theme} toggleTheme={toggleTheme}
                isRouterConnected={isRouterConnected} onDisconnect={disconnectRouter} user={user}
                isMobile={true} onClose={() => setIsMobileMenuOpen(false)}
                onSignOutRequest={() => { setIsMobileMenuOpen(false); setShowLogoutConfirm(true); }}
                onProfileClick={() => navigate('/account')}
              />
            </div>
          </div>
        )}

        {showLogoutConfirm && (
          <LogoutConfirmModal
            onClose={() => setShowLogoutConfirm(false)}
            t={t}
            onConfirm={async () => {
              setShowLogoutConfirm(false);
              setIsLoggingOut(true);
              try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
              finally { setIsLoggingOut(false); }
            }}
          />
        )}

        {isLoggingOut && (
          <div className="modal-overlay" style={{ zIndex: 2000, pointerEvents: 'all' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px', borderRadius: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(16px)', boxShadow: 'var(--shadow-lg)' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--secondary)', borderTop: '3px solid var(--primary)', borderRadius: '50%' }} />
              <div style={{ color: 'var(--foreground)', fontWeight: '700', fontSize: '15px' }}>{t('common.signingOut')}</div>
            </div>
          </div>
        )}
      </div>
    </ModalProvider>
  );
}
