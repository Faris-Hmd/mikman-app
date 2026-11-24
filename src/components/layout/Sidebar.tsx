import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { Ticket, Layers, Users, Laptop, Settings, ChevronLeft, ChevronRight, LogOut, LayoutDashboard, TrendingUp, User, Home, Sun, Moon } from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import WireguardIcon from '../ui/WireguardIcon';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { fetchRouterProfilesWithUserAPI } from '../../api';
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

  const { data: routerProfilesResponse } = useSWR(
    'router-profiles-with-user',
    fetchRouterProfilesWithUserAPI,
    { dedupingInterval: 30000, revalidateOnFocus: false }
  );

  const userPhoto = user?.user_metadata?.avatar_url || user?.photoURL || '';
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.displayName || user?.email?.split('@')[0] || 'Network Admin';
  const userEmail = user?.email || '';

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

  const activeRouterId =
    routerId ||
    routerProfilesResponse?.profiles?.[0]?.id ||
    (routerProfilesResponse as any)?.routers?.[0]?.id;

  const targetVpnHref = activeRouterId
    ? `/${activeRouterId}/settings#wireguard`
    : '/register-router';

  const isVpnActive = pathname.includes('/settings') && location.hash === '#wireguard';

  const globalItems = [
    { label: t('sidebar.mainPage'), icon: Home, href: '/', isActive: pathname === '/' },
    { label: t('sidebar.accountDetails'), icon: User, href: '/account', isActive: pathname === '/account' },
    {
      label: t('sidebar.vpnAccess') || 'WireGuard VPN',
      icon: WireguardIcon,
      href: targetVpnHref,
      isActive: isVpnActive,
      isVpn: true,
    },
  ];

  const routerItems = routerId ? [
    { href: `/${routerId}`, label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { href: `/${routerId}/revenue`, label: t('sidebar.revenue'), icon: TrendingUp },
    { href: `/${routerId}/vouchers`, label: t('sidebar.vouchers'), icon: Ticket },
    { href: `/${routerId}/profiles`, label: t('sidebar.profiles'), icon: Layers },
    { href: `/${routerId}/users`, label: t('sidebar.users'), icon: Users },
    { href: `/${routerId}/aps`, label: t('sidebar.devices'), icon: Laptop },
    { href: `/${routerId}/settings`, label: t('sidebar.settings'), icon: Settings, isSettings: true },
  ] : [];

  const SidebarContainer = isMobile ? 'div' : 'aside';

  return (
    <>
      <SidebarContainer
        className={`shell-sidebar-nav ${isMobile ? 'mobile' : `desktop ${collapsed ? 'collapsed' : 'expanded'}`}`}
      >
        {/* Top Header, Account & Navigation Links */}
        <div className="sidebar-scrollable-content">
          {/* Logo Header */}
          <Link
            to="/"
            onClick={() => { if (isMobile && onClose) onClose(); }}
            title={t('header.routerSelection')}
            className="shell-nav-logo-link flex items-center h-14 mb-1 cursor-pointer no-underline"
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
            <div className="sidebar-account-box">
              <Link
                to="/account"
                onClick={() => { if (onClose) onClose(); }}
                className="sidebar-account-card"
                title={t('sidebar.accountDetails') || 'Account Details'}
              >
                <div className="sidebar-account-avatar">
                  {userPhoto ? (
                    <img
                      src={userPhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="sidebar-account-avatar-fallback">
                      {userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                <div className="sidebar-account-info">
                  <span className="sidebar-account-name">
                    {userDisplayName}
                  </span>
                  {userEmail && (
                    <span className="sidebar-account-email">
                      {userEmail}
                    </span>
                  )}
                </div>
                <ChevronRight size={16} className="sidebar-account-chevron" />
              </Link>
            </div>
          )}

          {/* Global Navigation Section */}
          <div className="flex flex-col gap-1">
            {globalItems.map(item => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => {
                  if (item.isVpn && pathname.includes('/settings')) {
                    const el = document.getElementById('wireguard');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                  if (isMobile && onClose) onClose();
                }}
                className={`shell-nav-link ${item.isActive ? 'active' : ''}`}
                title={item.label}
              >
                <item.icon
                  size={17}
                  color={item.isVpn ? (item.isActive ? 'var(--primary)' : 'var(--danger)') : undefined}
                  className="flex-shrink-0"
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>

          {/* Router Sub-routes Navigation Section */}
          {routerItems.length > 0 && (
            <>
              <div className="sidebar-section-divider" />
              <div className="flex flex-col gap-1">
                {!collapsed && (
                  <div className="px-2.5 py-1 text-[10px] font-bold text-muted uppercase">
                    {t('sidebar.routerSection') || 'Router Tools'}
                  </div>
                )}
                {routerItems.map(item => {
                  const isActive = (item as any).isSettings
                    ? pathname === item.href && location.hash !== '#wireguard'
                    : pathname === item.href;
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
            </>
          )}
        </div>

        {/* Footer Toggles (Theme & Language on mobile only; Logout always) */}
        <div className="sidebar-footer-section">
          <div className={`sidebar-actions-group ${!isMobile && collapsed ? 'flex-col' : ''}`}>
            {isMobile && (
              <>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="sidebar-action-btn theme"
                  title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="sidebar-action-btn lang"
                  title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
                >
                  <span className="font-bold text-[12px] leading-none">{language === 'en' ? 'AR' : 'EN'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleSignOutRequest}
              className="sidebar-action-btn logout"
              title={t('sidebar.signOutShort') || 'Sign Out'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </SidebarContainer>

      {showLogoutConfirm && <LogoutConfirmModal onClose={() => setShowLogoutConfirm(false)} />}
    </>
  );
}
