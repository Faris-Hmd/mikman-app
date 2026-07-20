import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Ticket, Server, Layers, Users, Laptop, Settings, ChevronLeft, ChevronRight, Sun, Moon, LogOut, LayoutDashboard, TrendingUp, User, Globe, Home } from 'lucide-react';
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const userPhoto = user?.user_metadata?.avatar_url || user?.photoURL || '';
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.displayName || user?.email?.split('@')[0] || 'Network Admin';
  const userEmail = user?.email || '';

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('@sidebar_collapsed');
    setIsCollapsed(stored === 'true');
    const storedTheme = localStorage.getItem('@theme') as 'dark' | 'light';
    if (storedTheme) setTheme(storedTheme);
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

  const handleSignOutRequest = () => {
    if (isMobile && onClose) onClose();
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
    { href: `/${routerId}/profiles`, label: t('sidebar.profiles'), icon: Server },
    { href: `/${routerId}/batch`, label: t('sidebar.batchPrint'), icon: Layers },
    { href: `/${routerId}/users`, label: t('sidebar.users'), icon: Users },
    { href: `/${routerId}/aps`, label: t('sidebar.devices'), icon: Laptop },
    { href: `/${routerId}/records`, label: t('sidebar.audit'), icon: Server },
    { href: `/${routerId}/settings`, label: t('sidebar.settings'), icon: Settings },
  ] : [];

  const SidebarContainer = isMobile ? 'div' : 'aside';

  return (
    <>
      <SidebarContainer className={isMobile ? '' : 'desktop-nav'}
        style={{ width: isMobile ? '100%' : (collapsed ? '68px' : '240px'), transition: isMobile ? 'none' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)', height: '100%', backgroundColor: isMobile ? 'transparent' : 'var(--card-bg)', borderRight: isMobile ? 'none' : '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, overflowX: 'hidden', boxSizing: 'border-box', padding: isMobile ? '0 16px 16px' : '0 10px 12px', zIndex: 90 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', flexShrink: 0 }}>
          <Link to="/" onClick={() => { if (isMobile && onClose) onClose(); }} title={t('header.routerSelection')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', boxSizing: 'border-box', height: isMobile ? '56px' : '60px', marginTop: '0', marginLeft: isMobile ? '-16px' : '-10px', marginRight: isMobile ? '-16px' : '-10px', paddingTop: isMobile ? '12px' : '14px', paddingBottom: isMobile ? '12px' : '14px', paddingLeft: isMobile ? '16px' : '10px', paddingRight: isMobile ? '16px' : '10px', borderBottom: '1px solid var(--glass-border)', marginBottom: isMobile ? '16px' : '10px', width: isMobile ? 'calc(100% + 32px)' : 'calc(100% + 20px)', cursor: 'pointer', transition: 'background-color 0.2s', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ticket size={18} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
              </div>
              {!collapsed && <h1 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>{t('sidebar.menuTitle') || 'MIKMAN Menu'}</h1>}
            </div>
          </Link>
          {!isMobile && (
            <button onClick={toggleCollapse} title={collapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', padding: '7px 10px', borderRadius: '10px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', transition: 'all 0.2s ease', fontSize: '13px', fontWeight: '500', cursor: 'pointer', width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}>
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </div>
              {!collapsed && <span>{t('sidebar.collapseMenu')}</span>}
            </button>
          )}
        </div>

        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box', paddingRight: collapsed ? '0' : '4px' }}>
          {!collapsed && <div style={{ padding: '4px 10px 4px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sidebar.mainMenu')}</div>}
          {globalItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link key={idx} to={item.href} title={collapsed ? item.label : undefined}
                onClick={() => { onClose?.(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', padding: '7px 10px', borderRadius: '10px', color: item.isActive ? '#fff' : 'var(--text-muted)', backgroundColor: item.isActive ? 'var(--primary)' : 'transparent', textDecoration: 'none', transition: 'all 0.2s ease', fontWeight: item.isActive ? '700' : '500', fontSize: '13px', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}><Icon size={18} color={item.isActive ? '#fff' : 'var(--foreground)'} /></div>
                <span style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', transition: 'opacity 0.2s ease, width 0.2s ease', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</span>
              </Link>
            );
          })}

          {isRouterConnected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px', marginTop: '6px', width: '100%' }}>
              {!collapsed && <div style={{ padding: '2px 10px 4px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sidebar.routerMenu')}</div>}
              {routerItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={idx} to={item.href} title={collapsed ? item.label : undefined} onClick={() => onClose?.()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', padding: '7px 10px', borderRadius: '10px', color: isActive ? '#fff' : 'var(--text-muted)', backgroundColor: isActive ? 'var(--primary)' : 'transparent', textDecoration: 'none', transition: 'all 0.2s ease', fontWeight: isActive ? '700' : '500', fontSize: '13px', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}><Icon size={18} color={isActive ? '#fff' : 'var(--foreground)'} /></div>
                    <span style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', transition: 'opacity 0.2s ease, width 0.2s ease', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: 'auto', paddingTop: '10px', flexShrink: 0 }}>
          {collapsed ? (
            <>
              <button onClick={toggleTheme} title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: '10px', color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', transition: 'all 0.2s ease', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}>
                  {theme === 'dark' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
                </div>
              </button>
              <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} title={t('header.languageSelector')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 10px', borderRadius: '10px', color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', transition: 'all 0.2s ease', width: '100%', cursor: 'pointer', boxSizing: 'border-box', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '20px' }}><Globe size={18} color="var(--primary)" /></div>
              </button>
              {user && (
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%' }}>
                  <Link to="/account" onClick={() => { if (isMobile && onClose) onClose(); }} title={t('sidebar.accountDetails')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0', borderRadius: '8px', cursor: 'pointer', boxSizing: 'border-box', transition: 'background-color 0.2s', width: '100%', textDecoration: 'none' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', backgroundColor: 'var(--card-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {userPhoto ? <img src={userPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      : <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>{userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U'}</div>}
                    </div>
                  </Link>
                  <button onClick={handleSignOutRequest}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', padding: '6px', color: '#ef4444', cursor: 'pointer', width: '100%', transition: 'background-color 0.2s' }}>
                    <LogOut size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {user && (
                <div style={{ marginTop: '2px', paddingTop: '6px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box', width: '100%' }}>
                  <Link to="/account" onClick={() => { if (isMobile && onClose) onClose(); }} title={t('sidebar.accountDetails')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer', boxSizing: 'border-box', transition: 'background-color 0.2s', textDecoration: 'none' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', backgroundColor: 'var(--card-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {userPhoto ? <img src={userPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      : <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{userDisplayName ? userDisplayName.charAt(0).toUpperCase() : 'U'}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userDisplayName}</span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</span>
                    </div>
                  </Link>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                  <button onClick={toggleTheme}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 8px', borderRadius: '8px', color: 'var(--text-muted)', backgroundColor: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid var(--glass-border)', transition: 'all 0.2s ease', fontWeight: '600', fontSize: '11px', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                    {theme === 'dark' ? <Sun size={14} color="var(--primary)" /> : <Moon size={14} color="var(--primary)" />}
                    <span>{theme === 'dark' ? (t('sidebar.light') || 'Light') : (t('sidebar.dark') || 'Dark')}</span>
                  </button>
                  <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 8px', borderRadius: '8px', color: 'var(--text-muted)', backgroundColor: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid var(--glass-border)', transition: 'all 0.2s ease', fontWeight: '600', fontSize: '11px', cursor: 'pointer', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                    <Globe size={14} color="var(--primary)" />
                    <span>{language === 'en' ? 'العربية' : 'English'}</span>
                  </button>
                </div>
                {user && (
                  <button onClick={handleSignOutRequest}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '6px 8px', color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
                    <LogOut size={14} />
                    <span>{t('sidebar.signOutShort') || 'Sign Out'}</span>
                  </button>
                )}
              </div>
              <div style={{ textAlign: 'center', fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px', paddingTop: '6px', borderTop: '1px solid var(--glass-border)', lineHeight: '1.3' }}>
                <div>{t('sidebar.copyright', { year: new Date().getFullYear() })}</div>
                <a href="mailto:farishmd93@gmail.com" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}>farishmd93@gmail.com</a>
              </div>
            </>
          )}
        </div>
      </SidebarContainer>

      {showLogoutConfirm && (
        <LogoutConfirmModal onClose={() => setShowLogoutConfirm(false)} />
      )}
    </>
  );
}