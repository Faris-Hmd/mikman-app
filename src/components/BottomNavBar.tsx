import { useLocation, Link, useParams } from 'react-router-dom';
import { LayoutDashboard, Ticket, Layers, TrendingUp, Users, Settings, Home, User, PlusCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNavBar() {
  const location = useLocation();
  const pathname = location.pathname;
  const params = useParams();
  const { t, isRtl } = useLanguage();

  // Extract routerId if present in route params or path
  const routerId = params?.routerId as string | undefined;

  const routerNavItems = routerId ? [
    {
      href: `/${routerId}`,
      label: isRtl ? 'الرئيسية' : 'Home',
      icon: LayoutDashboard,
      isActive: pathname === `/${routerId}`
    },
    {
      href: `/${routerId}/vouchers`,
      label: isRtl ? 'الكروت' : 'Vouchers',
      icon: Ticket,
      isActive: pathname.startsWith(`/${routerId}/vouchers`) || pathname.startsWith(`/${routerId}/batch`)
    },
    {
      href: `/${routerId}/profiles`,
      label: isRtl ? 'الباقات' : 'Profiles',
      icon: Layers,
      isActive: pathname.startsWith(`/${routerId}/profiles`)
    },
    {
      href: `/${routerId}/revenue`,
      label: isRtl ? 'المبيعات' : 'Revenue',
      icon: TrendingUp,
      isActive: pathname.startsWith(`/${routerId}/revenue`)
    },
    {
      href: `/${routerId}/users`,
      label: isRtl ? 'المتصلين' : 'Users',
      icon: Users,
      isActive: pathname.startsWith(`/${routerId}/users`)
    },
    {
      href: `/${routerId}/settings`,
      label: isRtl ? 'الإعدادات' : 'Settings',
      icon: Settings,
      isActive: pathname.startsWith(`/${routerId}/settings`)
    }
  ] : [
    {
      href: '/',
      label: isRtl ? 'الرئيسية' : 'Home',
      icon: Home,
      isActive: pathname === '/'
    },
    {
      href: '/register-router',
      label: isRtl ? 'إضافة راوتر' : 'Add Router',
      icon: PlusCircle,
      isActive: pathname === '/register-router'
    },
    {
      href: '/account',
      label: isRtl ? 'الحساب' : 'Account',
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
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--glass-border)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '2px 4px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>
      {routerNavItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <Link
            key={idx}
            to={item.href}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              height: '100%',
              padding: '2px 1px',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3px 10px',
              borderRadius: '12px',
              backgroundColor: item.isActive ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
              transform: item.isActive ? 'scale(1.04)' : 'scale(1)',
              transition: 'all 0.15s ease',
            }}>
              <Icon
                size={18}
                color={item.isActive ? 'var(--primary, #3b82f6)' : 'var(--text-muted)'}
                strokeWidth={item.isActive ? 2.4 : 1.8}
              />
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: item.isActive ? '800' : '500',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              width: '100%',
              textAlign: 'center',
              letterSpacing: '-0.1px',
              padding: '0 1px',
              color: item.isActive ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
            }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
