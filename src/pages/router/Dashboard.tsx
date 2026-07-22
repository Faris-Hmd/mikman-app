import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesAPI, fetchSingleRouterStatusAPI, fetchRevenueStatsAPI, fetchRouterHistoryAPI, formatUptimeAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getTemperature, getRouterImage } from '../../lib/helpers';
import LoadingScreen from '../../components/LoadingScreen';
import {
  Wifi, Activity, Cpu, Clock, Users, Thermometer, MapPin, Ticket,
  Layers, FileText, Printer, Radio, Settings, AlertCircle, CheckCircle2
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

type ChartMetric = 'cpu' | 'users' | 'ram' | 'temp';
type ChartRange = '1h' | '24h';

const METRIC_KEYS: ChartMetric[] = ['cpu', 'users', 'ram', 'temp'];
const getMetricLabel = (key: ChartMetric, t: (k: string) => string) => {
  const map: Record<ChartMetric, string> = {
    cpu: t('dashboard.historyChart_cpu') || 'CPU',
    users: t('dashboard.historyChart_users') || 'Users',
    ram: t('dashboard.historyChart_ram') || 'RAM',
    temp: t('dashboard.historyChart_temp') || 'Temp',
  };
  return map[key];
};
const getMetricUnit = (key: ChartMetric) => ({ cpu: '%', users: '', ram: 'MB', temp: '°C' }[key]);
const parseMetric = (key: ChartMetric, d: any): number | null => {
  switch (key) {
    case 'cpu': return d.cpu_load != null ? Number(d.cpu_load) : null;
    case 'users': return d.active_users != null ? Number(d.active_users) : null;
    case 'ram': return d.ram_used_mb != null ? Number(d.ram_used_mb) : null;
    case 'temp': return d.temperature != null ? Number(d.temperature) : null;
  }
};

function barColor(val: number, metric: ChartMetric): string {
  if (metric === 'cpu') return val >= 80 ? '#ef4444' : val >= 50 ? '#f59e0b' : 'var(--primary)';
  if (metric === 'ram') return val >= 90 ? '#ef4444' : val >= 75 ? '#f59e0b' : 'var(--primary)';
  if (metric === 'temp') return val >= 80 ? '#ef4444' : val >= 65 ? '#f59e0b' : 'var(--primary)';
  return 'var(--primary)';
}

export default function RouterDashboardPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();
  const [chartMetric, setChartMetric] = useState<ChartMetric>('cpu');
  const [chartRange, setChartRange] = useState<ChartRange>('24h');

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

  const historyHours = chartRange === '1h' ? 1 : 24;
  const { data: history } = useSWR(
    routerId ? `router-history-${routerId}-${historyHours}h` : null,
    () => fetchRouterHistoryAPI(routerId!, historyHours, 500),
    { revalidateOnFocus: true, dedupingInterval: 120000 }
  );

  const historyBuckets = useMemo(() => {
    if (!history || history.length === 0) return [];
    const now = Date.now();
    const numBuckets = chartRange === '1h' ? 12 : 24; // 5-min or 1-hour buckets
    const bucketMs = chartRange === '1h' ? 5 * 60 * 1000 : 3600 * 1000;
    const totalMs = numBuckets * bucketMs;
    const buckets: { label: string; values: number[] }[] = [];

    for (let i = 0; i < numBuckets; i++) {
      const slot = Math.floor((now - (numBuckets - 1 - i) * bucketMs) / bucketMs) * bucketMs;
      const d = new Date(slot);
      const label = chartRange === '1h'
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false });
      buckets.push({ label, values: [] });
    }

    for (const entry of history) {
      const ts = new Date(entry.recorded_at).getTime();
      const slot = Math.floor(ts / bucketMs) * bucketMs;
      const idx = numBuckets - 1 - Math.floor((now - slot) / bucketMs);
      if (idx >= 0 && idx < numBuckets) {
        const val = parseMetric(chartMetric, entry);
        if (val != null) buckets[idx].values.push(val);
      }
    }

    return buckets.map(b => ({
      label: b.label,
      max: b.values.length > 0 ? Math.round(Math.max(...b.values)) : null,
      avg: b.values.length > 0 ? Math.round(b.values.reduce((a, b) => a + b, 0) / b.values.length) : null,
    }));
  }, [history, chartRange, chartMetric]);

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
  const [hoveredBar, setHoveredBar] = useState<{ idx: number; data: any } | null>(null);
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

  const StatRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
    <div style={{ ...S.card, ...S.statCard, padding: '10px 12px' }}>
      <div style={S.statIcon}><Icon size={14} style={{ color: 'var(--primary)' }} /></div>
      <div style={{ minWidth: 0 }}><div style={S.label}>{label}</div><div style={{ ...S.value, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div></div>
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
    <div style={S.page as React.CSSProperties}>
      {/* Status banner + clock */}
      <div style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {routerImg ? (
            <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <img src={routerImg} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              {isConnected && <div style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', backgroundColor: '#22c55e', border: '1.5px solid var(--card-bg)', boxShadow: '0 0 4px #22c55e', animation: 'pulse-dot 2s ease-in-out infinite' }} />}
            </div>
          ) : (
            isConnected ? <div style={S.pulseDot} /> : <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{routerName}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, flexWrap: 'wrap' }}>
              {profileData?.model && <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{profileData.model}</span>}
              <span style={S.pill(isConnected)}>{isConnected ? t('common.online') || 'Online' : t('common.offline') || 'Offline'}</span>
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
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 }}>{routerTime}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{routerDate}</div>
          </div>
        )}
      </div>

      {/* System health */}
      <div>
        <StatLabel><Activity size={12} style={{ color: 'var(--primary)' }} /><span style={S.sectionBadge}>{t('dashboard.systemHealth') || 'System Health'}</span></StatLabel>
        <div style={S.grid('repeat(auto-fill, minmax(180px, 1fr))')}>
          <StatRow icon={Cpu} label={t('header.cpuLoad') || 'CPU'} value={<span style={S.cpuColor(status?.cpuLoad)}>{isConnected && cpuDisp ? cpuDisp : '—'}</span>} />
          <div style={{ ...S.card, ...S.statCard, padding: '10px 12px' }}>
            <div style={S.statIcon}><Activity size={14} style={{ color: 'var(--primary)' }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.label}>{t('header.ram') || 'RAM'}</div>
              {isConnected && memUsed != null && memTotal != null ? (
                <div><div style={S.valueSm}>{memUsed} / {memTotal} MB</div>
                  <div style={{ height: 3, background: 'var(--secondary)', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, memPct || 0)}%`, background: (memPct || 0) >= 90 ? '#ef4444' : (memPct || 0) >= 75 ? '#f59e0b' : 'var(--primary)', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ) : <div style={S.valueSm}>—</div>}
            </div>
          </div>
          <StatRow icon={Thermometer} label={t('header.temp') || 'Temp'} value={isConnected && tmpDisp ? tmpDisp : '—'} />
          <StatRow icon={Clock} label={t('header.uptime') || 'Uptime'} value={isConnected && upDisp ? upDisp : '—'} />
          <StatRow icon={Users} label={t('dashboard.activeSessions') || 'Users'} value={isConnected && status?.activeUsers != null ? status.activeUsers : '—'} />
          <StatRow icon={Wifi} label={t('header.ssid') || 'SSID'} value={isConnected && status?.wifiName ? status.wifiName : '—'} />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <StatLabel><Ticket size={12} style={{ color: 'var(--primary)' }} /><span style={S.sectionBadge}>{t('dashboard.quickActions') || 'Quick Actions'}</span></StatLabel>
        <div style={S.grid('repeat(auto-fill, minmax(80px, 1fr))')}>
          {([ { Icon: Ticket, tk: 'vouchers', slug: 'vouchers' }, { Icon: Layers, tk: 'profiles', slug: 'profiles' }, { Icon: Printer, tk: 'batchPrint', slug: 'batch' }, { Icon: Users, tk: 'users', slug: 'users' }, { Icon: Radio, tk: 'devices', slug: 'aps' }, { Icon: FileText, tk: 'revenue', slug: 'revenue' }, { Icon: Settings, tk: 'settings', slug: 'settings' } ] as const).map(({ Icon, tk, slug }) => (
            <Link key={slug} to={`/${routerId}/${slug}`} style={{ ...S.card, ...S.quickLink }}><Icon size={16} style={{ color: 'var(--primary)' }} /><span style={{ fontSize: 10, fontWeight: 700 }}>{t(`sidebar.${tk}`) || tk}</span></Link>
          ))}
        </div>
      </div>

      {/* History chart — single chart with metric + range selectors */}
      {isConnected && historyBuckets && historyBuckets.length > 0 && (
        <div>
          {/* Section header with metric tabs + range tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={12} style={{ color: 'var(--primary)' }} />
              <span style={S.sectionBadge}>{t('dashboard.history') || 'History'}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={S.tabBtn(chartRange === '1h')} onClick={() => setChartRange('1h')}>{t('dashboard.history_1h') || '1h'}</button>
              <button style={S.tabBtn(chartRange === '24h')} onClick={() => setChartRange('24h')}>{t('dashboard.history_24h') || '24h'}</button>
            </div>
          </div>

          {/* Metric tabs */}
          <div style={{ ...S.card, padding: 0, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', padding: '4px', gap: 4, background: 'var(--secondary)', borderRadius: '14px 14px 0 0' }}>
              {METRIC_KEYS.map(key => (
                <button key={key} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', background: chartMetric === key ? 'var(--card-bg)' : 'transparent', color: chartMetric === key ? 'var(--foreground)' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => setChartMetric(key)}>
                  {getMetricLabel(key, t)}
                </button>
              ))}
            </div>

            {/* Chart body */}
            <div style={{ padding: '14px 16px', position: 'relative', overflow: 'visible' }}>
              <div style={{ ...S.flexBetween, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--foreground)' }}>{getMetricLabel(chartMetric, t)} ({getMetricUnit(chartMetric)})</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {t('dashboard.historyMax') || 'MAX'}: {Math.max(...historyBuckets.map(d => d.max ?? 0), 0)}{getMetricUnit(chartMetric)}
                </span>
              </div>
              {(() => {
                const dataPoints = historyBuckets.map(d => d.max);
                const globalMax = Math.max(...dataPoints.filter(v => v != null) as number[], 1);
                const chartH = 120;
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: chartRange === '1h' ? 2 : 4, height: chartH, paddingBottom: 18, position: 'relative' }}>
                    {historyBuckets.map((bucket, i: number) => {
                      const val = bucket.max;
                      const h = val != null ? Math.max(3, (val / globalMax) * chartH) : 0;
                      const bc = val != null ? barColor(val, chartMetric) : 'transparent';
                      const isHov = hoveredBar?.idx === i;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: val != null ? 'pointer' : 'default' }}
                          onMouseEnter={() => val != null && setHoveredBar({ idx: i, data: bucket })}
                          onMouseLeave={() => setHoveredBar(null)}>
                          {isHov && val != null && (
                            <div style={{ position: 'absolute', bottom: chartH + 26, left: '50%', transform: 'translateX(-50%)', background: 'var(--foreground)', color: 'var(--background)', padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                              {bucket.label} · {t('dashboard.historyMax') || 'MAX'} {val}{getMetricUnit(chartMetric)}
                            </div>
                          )}
                          {/* Overlap: bar (max) + dot (avg) */}
                          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '100%', height: h, background: bc, borderRadius: '2px 2px 0 0', opacity: isHov ? 1 : (val != null ? 0.5 : 0.08), transition: 'opacity 0.15s' }} />
                            {bucket.avg != null && (
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%', background: 'var(--foreground)',
                                position: 'absolute', bottom: h - 3, border: '1.5px solid var(--card-bg)',
                                opacity: isHov ? 1 : 0.7, transition: 'opacity 0.15s',
                              }} />
                            )}
                          </div>
                          {(i % (chartRange === '1h' ? 3 : 3) === 0 || i === historyBuckets.length - 1) && (
                            <span style={{ fontSize: 7, color: 'var(--text-muted)', position: 'absolute', bottom: 0, whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {bucket.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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