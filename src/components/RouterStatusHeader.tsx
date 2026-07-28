import { useState, useRef, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetchSingleRouterStatusAPI, fetchRouterProfilesWithUserAPI, fetchAllRoutersStatusAPI, formatUptimeAPI } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { cleanDisplayName } from '../lib/helpers';
import { Router, Cpu, Clock, Users, Thermometer, ChevronDown, Check, LayoutGrid } from 'lucide-react';

export default function RouterStatusHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { t, isRtl } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract routerId from route params or pathname
  const match = location.pathname.match(/^\/([^\/]+)/);
  const pathRouterId = match ? match[1] : null;
  const isExcluded = !pathRouterId || ['account', 'register-router', 'auth', ''].includes(pathRouterId);
  const routerId = !isExcluded ? (params.routerId || pathRouterId) : null;

  // Status for active router
  const { data: status, isLoading: isStatusLoading } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 15000, dedupingInterval: 5000 }
  );

  // Router profiles list
  const { data: profilesResponse } = useSWR(
    'all-router-profiles',
    fetchRouterProfilesWithUserAPI,
    { dedupingInterval: 10000 }
  );

  // All routers status map when dropdown is open
  const { data: allStatuses } = useSWR(
    isOpen ? 'all-routers-status' : null,
    fetchAllRoutersStatusAPI,
    { refreshInterval: 15000, dedupingInterval: 5000 }
  );

  const rawProfiles = profilesResponse?.profiles || [];
  const profiles = [...rawProfiles]
    .map((router: any, index: number) => {
      const rawTime = router.created_at || router.createdAt || router.created_time;
      const parsedTime = rawTime ? new Date(rawTime).getTime() : index;
      return {
        ...router,
        _parsedTime: Number.isNaN(parsedTime) ? index : parsedTime,
      };
    })
    .sort((a: any, b: any) => a._parsedTime - b._parsedTime);

  const statusMap = (allStatuses || []).reduce((acc: Record<string, any>, item: any) => {
    if (item.id) acc[item.id] = item;
    return acc;
  }, {});

  const currentProfile = profiles.find((p: any) => p.id === routerId);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!routerId) return null;

  const isOnline = !!(status?.online || status?.status === 'online');
  const rawDisplayName = currentProfile?.name || (status as any)?.name || currentProfile?.wifiName || status?.wifiName;
  const routerDisplayName = cleanDisplayName(rawDisplayName, routerId && !routerId.startsWith('cloud_') ? routerId : 'MikroTik');

  // Handle switching to target router while preserving current sub-route
  const handleSwitchRouter = (targetRouterId: string) => {
    setIsOpen(false);
    if (targetRouterId === routerId) return;

    // Extract subpath after /:routerId (e.g. /revenue, /vouchers, etc.)
    const currentSubPath = location.pathname.replace(`/${routerId}`, '');
    navigate(`/${targetRouterId}${currentSubPath}`);
  };

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        overflowX: 'visible',
        gap: '8px',
        fontSize: '11px',
        fontWeight: 600,
        boxSizing: 'border-box',
        direction: isRtl ? 'rtl' : 'ltr',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Left: Router Switcher Dropdown & Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isOpen ? 'rgba(var(--primary-rgb), 0.16)' : 'rgba(var(--primary-rgb), 0.08)',
              border: isOpen ? '1px solid rgba(var(--primary-rgb), 0.35)' : '1px solid transparent',
              padding: '4px 10px',
              borderRadius: '8px',
              color: 'var(--foreground)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              fontSize: '11px',
              userSelect: 'none',
            }}
            title={t('sidebar.switchRouter') || 'Switch Router'}
          >
            <Router size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              {routerDisplayName}
            </span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isStatusLoading ? '#9ca3af' : isOnline ? '#22c55e' : '#ef4444',
                boxShadow: isOnline ? '0 0 6px #22c55e' : 'none',
                flexShrink: 0,
              }}
              title={isStatusLoading ? 'Connecting...' : isOnline ? 'Online' : 'Offline'}
            />
            <ChevronDown
              size={12}
              style={{
                color: 'var(--text-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
                marginLeft: isRtl ? 0 : '2px',
                marginRight: isRtl ? '2px' : 0,
              }}
            />
          </button>

          {/* Dropdown Menu Overlay */}
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                [isRtl ? 'right' : 'left']: 0,
                minWidth: '230px',
                maxWidth: '290px',
                background: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                padding: '6px',
                zIndex: 1000,
                backdropFilter: 'blur(16px)',
              }}
            >
              <div
                style={{
                  padding: '6px 8px 4px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{t('sidebar.switchRouter') || 'Switch Router'}</span>
                {profiles.length > 0 && (
                  <span style={{ fontSize: '9px', opacity: 0.8 }}>
                    {profiles.length} {profiles.length === 1 ? 'router' : 'routers'}
                  </span>
                )}
              </div>

              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {profiles.length > 0 ? (
                  profiles.map((p: any) => {
                    const isActive = p.id === routerId;
                    const pStatus = p.id === routerId ? status : statusMap[p.id];
                    const pOnline = p.id === routerId ? isOnline : !!(pStatus?.online || pStatus?.status === 'online');
                    const displayName = cleanDisplayName(p.name || p.wifiName, p.id);

                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSwitchRouter(p.id)}
                        type="button"
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: isActive ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                          border: isActive ? '1px solid rgba(var(--primary-rgb), 0.3)' : '1px solid transparent',
                          color: isActive ? 'var(--primary)' : 'var(--foreground)',
                          fontSize: '11px',
                          fontWeight: isActive ? 700 : 600,
                          cursor: 'pointer',
                          textAlign: isRtl ? 'right' : 'left',
                          transition: 'all 0.15s ease',
                          boxSizing: 'border-box',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: pOnline ? '#22c55e' : '#ef4444',
                              boxShadow: pOnline ? '0 0 6px #22c55e' : 'none',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}
                          </span>
                        </div>

                        {isActive && <Check size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                      </button>
                    );
                  })
                ) : (
                  <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('common.loading') || 'Loading...'}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '4px', paddingTop: '4px' }}>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/');
                  }}
                  type="button"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <LayoutGrid size={12} />
                  <span>{t('header.routerSelection') || 'All Routers'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Pill (Hidden on mobile) */}
        <div
          className="hide-sm"
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

