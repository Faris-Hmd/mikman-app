import { Link } from 'react-router-dom';
import { Ticket, Layers, Printer, TrendingUp, Laptop, Settings } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface QuickActionsGridProps {
  routerId: string;
}

const ACTION_ITEMS = [
  { Icon: Ticket, tk: 'vouchers', slug: 'vouchers' },
  { Icon: Layers, tk: 'profiles', slug: 'profiles' },
  { Icon: Printer, tk: 'batchPrint', slug: 'batch' },
  { Icon: TrendingUp, tk: 'revenue', slug: 'revenue' },
  { Icon: Laptop, tk: 'devices', slug: 'aps' },
  { Icon: Settings, tk: 'settings', slug: 'settings' },
] as const;

export default function QuickActionsGrid({ routerId }: QuickActionsGridProps) {
  const { t } = useLanguage();

  return (
    <div>
      <div className="dash-section-header">
        <Ticket size={13} className="text-blue" />
        <span className="dash-section-title">
          {t('dashboard.quickActions') || 'Quick Actions'}
        </span>
      </div>
      <div className="quick-actions-grid">
        {ACTION_ITEMS.map(({ Icon, tk, slug }) => (
          <Link
            key={slug}
            to={`/${routerId}/${slug}`}
            className="responsive-card hover-card dash-quick-link"
          >
            <div className="dash-quick-icon-box">
              <Icon size={18} />
            </div>
            <span className="dash-quick-link-text">{t(`sidebar.${tk}`) || tk}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
