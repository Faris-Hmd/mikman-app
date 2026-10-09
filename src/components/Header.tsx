import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useVpnModal } from '../context/VpnModalContext';
import BrandLogo from './BrandLogo';
import WireguardIcon from './WireguardIcon';

interface HeaderProps {
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

export default function Header({ onMenuToggle, isMobileMenuOpen }: HeaderProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const { openVpnModal } = useVpnModal();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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

  const getTabTitle = () => {
    if (pathname === '/' || pathname === `/${pathname.split('/')[1]}`) return t('common.home');
    if (pathname.endsWith('/account')) return t('sidebar.accountDetails');
    if (pathname.includes('/vouchers')) return t('sidebar.vouchers');
    if (pathname.includes('/profiles')) return t('sidebar.profiles');
    if (pathname.includes('/batch')) return t('sidebar.batchPrint');
    if (pathname.includes('/users')) return t('sidebar.users');
    if (pathname.includes('/aps')) return t('sidebar.devices');
    if (pathname.includes('/records')) return t('sidebar.audit');
    if (pathname.includes('/revenue')) return t('sidebar.revenue');
    if (pathname.includes('/settings')) return t('sidebar.settings');
    return 'App';
  };

  const title = getTabTitle();

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="flex items-center gap-1 min-h-[36px]">
          {user && (
            <button
              onClick={onMenuToggle}
              className="mobile-nav header-action-btn z-10"
              style={{ padding: '6px', border: 'none', outline: 'none' }}
              title="Menu"
            >
              <Menu size={20} color="var(--foreground)" />
            </button>
          )}
          <Link to="/" className="mobile-nav flex items-center gap-2 rounded-lg px-1 py-1 no-underline transition-colors border-none" title={t('header.routerSelection')}>
            <BrandLogo size={32} iconSize={18} showText textTitle="MIKMAN" subtitle={title} />
          </Link>
          <div className="desktop-nav">
            <h1 className="text-lg font-extrabold text-[var(--foreground)] m-0 tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {user && (
            <button
              onClick={() => openVpnModal()}
              className="header-action-btn flex items-center justify-center"
              style={{ padding: '6px', border: 'none', outline: 'none' }}
              title={t('vpnModal.title') || 'WireGuard VPN Access'}
            >
              <WireguardIcon size={20} color="#ef4444" />
            </button>
          )}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="desktop-nav header-action-btn flex items-center justify-center"
            style={{ padding: '6px', border: 'none', outline: 'none' }}
            title={language === 'en' ? 'تغيير اللغة إلى العربية (Switch to Arabic)' : 'Switch Language to English'}
          >
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px' }}>
              {language === 'en' ? 'عربي' : 'EN'}
            </span>
          </button>
          <button
            onClick={toggleTheme}
            className="header-action-btn"
            style={{ padding: '6px', border: 'none', outline: 'none' }}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={19} color="var(--primary)" /> : <Moon size={19} color="var(--primary)" />}
          </button>
          {user && (
            <Link
              to="/account"
              className="header-action-btn"
              style={{ padding: '4px', border: 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={user.email || 'Account'}
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '50%' }} referrerPolicy="no-referrer" />
              ) : (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'rgba(var(--primary-rgb), 0.15)', color: 'var(--primary)', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {user.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                </div>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}