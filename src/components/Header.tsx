import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Zap, Sun, Moon, Menu } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

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
              className={`mobile-nav header-action-btn z-10 ${isMobileMenuOpen ? 'bg-white/15' : 'bg-transparent border-white/20'}`}
              title="Menu"
            >
              <Menu size={18} color="var(--foreground)" />
            </button>
          )}
          <Link to="/" className="mobile-nav flex items-center gap-2.5 rounded-lg px-1.5 py-1 no-underline transition-colors" title={t('header.routerSelection')}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: '#3B82F6', boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }}>
              <Zap size={20} color="#fff" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-[15px] font-extrabold m-0 tracking-tight leading-tight" style={{ color: 'var(--foreground)' }}>MIKMAN</h1>
              <span className="text-[10px] font-semibold uppercase tracking-[0.5px]" style={{ color: 'var(--text-muted)' }}>{title}</span>
            </div>
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
          <button onClick={toggleTheme} className="header-action-btn" title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
            {theme === 'dark' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
          </button>
          {user && (
            <Link
              to="/account"
              className="header-action-btn overflow-hidden p-0 border-[1.5px] border-[var(--primary)] hover:border-[var(--primary-hover)]"
              title={user.email || 'Account'}
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[13px] font-extrabold text-[var(--primary)] flex items-center justify-center w-full h-full">
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