import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Ticket, Sun, Moon, Menu } from 'lucide-react';
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
    if (pathname.endsWith('/vouchers')) return t('sidebar.vouchers');
    if (pathname.endsWith('/profiles')) return t('sidebar.profiles');
    if (pathname.endsWith('/batch')) return t('sidebar.batchPrint');
    if (pathname.endsWith('/users')) return t('sidebar.users');
    if (pathname.endsWith('/aps')) return t('sidebar.devices');
    if (pathname.endsWith('/records')) return t('sidebar.audit');
    if (pathname.endsWith('/revenue')) return t('sidebar.revenue');
    if (pathname.endsWith('/settings')) return t('sidebar.settings');
    return 'App';
  };

  const title = getTabTitle();

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="flex items-center gap-2 min-h-[36px]">
          {user && (
            <button onClick={onMenuToggle}
              className={`mobile-nav bg-none border-none cursor-pointer w-9 h-9 flex items-center justify-center text-[var(--foreground)] rounded-[10px] transition-colors box-border z-10 ${isMobileMenuOpen ? 'bg-[var(--secondary)]' : 'bg-transparent'}`}>
              <Menu size={20} />
            </button>
          )}
          <Link to="/" className="mobile-nav flex items-center gap-2.5 rounded-lg px-1.5 py-1 no-underline transition-colors hover:bg-[var(--secondary)]" title={t('header.routerSelection')}>
            <div className="w-9 h-9 rounded-[10px] bg-[var(--primary)] flex items-center justify-center shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)] flex-shrink-0">
              <Ticket size={18} color="#fff" className="-rotate-45" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-[15px] font-extrabold text-[var(--foreground)] m-0 tracking-tight leading-tight">MIKMAN</h1>
              <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-[0.5px]">{title}</span>
            </div>
          </Link>
          <div className="desktop-nav">
            <h1 className="text-lg font-extrabold text-[var(--foreground)] m-0 tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="header-action-btn hide-on-mobile text-[11px] font-extrabold text-[var(--primary)] tracking-[0.3px]" title={t('header.languageSelector')}>
            {language === 'en' ? 'AR' : 'EN'}
          </button>
          <button onClick={toggleTheme} className="header-action-btn" title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
            {theme === 'dark' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
          </button>
          {user && (
            <Link to="/account"
              className="header-action-btn overflow-hidden p-0 border-[1.5px] border-[var(--primary)] hover:border-[var(--primary-hover)]" title={user.email || 'Account'}>
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[13px] font-extrabold text-[var(--primary)]">
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