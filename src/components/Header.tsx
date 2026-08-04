import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

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
        <div className="flex items-center gap-2 min-h-[36px]">
          {user && (
            <button
              onClick={onMenuToggle}
              className="mobile-nav header-action-btn z-10"
              style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }}
              title="Menu"
            >
              <Menu size={18} color="var(--foreground)" />
            </button>
          )}
          <Link to="/" className="mobile-nav flex items-center gap-2.5 rounded-lg px-1.5 py-1 no-underline transition-colors" title={t('header.routerSelection')}>
            <BrandLogo size={36} iconSize={20} showText textTitle="MIKMAN" subtitle={title} />
          </Link>
          <div className="desktop-nav">
            <h1 className="text-lg font-extrabold text-[var(--foreground)] m-0 tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="header-action-btn hide-on-mobile text-[11px] font-extrabold text-[var(--primary)] tracking-[0.3px]"
            title={t('header.languageSelector')}
          >
            {language === 'en' ? 'AR' : 'EN'}
          </button>
          <button
            onClick={toggleTheme}
            className="header-action-btn"
            style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
          </button>
          {user && (
            <Link
              to="/account"
              className="header-action-btn overflow-hidden"
              style={{ width: '36px', height: '36px', borderRadius: '10px', padding: 0, border: '1.5px solid var(--primary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
              title={user.email || 'Account'}
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8.5px' }} referrerPolicy="no-referrer" />
              ) : (
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                  {user.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}