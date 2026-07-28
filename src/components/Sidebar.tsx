import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Zap, Ticket, Server, Layers, Users, Laptop, Settings, ChevronLeft, ChevronRight, LogOut, LayoutDashboard, TrendingUp, User, Home, Printer, Sun, Moon, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import LogoutConfirmModal from './LogoutConfirmModal';

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
  const isRouterConnected = Boolean(routerId);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
    return <aside className="desktop-nav" style={{ width: '68px', height: '100%', borderRight: '1px solid var(--glass-border)', backgroundColor: 'var(--card-bg)' }} />;
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
    { href: `/${routerId}/batch`, label: t('sidebar.batchPrint'), icon: Printer },
    { href: `/${routerId}/users`, label: t('sidebar.users'), icon: Users },
    { href: `/${routerId}/aps`, label: t('sidebar.devices'), icon: Laptop },
    { href: `/${routerId}/records`, label: t('sidebar.audit'), icon: Server },
    { href: `/${routerId}/settings`, label: t('sidebar.settings'), icon: Settings },
  ] : [];

  const SidebarContainer = isMobile ? 'div' : 'aside';

  return (
    <>
      <SidebarContainer className={isMobile ? '' : 'desktop-nav'}
        style={{
          width: isMobile ? '100%' : (collapsed ? '68px' : '230px'),
          transition: isMobile ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100%',
          backgroundColor: isMobile ? 'transparent' : 'var(--card-bg)',
          borderRight: isMobile ? 'none' : '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          overflowX: 'hidden',
          boxSizing: 'border-box',
          padding: isMobile ? '0 16px 12px' : '0 10px 10px',
          zIndex: 90
        }}>
        
        {/* Top Header & Account/Toggles Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', flexShrink: 0 }}>
          {/* Logo Header */}
          <Link to="/" onClick={() => { if (isMobile && onClose) onClose(); }} title={t('header.routerSelection')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', boxSizing: 'border-box', height: isMobile ? '52px' : '56px', marginTop: '0', marginLeft: isMobile ? '-16px' : '-10px', marginRight: isMobile ? '-16px' : '-10px', paddingLeft: isMobile ? '16px' : '12px', paddingRight: isMobile ? '16px' : '12px', borderBottom: '1px solid var(--glass-border)', marginBottom: '4px', width: isMobile ? 'calc(100% + 32px)' : 'calc(100% + 20px)', cursor: 'pointer', transition: 'background-color 0.2s', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }}>
                <Zap size={20} color="#fff" />
              </div>
              {!collapsed && <h1 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>{t('sidebar.menuTitle') || 'MIKMAN Menu'}</h1>}
            </div>
          </Link>

          {/* Collapse Menu Button (Desktop) */}
          {!isMobile && (
            <button onClick={toggleCollapse} title={collapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', padding: '5px 8px', borderRadius: '8px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', transition: 'all 0.2s ease', fontSize: '12px', fontWeight: '500', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}>
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </div>
              {!collapsed && <span>{t('sidebar.collapseMenu')}</span>}
            </button>
          )}

          {/* Account Info & Toggles Section at TOP (Mobile only, on desktop it's in the Header) */}
          {isMobile && user && (
            collapsed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', width: '100%', padding: '6px 0', borderBottom: '1px solid var(--glass-border)', marginBottom: '4px' }}>
                {/* Avatar / Account Link */}
                <Link to="/account" onClick={() => { if (isMobile && onClose) onClose(); }} title={t('sidebar.accountDetails')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'pointer', boxSizing: 'border-box', transition: 'transform 0.2s', textDecoration: 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--primary)', backgroundColor: 'var(--card-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {userPhoto ? <img src={userPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>{userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U'}</div>}
                  </div>
                </Link>

                {/* Theme Toggle */}
                <button onClick={toggleTheme} title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '5px', color: 'var(--primary)', cursor: 'pointer', width: '28px', height: '28px' }}>
                  {theme === 'dark' ? <Sun size={14} color="var(--primary)" /> : <Moon size={14} color="var(--primary)" />}
                </button>

                {/* Language Toggle */}
                <button onClick={toggleLanguage} title={t('header.languageSelector')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '3px', color: 'var(--primary)', fontSize: '10px', fontWeight: '800', cursor: 'pointer', width: '28px', height: '28px' }}>
                  {language === 'en' ? 'AR' : 'EN'}
                </button>

                {/* Sign Out Button */}
                <button onClick={handleSignOutRequest} title={t('sidebar.signOutShort') || 'Sign Out'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: '6px', padding: '5px', color: '#ef4444', cursor: 'pointer', width: '28px', height: '28px' }}>
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '4px 2px 8px',
                borderBottom: '1px solid var(--glass-border)',
                marginBottom: '6px',
                boxSizing: 'border-box',
                width: '100%'
              }}>
                {/* User Details Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Link to="/account" onClick={() => { if (isMobile && onClose) onClose(); }} title={t('sidebar.accountDetails')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--primary)', backgroundColor: 'var(--card-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {userPhoto ? <img src={userPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      : <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>{userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U'}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userDisplayName}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</span>
                    </div>
                  </Link>

                  <button onClick={handleSignOutRequest} title={t('sidebar.signOutShort') || 'Sign Out'}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '5px', color: '#ef4444', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease' }}>
                    <LogOut size={14} />
                  </button>
                </div>

                {/* Toggles Row: Theme & Language */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', paddingTop: '6px', borderTop: '1px solid var(--glass-border)' }}>
                  {/* Theme Toggle Button */}
                  <button onClick={toggleTheme} title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--glass-border)', color: 'var(--foreground)', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    {theme === 'dark' ? <Sun size={15} color="var(--primary)" /> : <Moon size={15} color="var(--primary)" />}
                  </button>

                  {/* Language Toggle Button */}
                  <button onClick={toggleLanguage} title={t('header.languageSelector')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--glass-border)', color: 'var(--primary)', fontSize: '11px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    <Globe size={14} />
                    <span>{language === 'en' ? 'AR' : 'EN'}</span>
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Scrollable Navigation Menu */}
        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', boxSizing: 'border-box', paddingRight: collapsed ? '0' : '2px', marginTop: '4px' }}>
          {!collapsed && <div style={{ padding: '4px 10px 2px', fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sidebar.mainMenu')}</div>}
          {globalItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link key={idx} to={item.href} title={collapsed ? item.label : undefined}
                onClick={() => { onClose?.(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', padding: '6px 10px', borderRadius: '8px', color: item.isActive ? '#fff' : 'var(--text-muted)', backgroundColor: item.isActive ? 'var(--primary)' : 'transparent', textDecoration: 'none', transition: 'all 0.2s ease', fontWeight: item.isActive ? '700' : '500', fontSize: '13px', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}><Icon size={18} color={item.isActive ? '#fff' : 'var(--foreground)'} /></div>
                <span style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', transition: 'opacity 0.2s ease, width 0.2s ease', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</span>
              </Link>
            );
          })}

          {isRouterConnected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--glass-border)', paddingTop: '6px', marginTop: '4px', width: '100%' }}>
              {!collapsed && <div style={{ padding: '2px 10px 2px', fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sidebar.routerMenu')}</div>}
              {routerItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== `/${routerId}` && pathname.startsWith(`${item.href}/`));
                return (
                  <Link key={idx} to={item.href} title={collapsed ? item.label : undefined} onClick={() => onClose?.()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', padding: '6px 10px', borderRadius: '8px', color: isActive ? '#fff' : 'var(--text-muted)', backgroundColor: isActive ? 'var(--primary)' : 'transparent', textDecoration: 'none', transition: 'all 0.2s ease', fontWeight: isActive ? '700' : '500', fontSize: '13px', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}><Icon size={18} color={isActive ? '#fff' : 'var(--foreground)'} /></div>
                    <span style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', transition: 'opacity 0.2s ease, width 0.2s ease', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Copyright at Bottom */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ textAlign: 'center', fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
              <div>{t('sidebar.copyright', { year: new Date().getFullYear() })} • <a href="mailto:farishmd93@gmail.com" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>farishmd93@gmail.com</a></div>
            </div>
          )}
        </div>
      </SidebarContainer>

      {showLogoutConfirm && (
        <LogoutConfirmModal onClose={() => setShowLogoutConfirm(false)} />
      )}
    </>
  );
}