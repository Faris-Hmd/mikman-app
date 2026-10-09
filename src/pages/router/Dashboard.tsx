import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchRouterProfilesAPI,
  fetchSingleRouterStatusAPI,
  fetchRevenueStatsAPI,
  formatUptimeAPI,
  fetchRouterInterfacesAPI,
  fetchNetworkClientsAPI,
  fetchIpBindingsAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getTemperature, getRouterImage, cleanDisplayName } from '../../lib/helpers';
import { resolveClientPortAndAp, checkIsSignedUser } from '../../lib/clientPortDetection';
import LoadingScreen from '../../components/LoadingScreen';
import {
  Wifi,
  Activity,
  Cpu,
  Clock,
  Users,
  Thermometer,
  Ticket,
  Layers,
  FileText,
  Printer,
  Radio,
  Settings,
  AlertCircle,
  BarChart2,
  TrendingUp,
  Laptop,
  Network,
  Tag,
  ChevronRight,
  ChevronLeft,
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
  const { t, language, isRtl } = useLanguage();
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

  // Fetch router interfaces to get live ports and portApMap
  const { data: ifaceData, mutate: mutateIfaces } = useSWR(
    routerId && isConnected ? `router-interfaces-${routerId}` : null,
    () => fetchRouterInterfacesAPI(routerId!),
    { refreshInterval: 15000, dedupingInterval: 5000, revalidateOnFocus: true }
  );

  // Fetch active network clients to compute active users per port
  const { data: clientsData } = useSWR(
    routerId && isConnected ? `router-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { refreshInterval: 15000, dedupingInterval: 5000, revalidateOnFocus: true }
  );

  const portApMap = useMemo(() => {
    let map: Record<string, string> = {};
    try {
      const cached = localStorage.getItem(`@router_port_map_${routerId}`);
      if (cached) map = { ...map, ...JSON.parse(cached) };
    } catch {}

    if (profileData?.portApMap && typeof profileData.portApMap === 'object') {
      map = { ...map, ...profileData.portApMap };
    }

    if (ifaceData?.portApMap && typeof ifaceData.portApMap === 'object') {
      map = { ...map, ...ifaceData.portApMap };
    }
    return map;
  }, [routerId, profileData, ifaceData]);

  const parsedClients = useMemo(() => {
    let list: any[] = [];
    if (Array.isArray(clientsData)) list = clientsData;
    else if (clientsData && typeof clientsData === 'object') {
      if (Array.isArray((clientsData as any).clients)) list = (clientsData as any).clients;
      else if (Array.isArray((clientsData as any).data)) list = (clientsData as any).data;
    }
    return list;
  }, [clientsData]);

  // Fetch IP Bindings to match AP devices and bypassed comments
  const { data: bindingsData } = useSWR(
    routerId && isConnected ? `router-ip-bindings-${routerId}` : null,
    () => fetchIpBindingsAPI(routerId!),
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );

  const clientPortOverrides = useMemo<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem(`@router_client_ports_${routerId}`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  }, [routerId]);

  const bindingsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(bindingsData)) {
      bindingsData.forEach((b: any) => {
        const comment = (b.comment || '').toLowerCase().trim();
        const mac = (b.macAddress || b.mac || '').toLowerCase().replace(/[^a-f0-9]/g, '');
        const ip = (b.address || b.ip || '').trim();

        let matchedPort = '';
        for (const [k, v] of Object.entries(portApMap)) {
          if (k !== 'bridge' && k !== 'all') {
            const cleanK = k.toLowerCase().trim();
            const cleanV = (v || '').toLowerCase().trim();
            if ((cleanV && comment.includes(cleanV)) || (cleanK && comment.includes(cleanK))) {
              matchedPort = k;
              break;
            }
          }
        }

        if (matchedPort) {
          if (mac) map.set(mac, matchedPort);
          if (ip) map.set(ip, matchedPort);
        }
      });
    }
    return map;
  }, [bindingsData, portApMap]);

  const portUserCounts = useMemo(() => {
    const userMap: Record<string, { signedUsers: number; totalDevices: number }> = {};
    parsedClients.forEach((c) => {
      const res = resolveClientPortAndAp(c, portApMap, clientPortOverrides, bindingsMap);
      const port = res.port;
      if (port) {
        if (!userMap[port]) {
          userMap[port] = { signedUsers: 0, totalDevices: 0 };
        }
        userMap[port].totalDevices += 1;
        if (checkIsSignedUser(c)) {
          userMap[port].signedUsers += 1;
        }
      }
    });
    return userMap;
  }, [parsedClients, portApMap, clientPortOverrides, bindingsMap]);

  const portList = useMemo(() => {
    const ifaces = ifaceData?.interfaces || [];
    const seenPorts = new Set<string>();

    const result: Array<{
      name: string;
      type: string;
      running: boolean;
      disabled: boolean;
      apName: string;
      signedUsers: number;
      totalDevices: number;
      isWireless: boolean;
    }> = [];

    ifaces.forEach((iface) => {
      const name = iface.name.trim();
      seenPorts.add(name);
      const isWireless = iface.type === 'wlan' || name.startsWith('wlan') || name.startsWith('wifi');
      const isEther = iface.type === 'ether' || name.startsWith('ether') || name.startsWith('sfp');
      const counts = portUserCounts[name] || { signedUsers: 0, totalDevices: 0 };
      const isUp = !!iface.running || counts.totalDevices > 0;

      // Only show running / active UP ports in the dashboard (hide down / disconnected ports)
      if (isUp && (isEther || isWireless || counts.totalDevices > 0)) {
        const ap = iface.apName || portApMap[name] || '';
        result.push({
          name,
          type: iface.type,
          running: !!iface.running,
          disabled: !!iface.disabled,
          apName: ap,
          signedUsers: counts.signedUsers,
          totalDevices: counts.totalDevices,
          isWireless,
        });
      }
    });

    Object.entries(portUserCounts).forEach(([pName, counts]) => {
      if (!seenPorts.has(pName) && counts.totalDevices > 0) {
        const isWireless = pName.startsWith('wlan') || pName.startsWith('wifi');
        result.push({
          name: pName,
          type: isWireless ? 'wlan' : 'ether',
          running: true,
          disabled: false,
          apName: portApMap[pName] || '',
          signedUsers: counts.signedUsers,
          totalDevices: counts.totalDevices,
          isWireless,
        });
      }
    });

    return result.sort((a, b) => {
      const isEthA = a.name.startsWith('ether');
      const isEthB = b.name.startsWith('ether');
      const isWlanA = a.isWireless;
      const isWlanB = b.isWireless;

      if (isEthA && !isEthB) return -1;
      if (!isEthA && isEthB) return 1;
      if (isWlanA && !isWlanB) return -1;
      if (!isWlanA && isWlanB) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [ifaceData, portApMap, portUserCounts]);

  const activePortsCount = useMemo(() => {
    return portList.length;
  }, [portList]);

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
              background: 'rgba(24, 24, 27, 0.95)',
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
          <StatRow icon={Users} label={t('dashboard.activeSessions') || 'Users'} value={isConnected && status?.activeUsers != null ? status.activeUsers : '—'} accentColor="#3b82f6" />
          <StatRow
            icon={Wifi}
            label={t('header.ssid') || 'SSID'}
            title={status?.wifiName}
            value={isConnected && status?.wifiName ? status.wifiName : '—'}
            accentColor="#ec4899"
          />
        </div>
      </div>

      {/* Quick actions (Placed directly above Ports Stats) */}
      <div>
        <StatLabel icon={Ticket} title={t('dashboard.quickActions') || 'Quick Actions'} />
        <div className="quick-actions-grid">
          {([
            { Icon: Ticket, tk: 'vouchers', slug: 'vouchers' },
            { Icon: Layers, tk: 'profiles', slug: 'profiles' },
            { Icon: Printer, tk: 'batchPrint', slug: 'batch' },
            { Icon: TrendingUp, tk: 'revenue', slug: 'revenue' },
            { Icon: Laptop, tk: 'devices', slug: 'aps' },
            { Icon: Settings, tk: 'settings', slug: 'settings' }
          ] as const).map(({ Icon, tk, slug }) => (
            <Link key={slug} to={`/${routerId}/${slug}`} className="responsive-card hover-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 6px', textDecoration: 'none', color: 'var(--foreground)' }}>
              <Icon size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, textAlign: 'center' }}>{t(`sidebar.${tk}`) || tk}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Compact Ports & APs Statistics ─── */}
      {isConnected && portList.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Network size={13} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('dashboard.portsStatus') || 'Ports & APs Statistics'}
              </span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1px 6px', borderRadius: '6px' }}>
                {activePortsCount}/{portList.length} {t('dashboard.portUp') || 'Active'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link
                to={`/${routerId}/settings#ports`}
                title={t('dashboard.managePorts') || 'Edit Port AP Names'}
                className="hover-card"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Tag size={11} />
                <span>{t('dashboard.managePorts') || 'Port Names'}</span>
              </Link>

              <Link
                to={`/${routerId}/users`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  textDecoration: 'none',
                }}
              >
                <span>{t('sidebar.users') || 'All Users'}</span>
                {isRtl ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
              </Link>
            </div>
          </div>

          {/* Compact Port Badges Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '6px',
            }}
          >
            {portList.map((p) => {
              const hasUsers = p.signedUsers > 0;
              const isUp = p.running;

              return (
                <Link
                  key={p.name}
                  to={`/${routerId}/users?port=${p.name}`}
                  className="responsive-card hover-card"
                  style={{
                    padding: '7px 9px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    textDecoration: 'none',
                    border: hasUsers ? '1px solid rgba(59, 130, 246, 0.35)' : isUp ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--glass-border)',
                    background: hasUsers ? 'rgba(59, 130, 246, 0.06)' : isUp ? 'var(--card-bg)' : 'rgba(0, 0, 0, 0.15)',
                    borderRadius: '9px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Row 1: Port Name, Port Icon & Running Status Dot */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: isUp ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isUp ? '#22c55e' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {p.isWireless ? <Wifi size={10} /> : <Network size={10} />}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--foreground)',
                          fontFamily: "'JetBrains Mono', monospace",
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </span>
                    </div>

                    {/* Status Pill: Up / Down */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: isUp ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.1)',
                        color: isUp ? '#22c55e' : '#94a3b8',
                        border: isUp ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(148, 163, 184, 0.15)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          width: '4.5px',
                          height: '4.5px',
                          borderRadius: '50%',
                          backgroundColor: isUp ? '#22c55e' : '#94a3b8',
                        }}
                      />
                      <span>{isUp ? (t('dashboard.portUp') || 'Up') : (t('dashboard.portDown') || 'Down')}</span>
                    </div>
                  </div>

                  {/* Row 2: AP Name if configured */}
                  {p.apName ? (
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--primary, #3b82f6)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tag size={9} style={{ flexShrink: 0, opacity: 0.8 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.apName}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', opacity: 0.5, fontStyle: 'italic' }}>
                      —
                    </div>
                  )}

                  {/* Row 3: User count strip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '2px',
                      paddingTop: '3px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        color: hasUsers ? 'var(--primary, #3b82f6)' : 'var(--text-muted)',
                        fontSize: '10.5px',
                        fontWeight: hasUsers ? 800 : 600,
                      }}
                    >
                      <Users size={11} color={hasUsers ? 'var(--primary, #3b82f6)' : 'var(--text-muted)'} />
                      <span>{p.signedUsers} {t('sidebar.users') || 'users'}</span>
                    </div>

                    {p.totalDevices > p.signedUsers && (
                      <span
                        style={{
                          fontSize: '9px',
                          color: 'var(--text-muted)',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          padding: '1px 4px',
                          borderRadius: '3px',
                        }}
                        title={`Total connected devices: ${p.totalDevices}`}
                      >
                        +{p.totalDevices - p.signedUsers}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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