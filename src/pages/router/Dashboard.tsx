import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesAPI, fetchSingleRouterStatusAPI, fetchRevenueStatsAPI, formatUptimeAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getTemperature, getRouterImage, cleanDisplayName } from '../../lib/helpers';
import LoadingScreen from '../../components/LoadingScreen';
import {
  Wifi, Activity, Cpu, Clock, Users, Thermometer, Ticket,
  Layers, FileText, Printer, Radio, Settings, AlertCircle, BarChart2, TrendingUp
} from 'lucide-react';

/* ─── Shared styles ─── */
const S = {
  page: { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%', maxWidth: 900, margin: '0 auto' },
  card: { background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: 14 },
  statCard: { display: 'flex', alignItems: 'center' as const, gap: 10 },
  statIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center' as const, justifyContent: 'center', flexShrink: 0, background: 'rgba(var(--primary-rgb), 0.1)' } as React.CSSProperties,
  label: { fontSize: 'var(--font-2xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 0.4 } as React.CSSProperties,
  value: { fontSize: 'var(--font-md)', fontWeight: 800, color: 'var(--foreground)' } as React.CSSProperties,
  valueSm: { fontSize: 'var(--font-sm)', fontWeight: 800, color: 'var(--foreground)' } as React.CSSProperties,
  valueLg: { fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--foreground)' } as React.CSSProperties,
  section: { display: 'flex', alignItems: 'center' as const, gap: 6, marginBottom: 10 },
  sectionBadge: { fontSize: 'var(--font-2xs)', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' as const, letterSpacing: 0.6 } as React.CSSProperties,
  quickLink: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const, gap: 4, padding: '10px 8px', textDecoration: 'none', color: 'var(--foreground)', transition: 'border-color 0.2s, background-color 0.2s' } as React.CSSProperties,
  pill: (active: boolean) => ({ padding: '4px 12px', borderRadius: 20, fontSize: 'var(--font-xs)', fontWeight: 700, background: active ? '#16a34a20' : '#dc262620', color: active ? '#16a34a' : '#dc2626', flexShrink: 0 } as React.CSSProperties),
  cpuColor: (val: number | null | undefined) => val != null && val >= 80 ? { color: '#ef4444', fontWeight: 800 } as React.CSSProperties : {} as React.CSSProperties,
  pulseDot: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0 } as React.CSSProperties,
  grid: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, gap: 8 } as React.CSSProperties),
  flexBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' as const },
  tabBtn: (active: boolean) => ({ padding: '5px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--primary)' : 'var(--secondary)', color: active ? '#fff' : 'var(--text-muted)', fontSize: 'var(--font-2xs)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' } as React.CSSProperties),
} as const;

export default function RouterDashboardPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, language } = useLanguage();
  const [activeTooltip, setActiveTooltip] = useState<{ date: string; revenue: number; count: number; index: number } | null>(null);

  const { data: status, isLoading: isStatusLoading } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 30000, revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  const isConnected = !!(status?.online || status?.status === 'online');

  const { data: profileData } = useSWR(
    routerId ? `router-profile-${routerId}` : null,
    async () => {
      const profiles = await fetchRouterProfilesAPI();
      return profiles.find((item: any) => item.id === routerId) || null;
    },
    { revalidateOnFocus: true }
  );

  // Fetch current month's revenue stats (1st of month through last day of month)
  const { data: revenue } = useSWR(
    routerId ? `router-dash-rev-${routerId}` : null,
    () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return fetchRevenueStatsAPI(
        routerId!,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
    },
    { revalidateOnFocus: true, dedupingInterval: 60000 }
  );

  // Generate full month daily array (1 to 28/29/30/31 days) matching Revenue page style
  const chartDaily = useMemo(() => {
    if (!revenue) return [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const dailyMap = new Map((revenue.daily || []).map((d: any) => [d.date, d]));
    const result: Array<{ date: string; revenue: number; count: number }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dayStr = `${year}-${mm}-${dd}`;
      const match = dailyMap.get(dayStr);
      result.push({
        date: dayStr,
        revenue: match ? match.revenue : 0,
        count: match ? match.count : 0
      });
    }

    return result;
  }, [revenue]);

  const maxRevenue = useMemo(() => {
    if (chartDaily.length === 0) return 1;
    return Math.max(...chartDaily.map(d => d.revenue), 1);
  }, [chartDaily]);

  const rawName = profileData?.name || (profileData as any)?.wifiName || status?.wifiName;
  const routerName = cleanDisplayName(rawName, routerId && !routerId.startsWith('cloud_') ? routerId : 'MikroTik');
  const routerImg = useMemo(() => profileData ? getRouterImage(profileData as any) : null, [profileData]);
  const memUsed = useMemo(() => {
    if (!status || status.totalMemory == null || status.freeMemory == null) return null;
    return Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024));
  }, [status]);
  const memTotal = useMemo(() => status?.totalMemory != null ? Math.round(Number(status.totalMemory) / (1024 * 1024)) : null, [status]);
  const memPct = useMemo(() => (status && status.totalMemory != null && status.freeMemory != null) ? Math.round(((Number(status.totalMemory) - Number(status.freeMemory)) / Number(status.totalMemory)) * 100) : null, [status]);

  const cpuDisp = status?.cpuLoad_display || (status?.cpuLoad != null ? `${status.cpuLoad}%` : null);
  const tmpDisp = status?.temperature_display || (status?.temperature != null ? `${getTemperature(status)}°C` : null);
  const upDisp = status ? formatUptimeAPI(status.uptime || status.uptime_display) : null;

  const [now, setNow] = useState(Date.now());
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (status !== undefined) setLastChecked(Date.now()); }, [status]);
  const lastCheckedDisplay = useMemo(() => {
    if (!lastChecked) return null;
    try { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(lastChecked); } catch { return ''; }
  }, [lastChecked]);

  const routerTime = useMemo(() => {
    const tz = status?.timezone; if (!tz) return null;
    try { return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now); } catch { return null; }
  }, [now, status?.timezone]);
  const routerDate = useMemo(() => {
    const tz = status?.timezone; if (!tz) return null;
    try { return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(now); } catch { return null; }
  }, [now, status?.timezone]);

  if (isStatusLoading) {
    return <LoadingScreen compact loadingTitle={t('common.loading') || 'Loading router status...'} />;
  }

  const StatRow = ({
    icon: Icon,
    label,
    value,
    title,
    accentColor = 'var(--accent)'
  }: {
    icon: any;
    label: string;
    value: React.ReactNode;
    title?: string;
    accentColor?: string;
  }) => (
    <div
      className="responsive-card"
      title={title || (typeof value === 'string' ? value : undefined)}
      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
    >
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '6px',
          background: 'var(--secondary)',
          color: accentColor,
          border: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={13} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <strong style={{ fontSize: '13.5px', color: 'var(--foreground)', fontWeight: 800, marginTop: '2px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </strong>
      </div>
    </div>
  );

  const StatLabel = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
      <Icon size={13} style={{ color: 'var(--primary)' }} />
      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </span>
    </div>
  );

  const renderBarChart = () => {
    if (!chartDaily.length) return null;
    return (
      <div className="responsive-card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart2 size={15} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
              {t('dashboard.revenueSummary') || 'Monthly Revenue Chart'}
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--secondary)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--glass-border)', fontWeight: 600 }}>
            {chartDaily.length} {language === 'ar' ? 'أيام' : 'days'}
          </span>
        </div>

        <div style={{ position: 'relative', width: '100%' }}>
          {/* Active Tooltip overlay */}
          {activeTooltip && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              zIndex: 10,
              pointerEvents: 'none',
              boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>{activeTooltip.date}:</span>
              <span style={{ color: '#60a5fa', fontWeight: 900 }}>${activeTooltip.revenue.toFixed(2)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>({activeTooltip.count} {language === 'ar' ? 'كرت' : 'vouchers'})</span>
            </div>
          )}

          {/* Flexbox bar container */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: chartDaily.length > 25 ? '1px' : '2px',
            height: '110px',
            width: '100%',
            paddingTop: '12px',
            borderBottom: '1px solid var(--glass-border)',
            boxSizing: 'border-box'
          }}>
            {chartDaily.map((item, idx) => {
              const heightPercent = Math.max((item.revenue / maxRevenue) * 100, item.revenue > 0 ? 6 : 2);
              const isHovered = activeTooltip?.index === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveTooltip({ date: item.date, revenue: item.revenue, count: item.count, index: idx })}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onTouchStart={() => setActiveTooltip({ date: item.date, revenue: item.revenue, count: item.count, index: idx })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPercent}%`,
                      background: item.revenue > 0
                        ? isHovered
                          ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)'
                          : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.15s ease',
                      boxShadow: isHovered ? '0 0 8px rgba(59,130,246,0.7)' : 'none'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis day numbers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
            {chartDaily.map((item, idx) => {
              const totalBars = chartDaily.length;
              const showLabel = idx === 0 || idx === totalBars - 1 || idx % Math.ceil(totalBars / 6) === 0;
              const dayNum = item.date ? parseInt(item.date.split('-')[2], 10) : idx + 1;
              return (
                <span key={idx} style={{ flex: 1, textAlign: 'center', opacity: showLabel ? 1 : 0, fontWeight: 600 }}>
                  {dayNum}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="responsive-container" style={{ gap: '12px' }}>
      {/* Page Header Card */}
      <div className="page-header-card" style={{ padding: '8px 12px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <img src={routerImg || ''} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="page-header-title" style={{ fontSize: '15px' }}>{routerName}</h2>
            <p className="page-header-subtitle" style={{ fontSize: '10.5px' }}>
              {profileData?.model ? profileData.model.toUpperCase() : (status?.timezone || (isConnected ? t('common.online') : t('common.offline')))}
            </p>
          </div>
        </div>

        {isConnected && routerTime && (
          <div style={{ textAlign: language === 'ar' ? 'left' : 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>{routerTime}</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{routerDate}</div>
          </div>
        )}
      </div>

      {/* System health */}
      <div>
        <StatLabel icon={Activity} title={t('dashboard.systemHealth') || 'System Health'} />
        <div className="stat-summary-grid">
          <StatRow icon={Cpu} label={t('header.cpuLoad') || 'CPU'} value={<span style={S.cpuColor(status?.cpuLoad)}>{isConnected && cpuDisp ? cpuDisp : '—'}</span>} accentColor="#3b82f6" />

          {/* RAM Card */}
          <div className="responsive-card" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--secondary)', color: '#3b82f6', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={13} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('header.ram') || 'RAM'}
              </span>
              {isConnected && memUsed != null && memTotal != null ? (
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--foreground)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', marginTop: '2px' }}>
                    {memUsed} / {memTotal} MB
                  </strong>
                  <div style={{ height: 3, background: 'var(--secondary)', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, memPct || 0)}%`, background: (memPct || 0) >= 90 ? '#ef4444' : (memPct || 0) >= 75 ? '#f59e0b' : '#3b82f6', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ) : (
                <strong style={{ fontSize: '13.5px', color: 'var(--foreground)', fontWeight: 800, marginTop: '2px', display: 'block' }}>—</strong>
              )}
            </div>
          </div>

          <StatRow icon={Thermometer} label={t('header.temp') || 'Temp'} value={isConnected && tmpDisp ? tmpDisp : '—'} accentColor="#f59e0b" />
          <StatRow icon={Clock} label={t('header.uptime') || 'Uptime'} value={isConnected && upDisp ? upDisp : '—'} accentColor="#a855f7" />
          <StatRow icon={Users} label={t('dashboard.activeSessions') || 'Users'} value={isConnected && status?.activeUsers != null ? status.activeUsers : '—'} accentColor="#06b6d4" />
          <StatRow
            icon={Wifi}
            label={t('header.ssid') || 'SSID'}
            title={status?.wifiName}
            value={isConnected && status?.wifiName ? status.wifiName : '—'}
            accentColor="#ec4899"
          />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <StatLabel icon={Ticket} title={t('dashboard.quickActions') || 'Quick Actions'} />
        <div className="quick-actions-grid">
          {([ { Icon: Ticket, tk: 'vouchers', slug: 'vouchers' }, { Icon: Layers, tk: 'profiles', slug: 'profiles' }, { Icon: Printer, tk: 'batchPrint', slug: 'batch' }, { Icon: TrendingUp, tk: 'revenue', slug: 'revenue' }, { Icon: Settings, tk: 'settings', slug: 'settings' } ] as const).map(({ Icon, tk, slug }) => (
            <Link key={slug} to={`/${routerId}/${slug}`} className="responsive-card hover-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 6px', textDecoration: 'none', color: 'var(--foreground)' }}>
              <Icon size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, textAlign: 'center' }}>{t(`sidebar.${tk}`) || tk}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Revenue summary */}
      {revenue && (
        <div>
          <StatLabel icon={TrendingUp} title={t('dashboard.revenueSummary') || 'Revenue Summary'} />
          <div className="stat-summary-grid" style={{ marginBottom: '8px' }}>
            <div className="responsive-card" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.3) 100%)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrendingUp size={13} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('dashboard.totalRevenue') || 'Revenue'}
                </span>
                <strong style={{ fontSize: '13.5px', color: 'var(--foreground)', fontWeight: 800, marginTop: '2px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ${Number(revenue.totalRevenue).toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="responsive-card" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(79,70,229,0.3) 100%)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ticket size={13} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('common.total') || 'Vouchers'}
                </span>
                <strong style={{ fontSize: '13.5px', color: 'var(--foreground)', fontWeight: 800, marginTop: '2px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {revenue.totalVouchers}
                </strong>
              </div>
            </div>
          </div>
          {renderBarChart()}
        </div>
      )}
    </div>
  );
}