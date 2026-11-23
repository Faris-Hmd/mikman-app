import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Ticket, Layers, Users, Laptop, Settings, ChevronLeft, ChevronRight, LogOut, LayoutDashboard, TrendingUp, User, Home, Sun, Moon } from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import LogoutConfirmModal from '../auth/LogoutConfirmModal';
import './shell.css';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const isMobile = !!onClose;
  const location = useLocation();
  const pathname = location.pathname;
  const params = useParams();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const routerId = params?.routerId as string | undefined;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const userPhoto = user?.user_metadata?.avatar_url || user?.photoURL || '';
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.displayName || user?.email?.split('@')[0] || 'Network Admin';

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('@sidebar_collapsed');
    setIsCollapsed(stored === 'true');

    const storedTheme = localStorage.getItem('@theme') as 'dark' | 'light';
    if (storedTheme) {
      setTheme(storedTheme);
      if (storedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('@sidebar_collapsed', String(nextState));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('@theme', newTheme);
    if (newTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const handleSignOutRequest = () => {
    setShowLogoutConfirm(true);
  };

  if (!mounted && !isMobile) {
    return <aside className="shell-sidebar-nav desktop w-[68px]" />;
  }

  const collapsed = isMobile ? false : isCollapsed;

  const globalItems = [
    { label: t('sidebar.mainPage'), icon: Home, href: '/', isActive: pathname === '/' },
    { label: t('sidebar.accountDetails'), icon: User, href: '/account', isActive: pathname === '/account' }
  ];

  const routerItems = routerId ? [
    { href: `/${routerId}`, label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { href: `/${routerId}/revenue`, label: t('sidebar.revenue'), icon: TrendingUp },
    { href: `/${routerId}/vouchers`, label: t('sidebar.vouchers'), icon: Ticket },
    { href: `/${routerId}/profiles`, label: t('sidebar.profiles'), icon: Layers },
    { href: `/${routerId}/users`, label: t('sidebar.users'), icon: Users },
    { href: `/${routerId}/aps`, label: t('sidebar.devices'), icon: Laptop },
    { href: `/${routerId}/settings`, label: t('sidebar.settings'), icon: Settings },
  ] : [];

  const SidebarContainer = isMobile ? 'div' : 'aside';

  return (
    <>
      <SidebarContainer
        className={`shell-sidebar-nav ${isMobile ? 'mobile' : `desktop ${collapsed ? 'collapsed' : 'expanded'}`}`}
      >
        {/* Top Header & Account Section */}
        <div className="flex flex-col gap-1.5 w-full flex-shrink-0">
          {/* Logo Header */}
          <Link
            to="/"
            onClick={() => { if (isMobile && onClose) onClose(); }}
            title={t('header.routerSelection')}
            className="shell-nav-logo-link flex items-center h-14 border-b border-glass mb-1 cursor-pointer no-underline"
          >
            <BrandLogo size={36} iconSize={20} showText={!collapsed} textTitle={t('sidebar.menuTitle') || 'MIKMAN Menu'} />
          </Link>

          {/* Collapse Menu Button (Desktop) */}
          {!isMobile && (
            <button
              onClick={toggleCollapse}
              title={collapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
              className="shell-nav-collapse-btn flex items-center gap-2.5 p-2 rounded-lg bg-transparent text-muted border-none cursor-pointer text-xs font-medium w-full hover:text-foreground"
            >
              <div className="w-5 flex items-center justify-center flex-shrink-0">
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </div>
              {!collapsed && <span>{t('sidebar.collapseMenu')}</span>}
            </button>
          )}

          {/* Account Info on Mobile */}
          {isMobile && user && (
            <div className="flex items-center justify-between pb-2 border-b border-glass mb-2">
              <Link
                to="/account"
                onClick={() => { if (onClose) onClose(); }}
                className="flex items-center gap-2 min-w-0 flex-1 no-underline"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-card flex items-center justify-center flex-shrink-0">
                  {userPhoto ? (
                    <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                      {userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                  {userDisplayName}
                </div>
              </Link>

              <div className="flex items-center gap-1.5">
                <button onClick={toggleTheme} className="p-1.5 rounded-md bg-white/5 border-none text-primary cursor-pointer">
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button onClick={toggleLanguage} className="px-2 py-1 rounded-md bg-white/5 border-none text-primary text-[10px] font-bold cursor-pointer">
                  {language === 'en' ? 'AR' : 'EN'}
                </button>
                <button onClick={handleSignOutRequest} className="p-1.5 rounded-md bg-transparent border-none text-red-500 cursor-pointer">
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Global Navigation Section */}
          <div className="flex flex-col gap-1">
            {globalItems.map(item => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => { if (isMobile && onClose) onClose(); }}
                className={`shell-nav-link ${item.isActive ? 'active' : ''}`}
                title={item.label}
              >
                <item.icon size={17} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>

          {/* Router Sub-routes Navigation Section */}
          {routerItems.length > 0 && (
            <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-glass">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[10px] font-bold text-muted uppercase">
                  {t('sidebar.routerSection') || 'Router Tools'}
                </div>
              )}
              {routerItems.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => { if (isMobile && onClose) onClose(); }}
                    className={`shell-nav-link ${isActive ? 'active' : ''}`}
                    title={item.label}
                  >
                    <item.icon size={17} className="flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Footer Toggles */}
        {!isMobile && (
          <div className="flex flex-col gap-2 pt-2 border-t border-glass">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md bg-white/5 border-none text-primary cursor-pointer hover:bg-white/10"
                title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {!collapsed && (
                <button
                  onClick={toggleLanguage}
                  className="px-2 py-1 rounded-md bg-white/5 border-none text-primary text-[11px] font-bold cursor-pointer hover:bg-white/10"
                >
                  {language === 'en' ? 'العربية' : 'English'}
                </button>
              )}

              <button
                onClick={handleSignOutRequest}
                className="p-1.5 rounded-md bg-transparent border-none text-red-500 cursor-pointer hover:bg-red-500/10"
                title={t('sidebar.signOutShort') || 'Sign Out'}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        )}
      </SidebarContainer>

      {showLogoutConfirm && <LogoutConfirmModal onClose={() => setShowLogoutConfirm(false)} />}
    </>
  );
}
