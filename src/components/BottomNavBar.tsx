import { useLocation, Link, useParams } from 'react-router-dom';
import { LayoutDashboard, Ticket, Layers, TrendingUp, Users, Settings, Home, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNavBar() {
  const location = useLocation();
  const pathname = location.pathname;
  const params = useParams();
  const { t } = useLanguage();

  // Extract routerId if present in route params or path
  const routerId = params?.routerId as string | undefined;

  const routerNavItems = routerId ? [
    {
      href: `/${routerId}`,
      label: t('sidebar.dashboard'),
      icon: LayoutDashboard,
      isActive: pathname === `/${routerId}`
    },
    {
      href: `/${routerId}/vouchers`,
      label: t('sidebar.vouchers'),
      icon: Ticket,
      isActive: pathname.startsWith(`/${routerId}/vouchers`) || pathname.startsWith(`/${routerId}/batch`)
    },
    {
      href: `/${routerId}/profiles`,
      label: t('sidebar.profiles'),
      icon: Layers,
      isActive: pathname.startsWith(`/${routerId}/profiles`)
    },
    {
      href: `/${routerId}/revenue`,
      label: t('sidebar.revenue'),
      icon: TrendingUp,
      isActive: pathname.startsWith(`/${routerId}/revenue`)
    },
    {
      href: `/${routerId}/users`,
      label: t('sidebar.users'),
      icon: Users,
      isActive: pathname.startsWith(`/${routerId}/users`)
    },
    {
      href: `/${routerId}/settings`,
      label: t('sidebar.settings'),
      icon: Settings,
      isActive: pathname.startsWith(`/${routerId}/settings`)
    }
  ] : [
    {
      href: '/',
      label: t('sidebar.mainPage'),
      icon: Home,
      isActive: pathname === '/'
    },
    {
      href: '/account',
      label: t('sidebar.accountDetails'),
      icon: User,
      isActive: pathname === '/account'
    }
  ];

  return (
    <nav className="mobile-bottom-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: 'var(--header-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--glass-border)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 8px',
        boxSizing: 'border-box',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)'
      }}>
      {routerNavItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <Link
            key={idx}
            to={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              textDecoration: 'none',
              color: item.isActive ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            {item.isActive && (
              <div style={{
                position: 'absolute',
                top: 0,
                width: '28px',
                height: '3px',
                borderRadius: '0 0 4px 4px',
                backgroundColor: 'var(--primary)',
                boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.6)'
              }} />
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: item.isActive ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.2s ease'
            }}>
              <Icon size={19} color={item.isActive ? 'var(--primary)' : 'var(--text-muted)'} />
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: item.isActive ? '800' : '600',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '64px',
              textAlign: 'center'
            }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
