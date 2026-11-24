import { useLocation, Link, useParams } from 'react-router-dom';
import { LayoutDashboard, Ticket, Layers, TrendingUp, Users, Settings } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import './shell.css';

export default function BottomNavBar() {
  const location = useLocation();
  const pathname = location.pathname;
  const params = useParams();
  const { isRtl } = useLanguage();

  const routerId = params?.routerId as string | undefined;

  // The bottom navigation bar only belongs to router sub-pages, never on the landing page or global pages
  if (!routerId || pathname === '/') {
    return null;
  }

  const routerNavItems = [
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
  ];

  return (
    <nav className="shell-bottom-bar md:hidden">
      {routerNavItems.map(item => (
        <Link
          key={item.href}
          to={item.href}
          className={`shell-bottom-tab ${item.isActive ? 'active' : ''}`}
        >
          <item.icon size={19} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
