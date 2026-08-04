import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesWithUserAPI, fetchAllRoutersStatusAPI, formatUptimeAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import { getRemainingDays, getTemperature, getRouterImage, skeletonStyle, getQuotaName } from '../lib/helpers';
import { Server, Plus, Users, Activity, Cpu, Clock, RefreshCw, User as UserIcon, Thermometer, ChevronRight, Settings, Crown, KeyRound } from 'lucide-react';

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { showAlert } = useModal();
  const { t, language } = useLanguage();
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
  const isInitialLoading = !routerData;

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

      {/* Sleek Account Status Bar */}
      <div className="account-status-bar responsive-card">
        {/* Row 1 / Left Group: User Identity & Mobile Settings Link */}
        <div className="account-status-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'rgba(var(--primary-rgb), 0.12)',
              border: '1px solid rgba(var(--primary-rgb), 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              {currentUser?.user_metadata?.avatar_url ? (
                <img src={currentUser.user_metadata.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={13} />
              )}
            </div>

            <span style={{ fontSize: '13px', fontWeight: '750', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
              {currentUser?.email?.split('@')[0] || currentUser?.email || <span style={skeletonStyle('80px')} />}
            </span>
          </div>

          <Link
            to="/account"
            className="show-sm-only"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-muted)',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            title={t('sidebar.accountDetails') || 'Account Settings'}
          >
            <Settings size={13} />
          </Link>
        </div>

        {/* Row 2 / Right Group: Plan Info & Router Capacity */}
        <div className="account-status-group account-status-group-bottom">
          {userData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                color: 'var(--primary)',
                fontWeight: '700',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(var(--primary-rgb), 0.2)',
                whiteSpace: 'nowrap'
              }}>
                <Crown size={11} />
                {planName}
              </span>

              {userData?.expiresAt && (
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '600',
                  color: days !== null && days <= 3 ? 'var(--danger)' : 'var(--text-muted)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '2px 6px',
                  borderRadius: '5px',
                  whiteSpace: 'nowrap'
                }}>
                  {days !== null && days > 0 ? `${days}${language === 'ar' ? 'يوم' : 'd'}` : (t('dashboard.expired') || 'Expired')}
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--foreground)', fontWeight: '700', fontSize: '11.5px', whiteSpace: 'nowrap' }} title="Registered Routers Quota">
              <Server size={13} color="var(--primary)" />
              <span>{totalRouters}/{maxRouters}</span>
            </div>

            <Link
              to="/account"
              className="hide-sm-only"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-muted)',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              title={t('sidebar.accountDetails') || 'Account Settings'}
            >
              <Settings size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Password Prompt Banner if user doesn't have a password set */}
      {userData && userData.hasPassword === false && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 280px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: 'var(--foreground)' }}>
                {t('accountPage.noPasswordPromptTitle') || 'Add Password for Email Login'}
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {t('accountPage.noPasswordPromptDesc') || 'You haven\'t set a password for email login yet. Set a password to log in directly using your email and password.'}
              </p>
            </div>
          </div>
          <Link
            to="/account"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#f59e0b',
              color: '#000',
              fontWeight: '800',
              fontSize: '12px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            <KeyRound size={14} />
            <span>{t('accountPage.setPasswordBtn') || 'Set Password'}</span>
          </Link>
        </div>
      )}

      {/* Routers Grid Header */}
      {(savedRouters.length > 0 || isInitialLoading) && (
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h3 style={{ fontSize: '13.5px', fontWeight: '800', margin: 0, color: 'var(--foreground)' }}>
              {t('dashboard.registeredRouters')}
            </h3>
            {savedRouters.length > 0 && (
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--primary)', backgroundColor: 'rgba(var(--primary-rgb), 0.1)', padding: '1px 6px', borderRadius: '8px' }}>
                {savedRouters.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Router Cards Grid */}
      <div className="router-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {isInitialLoading ? (
          [1, 2].map(n => (
            <div
              key={n}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', ...skeletonStyle('32px') }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '14px', width: '55%', borderRadius: '4px', ...skeletonStyle('100%') }} />
                </div>
              </div>
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ height: '12px', width: '18%', borderRadius: '3px', ...skeletonStyle('100%') }} />
                <div style={{ height: '12px', width: '18%', borderRadius: '3px', ...skeletonStyle('100%') }} />
                <div style={{ height: '12px', width: '18%', borderRadius: '3px', ...skeletonStyle('100%') }} />
                <div style={{ height: '12px', width: '18%', borderRadius: '3px', ...skeletonStyle('100%') }} />
              </div>
            </div>
          ))
        ) : savedRouters.length === 0 ? (
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
                  gap: '8px',
                  opacity: isOnline ? 1 : 0.6,
                  filter: isOnline ? 'none' : 'grayscale(0.2)',
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
                    <span style={{ fontWeight: '700', fontSize: '10.5px' }}>{isOnline && status ? formatUptimeAPI(status.uptime || status.uptime_display) : '—'}</span>
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