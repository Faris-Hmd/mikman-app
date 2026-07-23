import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesWithUserAPI, fetchAllRoutersStatusAPI, formatUptimeAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import { getRemainingDays, getTemperature, getRouterImage, skeletonStyle, getQuotaName } from '../lib/helpers';
import { Server, Plus, Users, Activity, Cpu, Clock, RefreshCw, User as UserIcon, Thermometer, ChevronRight, Settings } from 'lucide-react';

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { showAlert } = useModal();
  const { t } = useLanguage();
  const [nowTime, setNowTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: routerData, mutate: mutateRouters } = useSWR(
    'router-profiles',
    fetchRouterProfilesWithUserAPI,
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );
  const { data: routerStatusesData } = useSWR('router-statuses', fetchAllRoutersStatusAPI, { refreshInterval: 30000 });

  const savedRouters = routerData?.profiles || [];
  const userData = routerData?.userData ?? null;
  const routerStatuses = routerStatusesData || [];

  const statusMap = React.useMemo(() => {
    const map = new Map<string, typeof routerStatuses[number]>();
    for (const s of routerStatuses) {
      if (s.id) map.set(s.id, s);
    }
    return map;
  }, [routerStatuses]);

  useEffect(() => {
    const timer = setTimeout(() => setNowTime(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);

  // Sort by date added: First added router (oldest) on top
  const sortedRouters = React.useMemo(() => {
    return [...savedRouters]
      .map((router, index) => {
        const status = router.id ? statusMap.get(router.id) : undefined;
        const rawTime = (router as any).created_at || (router as any).createdAt || (router as any).created_time;
        const parsedTime = rawTime ? new Date(rawTime).getTime() : index;
        return {
          ...router,
          _status: status,
          _isOnline: status?.status === 'online',
          _routerImg: getRouterImage(router),
          _parsedTime: Number.isNaN(parsedTime) ? index : parsedTime,
        };
      })
      .sort((a, b) => a._parsedTime - b._parsedTime); // Oldest / First added router on top
  }, [savedRouters, statusMap]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutateRouters();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      showAlert(t('dashboard.refreshFailed'), t('dashboard.refreshFailedMsg').replace('{error}', errMsg), 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalRouters = savedRouters.length;
  const maxRouters = (userData?.maxRouters as number) || (userData?.quota === 'quota1' ? 10 : userData?.quota === 'quota2' ? 20 : 1);
  const onlineRouters = savedRouters.filter(r => routerStatuses.find(s => s.id === r.id)?.status === 'online').length;
  const usagePercent = userData ? Math.min(100, Math.round((totalRouters / maxRouters) * 100)) : 0;
  const days = userData ? getRemainingDays(userData.expiresAt, nowTime) : null;
  const planName = userData ? getQuotaName(t, userData.quota as string, userData.maxRouters as number) : null;

  return (
    <div className="app-container" style={{ padding: '16px 20px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Header Section */}
      <div className="gateway-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>{t('dashboard.dashboardTitle')}</h2>
        </div>
        <div className="gateway-actions-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gateway-refresh-btn"
            title={t('dashboard.refreshGateways')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <RefreshCw size={15} color="var(--primary)" className={isRefreshing ? "spinner" : ""} />
          </button>
          <Link
            to="/register-router"
            className="gateway-add-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer', textDecoration: 'none', transition: 'all 0.2s' }}
          >
            <Plus size={15} /> <span>{t('dashboard.addRouterLong')}</span>
          </Link>
        </div>
      </div>

      {/* Compact Glassmorphic Account & Quota Bar */}
      <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(8px)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            to="/account"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
            title={t('sidebar.accountDetails') || t('dashboard.myAccount') || 'Account Settings'}
          >
            <Settings size={15} />
          </Link>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
            {currentUser?.user_metadata?.avatar_url ? (
              <img src={currentUser.user_metadata.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={14} />
            )}
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--foreground)' }}>
            {currentUser?.email || <span style={skeletonStyle('110px')} />}
          </div>
          {userData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', fontWeight: '700', padding: '1px 6px', borderRadius: '4px' }}>
                {planName}
              </span>
              <span style={{ color: userData?.expiresAt ? (days !== null && days > 3 ? 'var(--text-muted)' : 'var(--danger)') : '#22c55e', fontWeight: '600' }}>
                {userData?.expiresAt ? (days !== null && days > 0 ? (t('dashboard.daysLeft') || '{days}d left').replace('{days}', String(days)) : (t('dashboard.expired') || 'Expired')) : (t('dashboard.lifetime') || 'Lifetime')}
              </span>
            </div>
          )}
        </div>

        {/* Quota Progress Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
            <Server size={13} color="var(--primary)" />
            <span style={{ fontWeight: '600' }}>
              {totalRouters} / {maxRouters} {t('dashboard.routers') || 'Routers'} ({(t('dashboard.routersOnlineCount') || '{count} online').replace('{count}', String(onlineRouters))})
            </span>
          </div>
          <div style={{ width: '60px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--secondary)', overflow: 'hidden' }}>
            <div style={{ width: `${usagePercent}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '2px' }} />
          </div>
        </div>
      </div>

      {/* Routers Grid Header */}
      {savedRouters.length > 0 && (
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h3 style={{ fontSize: '13.5px', fontWeight: '800', margin: 0, color: 'var(--foreground)' }}>
              {t('dashboard.registeredRouters')}
            </h3>
            <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--primary)', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', padding: '1px 6px', borderRadius: '8px' }}>
              {savedRouters.length}
            </span>
          </div>
        </div>
      )}

      {/* Router Cards Grid */}
      <div className="router-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {savedRouters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--card-bg)', border: '1px dashed var(--glass-border)', borderRadius: '12px', gridColumn: '1 / -1' }}>
            <Server size={24} color="var(--primary)" style={{ marginBottom: '8px', opacity: 0.8 }} />
            <p style={{ fontSize: '14px', fontWeight: '750', margin: '0 0 4px', color: 'var(--foreground)' }}>No routers registered</p>
            <p style={{ fontSize: '12px', margin: '0 0 12px', color: 'var(--text-muted)' }}>Add your MikroTik router to get started.</p>
            <Link
              to="/register-router"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'var(--primary)', color: '#fff', textDecoration: 'none', fontWeight: '700', fontSize: '12px' }}
            >
              <Plus size={14} /> <span>{t('dashboard.addRouterLong')}</span>
            </Link>
          </div>
        ) : (
          sortedRouters.map(router => {
            const status = (router as any)._status;
            const isOnline = (router as any)._isOnline;
            const routerImg = (router as any)._routerImg;

            return (
              <Link
                key={router.id}
                to={`/${router.id}`}
                className="router-card"
                style={{
                  textDecoration: 'none',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Router Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '10px', minWidth: 0 }}>
                    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      {routerImg ? (
                        <img src={routerImg} style={{ width: '32px', height: '32px', objectFit: 'contain' }} alt="Router" />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(var(--primary-rgb), 0.08)', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--glass-border)' }}>
                          <Cpu size={16} color="var(--primary)" />
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          top: '-1px',
                          right: '-1px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#22c55e' : '#94a3b8',
                          border: '1.5px solid var(--card-bg)'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {router.name || 'MikroTik Router'}
                      </h3>
                    </div>
                  </div>
                  <ChevronRight size={15} color="var(--text-muted)" />
                </div>

                {/* Compact Inline Telemetry Strip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)', fontSize: '11px', color: 'var(--foreground)', opacity: isOnline ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Active Hotspot Users">
                    <Users size={12} color="var(--primary)" />
                    <span style={{ fontWeight: '700' }}>{isOnline && status ? (status.activeUsers || 0) : '0'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="CPU Usage">
                    <Activity size={12} color="var(--primary)" />
                    <span style={{ fontWeight: '700' }}>{isOnline && status ? (status.cpuLoad_display || (status.cpuLoad !== undefined ? `${status.cpuLoad}%` : '—')) : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="RAM Usage">
                    <Cpu size={12} color="var(--primary)" />
                    <span style={{ fontWeight: '700' }}>{isOnline && status && typeof status.totalMemory === 'number' ? `${Math.round((status.totalMemory - status.freeMemory) / (1024 * 1024))}M` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Router Temperature">
                    <Thermometer size={12} color="var(--primary)" />
                    <span style={{ fontWeight: '700' }}>{isOnline && status ? (status.temperature_display || `${getTemperature(status) ?? '—'}°C`) : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="System Uptime">
                    <Clock size={12} color="var(--primary)" />
                    <span style={{ fontWeight: '700', fontSize: '10.5px' }}>{isOnline && status ? (status.uptime_display || (status.uptime ? formatUptimeAPI(status.uptime) : '—')) : '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}