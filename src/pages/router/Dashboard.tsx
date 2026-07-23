import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesAPI, fetchSingleRouterStatusAPI, fetchRevenueStatsAPI, formatUptimeAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getTemperature, getRouterImage } from '../../lib/helpers';
import LoadingScreen from '../../components/LoadingScreen';
import {
  Wifi, Activity, Cpu, Clock, Users, Thermometer, Ticket,
  Layers, FileText, Printer, Radio, Settings, AlertCircle
} from 'lucide-react';

/* ─── Shared styles ─── */
const S = {
  page: { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%', maxWidth: 900, margin: '0 auto' },
  card: { background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: 14 },
  statCard: { display: 'flex', alignItems: 'center' as const, gap: 10 },
  statIcon: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center' as const, justifyContent: 'center', flexShrink: 0, background: 'rgba(var(--primary-rgb), 0.1)' } as React.CSSProperties,
  label: { fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 0.4 } as React.CSSProperties,
  value: { fontSize: 14, fontWeight: 800, color: 'var(--foreground)' } as React.CSSProperties,
  valueSm: { fontSize: 12, fontWeight: 800, color: 'var(--foreground)' } as React.CSSProperties,
  valueLg: { fontSize: 20, fontWeight: 800, color: 'var(--foreground)' } as React.CSSProperties,
  section: { display: 'flex', alignItems: 'center' as const, gap: 6, marginBottom: 10 },
  sectionBadge: { fontSize: 10, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' as const, letterSpacing: 0.6 } as React.CSSProperties,
  quickLink: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' as const, gap: 4, padding: '10px 8px', textDecoration: 'none', color: 'var(--foreground)', transition: 'border-color 0.2s, background-color 0.2s' } as React.CSSProperties,
  pill: (active: boolean) => ({ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: active ? '#16a34a20' : '#dc262620', color: active ? '#16a34a' : '#dc2626', flexShrink: 0 } as React.CSSProperties),
  cpuColor: (val: number | null | undefined) => val != null && val >= 80 ? { color: '#ef4444', fontWeight: 800 } as React.CSSProperties : {} as React.CSSProperties,
  pulseDot: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0 } as React.CSSProperties,
  grid: (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, gap: 8 } as React.CSSProperties),
  flexBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' as const },
  tabBtn: (active: boolean) => ({ padding: '5px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--primary)' : 'var(--secondary)', color: active ? '#fff' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' } as React.CSSProperties),
} as const;

export default function RouterDashboardPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

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

  const { data: revenue } = useSWR(
    routerId ? `router-dash-rev-${routerId}` : null,
    () => {
      const end = new Date(); const start = new Date();
      start.setDate(start.getDate() - 30);
      return fetchRevenueStatsAPI(routerId!, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    },
    { revalidateOnFocus: true, dedupingInterval: 60000 }
  );

  const routerName = profileData?.name || routerId || 'MikroTik';
  const routerImg = useMemo(() => profileData ? getRouterImage(profileData as any) : null, [profileData]);
  const memUsed = useMemo(() => {
    if (!status || status.totalMemory == null || status.freeMemory == null) return null;
    return Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024));
  }, [status]);
  const memTotal = useMemo(() => status?.totalMemory != null ? Math.round(Number(status.totalMemory) / (1024 * 1024)) : null, [status]);
  const memPct = useMemo(() => (status && status.totalMemory != null && status.freeMemory != null) ? Math.round(((Number(status.totalMemory) - Number(status.freeMemory)) / Number(status.totalMemory)) * 100) : null, [status]);

  const cpuDisp = status?.cpuLoad_display || (status?.cpuLoad != null ? `${status.cpuLoad}%` : null);
  const tmpDisp = status?.temperature_display || (status?.temperature != null ? `${getTemperature(status)}°C` : null);
  const upDisp = status?.uptime_display || (status?.uptime ? formatUptimeAPI(status.uptime) : null);

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

  const StatRow = ({ icon: Icon, label, value, title, valueStyle }: { icon: any; label: string; value: React.ReactNode; title?: string; valueStyle?: React.CSSProperties }) => (
    <div className="stat-card-compact" title={title || (typeof value === 'string' ? value : undefined)}>
      <div className="stat-icon-compact"><Icon size={14} style={{ color: 'var(--primary)' }} /></div>
      <div style={{ minWidth: 0, flex: 1 }}><div style={S.label}>{label}</div><div style={{ ...S.value, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...valueStyle }}>{value}</div></div>
    </div>
  );

  const StatLabel = ({ children }: { children: React.ReactNode }) => <div style={S.section}>{children}</div>;

  const renderBarChart = () => {
    if (!revenue?.daily?.length) return null;
    const last14 = revenue.daily.slice(-14);
    const maxRev = Math.max(...last14.map((d: any) => d.revenue), 1);
    return (
      <div style={{ ...S.card, padding: 16, marginBottom: 8 }}>
        <div style={{ ...S.flexBetween, marginBottom: 10 }}><span style={S.label}>{t('dashboard.last30Days') || 'Last 14 Days'}</span><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>$</span></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100, paddingBottom: 18, position: 'relative' }}>
          {last14.map((day: any, idx: number) => {
            const h = Math.max(4, (day.revenue / maxRev) * 100);
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <span style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>{day.revenue > 0 ? `$${Number(day.revenue).toFixed(0)}` : ''}</span>
                <div style={{ width: '100%', height: `${h}%`, background: `linear-gradient(180deg, var(--primary) 0%, rgba(var(--primary-rgb), 0.4) 100%)`, borderRadius: '4px 4px 0 0', minHeight: 2 }} />
                <span style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4, position: 'absolute', bottom: 0, fontWeight: 600 }}>{day.date?.split('-').slice(1).join('/') || ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderProfileBars = () => {
    if (!revenue?.profiles?.length) return null;
    return (
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ ...S.label, marginBottom: 10 }}>{t('sidebar.profiles') || 'By Profile'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {revenue.profiles.map((p: any, idx: number) => (
            <div key={idx}>
              <div style={{ ...S.flexBetween, marginBottom: 3 }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>{p.profile}</span><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>${Number(p.revenue).toFixed(2)}</span></div>
              <div style={{ height: 6, background: 'var(--secondary)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${p.percentage}%`, background: p.percentage >= 90 ? '#ef4444' : p.percentage >= 75 ? '#f59e0b' : 'var(--primary)', borderRadius: 3, transition: 'width 0.4s' }} /></div>
              <div style={{ ...S.flexBetween, marginTop: 2 }}><span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.count} vouchers</span><span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.percentage.toFixed(1)}%</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  };


  return (
    <div className="dashboard-page">
      {/* Status banner + clock */}
      <div style={{ ...S.card, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {routerImg ? (
            <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <img src={routerImg} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
              {isConnected && <div style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', backgroundColor: '#22c55e', border: '1.5px solid var(--card-bg)', boxShadow: '0 0 4px #22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />}
            </div>
          ) : (
            isConnected ? <div style={S.pulseDot} /> : <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{routerName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1, flexWrap: 'wrap' }}>
              {profileData?.model && <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{profileData.model}</span>}
              <span className="hide-sm" style={S.pill(isConnected)}>{isConnected ? t('common.online') || 'Online' : t('common.offline') || 'Offline'}</span>
              {status?.timezone && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{status.timezone}</span>}
              {!isConnected && lastChecked && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(lastChecked)}</span>}
              {lastCheckedDisplay && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>· {t('common.updated') || 'Updated'} {lastCheckedDisplay}</span>
              )}
            </div>
          </div>
        </div>
        {isConnected && routerTime && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3 }}>{routerTime}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{routerDate}</div>
          </div>
        )}
      </div>

      {/* System health */}
      <div>
        <StatLabel><Activity size={12} style={{ color: 'var(--primary)' }} /><span style={S.sectionBadge}>{t('dashboard.systemHealth') || 'System Health'}</span></StatLabel>
        <div className="system-health-grid">
          <StatRow icon={Cpu} label={t('header.cpuLoad') || 'CPU'} value={<span style={S.cpuColor(status?.cpuLoad)}>{isConnected && cpuDisp ? cpuDisp : '—'}</span>} />
          <div className="stat-card-compact">
            <div className="stat-icon-compact"><Activity size={14} style={{ color: 'var(--primary)' }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{t('header.ram') || 'RAM'}</div>
              {isConnected && memUsed != null && memTotal != null ? (
                <div><div style={{ ...S.valueSm, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memUsed} / {memTotal} MB</div>
                  <div style={{ height: 3, background: 'var(--secondary)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, memPct || 0)}%`, background: (memPct || 0) >= 90 ? '#ef4444' : (memPct || 0) >= 75 ? '#f59e0b' : 'var(--primary)', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ) : <div style={S.valueSm}>—</div>}
            </div>
          </div>
          <StatRow icon={Thermometer} label={t('header.temp') || 'Temp'} value={isConnected && tmpDisp ? tmpDisp : '—'} />
          <StatRow icon={Clock} label={t('header.uptime') || 'Uptime'} value={isConnected && upDisp ? upDisp : '—'} />
          <StatRow icon={Users} label={t('dashboard.activeSessions') || 'Users'} value={isConnected && status?.activeUsers != null ? status.activeUsers : '—'} />
          <StatRow
            icon={Wifi}
            label={t('header.ssid') || 'SSID'}
            title={status?.wifiName}
            valueStyle={{ fontSize: 10.5, fontWeight: 700 }}
            value={isConnected && status?.wifiName ? (status.wifiName.length > 12 ? `${status.wifiName.slice(0, 11)}…` : status.wifiName) : '—'}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <StatLabel><Ticket size={12} style={{ color: 'var(--primary)' }} /><span style={S.sectionBadge}>{t('dashboard.quickActions') || 'Quick Actions'}</span></StatLabel>
        <div className="quick-actions-grid">
          {([ { Icon: Ticket, tk: 'vouchers', slug: 'vouchers' }, { Icon: Layers, tk: 'profiles', slug: 'profiles' }, { Icon: Printer, tk: 'batchPrint', slug: 'batch' }, { Icon: Users, tk: 'users', slug: 'users' }, { Icon: Radio, tk: 'devices', slug: 'aps' }, { Icon: FileText, tk: 'revenue', slug: 'revenue' }, { Icon: Settings, tk: 'settings', slug: 'settings' } ] as const).map(({ Icon, tk, slug }) => (
            <Link key={slug} to={`/${routerId}/${slug}`} style={{ ...S.card, ...S.quickLink }}><Icon size={16} style={{ color: 'var(--primary)' }} /><span style={{ fontSize: 10, fontWeight: 700 }}>{t(`sidebar.${tk}`) || tk}</span></Link>
          ))}
        </div>
      </div>




      {/* Revenue summary */}
      {revenue && (
        <div>
          <StatLabel><Ticket size={12} style={{ color: 'var(--primary)' }} /><span style={S.sectionBadge}>{t('dashboard.revenueSummary') || 'Revenue Summary'}</span></StatLabel>
          <div style={{ ...S.grid('1fr 1fr'), marginBottom: 10 }}>
            <div style={{ ...S.card, padding: '14px 16px' }}><div style={S.label}>{t('dashboard.totalRevenue') || 'Revenue'}</div><div style={{ ...S.valueLg, marginTop: 2 }}>${Number(revenue.totalRevenue).toFixed(2)}</div></div>
            <div style={{ ...S.card, padding: '14px 16px' }}><div style={S.label}>{t('common.total') || 'Vouchers'}</div><div style={{ ...S.valueLg, marginTop: 2 }}>{revenue.totalVouchers}</div></div>
          </div>
          {renderBarChart()}
          {renderProfileBars()}
        </div>
      )}
    </div>
  );
}