import { useLocation, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchSingleRouterStatusAPI, fetchRouterProfilesWithUserAPI, formatUptimeAPI } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { Router, Cpu, Clock, Users, Thermometer } from 'lucide-react';

export default function RouterStatusHeader() {
  const location = useLocation();
  const params = useParams();
  const { t, isRtl } = useLanguage();

  // Extract routerId from route params or pathname
  const match = location.pathname.match(/^\/([^\/]+)/);
  const pathRouterId = match ? match[1] : null;
  const isExcluded = !pathRouterId || ['account', 'register-router', 'auth', ''].includes(pathRouterId);
  const routerId = !isExcluded ? (params.routerId || pathRouterId) : null;

  const { data: status, isLoading: isStatusLoading } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 15000, dedupingInterval: 5000 }
  );

  const { data: profile } = useSWR(
    routerId ? `router-profile-${routerId}` : null,
    async () => {
      const res = await fetchRouterProfilesWithUserAPI();
      return res.profiles?.find((p: any) => p.id === routerId) || null;
    },
    { dedupingInterval: 10000 }
  );

  if (!routerId) return null;

  const isOnline = !!(status?.online || status?.status === 'online');
  const routerDisplayName = profile?.name || (status as any)?.name || profile?.wifiName || status?.wifiName || routerId;

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '11px',
        fontWeight: 600,
        boxSizing: 'border-box',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Left: Router Identity & Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(var(--primary-rgb), 0.08)',
            padding: '3px 8px',
            borderRadius: '6px',
            color: 'var(--foreground)',
            fontWeight: 700,
          }}
        >
          <Router size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {routerDisplayName}
          </span>
        </div>

        {/* Status Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 700,
            background: isStatusLoading
              ? 'rgba(255, 255, 255, 0.05)'
              : isOnline
              ? 'rgba(34, 197, 94, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            color: isStatusLoading
              ? 'var(--text-muted)'
              : isOnline
              ? '#22c55e'
              : '#ef4444',
            border: `1px solid ${
              isStatusLoading
                ? 'var(--glass-border)'
                : isOnline
                ? 'rgba(34, 197, 94, 0.25)'
                : 'rgba(239, 68, 68, 0.25)'
            }`,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isStatusLoading ? '#9ca3af' : isOnline ? '#22c55e' : '#ef4444',
              boxShadow: isOnline ? '0 0 6px #22c55e' : 'none',
            }}
          />
          <span>
            {isStatusLoading
              ? t('header.connecting')
              : isOnline
              ? t('header.connected')
              : t('header.disconnected')}
          </span>
        </div>
      </div>

      {/* Right: Quick Telemetry Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {status?.activeUsers != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }} title={t('dashboard.activeSessions')}>
            <Users size={12} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{status.activeUsers}</span>
          </div>
        )}

        {status?.cpuLoad != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }} title={t('header.cpuLoad')}>
            <Cpu size={12} style={{ color: '#38bdf8' }} />
            <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{status.cpuLoad}%</span>
          </div>
        )}

        {status?.uptime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }} title={t('header.uptime')}>
            <Clock size={12} style={{ color: '#a855f7' }} />
            <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{formatUptimeAPI(status.uptime)}</span>
          </div>
        )}

        {status?.temperature != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }} title={t('header.temp')}>
            <Thermometer size={12} style={{ color: '#f59e0b' }} />
            <span style={{ color: 'var(--foreground)', fontWeight: 700 }}>{status.temperature}°C</span>
          </div>
        )}
      </div>
    </div>
  );
}
