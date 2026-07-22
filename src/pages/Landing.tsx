import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesWithUserAPI, fetchAllRoutersStatusAPI, formatUptimeAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import { useSpeedUnit } from '../lib/speedUnit';
import { getRemainingDays, getTemperature, formatSpeedCompact, getRouterImage, skeletonStyle, getQuotaName } from '../lib/helpers';
import { Server, Plus, Users, Activity, Cpu, Clock, RefreshCw, User as UserIcon, Thermometer, Globe, SlidersHorizontal } from 'lucide-react';

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { showAlert } = useModal();
  const { t } = useLanguage();
  const [speedUnit] = useSpeedUnit();
  const [nowTime, setNowTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'users'>('status');
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

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

  useEffect(() => { const timer = setTimeout(() => setNowTime(Date.now()), 0); return () => clearTimeout(timer); }, []);

  const sortedRouters = React.useMemo(() => {
    return [...savedRouters]
      .map(router => {
        const status = router.id ? statusMap.get(router.id) : undefined;
        return {
          ...router,
          _status: status,
          _isOnline: status?.status === 'online',
          _routerImg: getRouterImage(router),
        };
      })
      .sort((a, b) => {
        const statusA = a._status;
        const statusB = b._status;
        if (sortBy === 'status') {
          const isOnlineA = statusA?.status === 'online' ? 1 : 0;
          const isOnlineB = statusB?.status === 'online' ? 1 : 0;
          if (isOnlineA !== isOnlineB) return isOnlineB - isOnlineA;
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'users') {
          const usersA = (statusA?.status === 'online' && typeof statusA?.activeUsers === 'number') ? statusA.activeUsers : 0;
          const usersB = (statusB?.status === 'online' && typeof statusB?.activeUsers === 'number') ? statusB.activeUsers : 0;
          if (usersA !== usersB) return usersB - usersA;
          return (a.name || '').localeCompare(b.name || '');
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [savedRouters, statusMap, sortBy]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutateRouters();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      showAlert(t('dashboard.refreshFailed'), t('dashboard.refreshFailedMsg').replace('{error}', errMsg), 'error');
    } finally { setIsRefreshing(false); }
  };

  const totalRouters = savedRouters.length;
  const maxRouters = (userData?.maxRouters as number) || (userData?.quota === 'quota1' ? 10 : userData?.quota === 'quota2' ? 20 : 1);
  const onlineRouters = savedRouters.filter(r => routerStatuses.find(s => s.id === r.id)?.status === 'online').length;
  const offlineRouters = totalRouters - onlineRouters;
  const usagePercent = userData ? Math.min(100, Math.round((totalRouters / maxRouters) * 100)) : 0;
  const days = userData ? getRemainingDays(userData.expiresAt, nowTime) : null;
  const planName = userData ? getQuotaName(t, userData.quota as string, userData.maxRouters as number) : null;

  return (
    <div className="app-container" style={{ padding: '24px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div className="gateway-header-container">
        <div><h2 className="page-title">{t('dashboard.dashboardTitle')}</h2></div>
        <div className="gateway-actions-container">
          <button onClick={() => setIsOptionsModalOpen(true)} className="gateway-refresh-btn" title="Sort & Unit Settings"><SlidersHorizontal size={16} color="var(--primary)" /></button>
          <button onClick={handleRefresh} disabled={isRefreshing} className="gateway-refresh-btn" title={t('dashboard.refreshGateways')}>
            <RefreshCw size={16} className={isRefreshing ? "spinner" : ""} />
          </button>
          <Link to="/register-router" className="gateway-add-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'none' }}>
            <Plus size={16} /> <span>{t('dashboard.addRouterLong')}</span>
          </Link>
        </div>
      </div>

      <div className="gateway-info-panel" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(59, 116, 214, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', overflow: 'hidden', flexShrink: 0 }}>
              {currentUser?.user_metadata?.avatar_url ? <img src={currentUser.user_metadata.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : <UserIcon size={14} />}
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: '12px', fontWeight: '750', color: 'var(--foreground)' }}>{currentUser?.email || <span style={skeletonStyle('120px')} />}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                {userData ? <><span>{planName}</span><span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} /><span style={{ fontWeight: '600', color: userData?.expiresAt ? (days !== null && days > 3 ? 'var(--primary)' : 'var(--danger)') : '#22c55e' }}>
                  {userData?.expiresAt ? (days !== null && days > 0 ? t('dashboard.daysLeft').replace('{days}', String(days)) : t('dashboard.expired')) : t('dashboard.lifetime')}
                </span></> : <span style={skeletonStyle('80px')} />}
              </div>
            </div>
          </div>
          <Link to="/account" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', textDecoration: 'none', padding: '4px 8px', borderRadius: '5px', backgroundColor: 'rgba(59, 116, 214, 0.08)' }}>{t('dashboard.manage')}</Link>
        </div>
        <div style={{ borderTop: '1px solid rgba(59, 130, 246, 0.15)', margin: '4px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--foreground)' }}>
              <Server size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: '750' }}>{t('dashboard.routers')}:</span>
              {userData ? <span style={{ fontWeight: '500', color: 'var(--text-muted)' }}>{t('dashboard.routersActive').replace('{total}', String(totalRouters)).replace('{max}', String(maxRouters))}</span>
              : <span style={skeletonStyle('60px')} />}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '10.5px', fontWeight: '600' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#22c55e' }}><span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />{t('dashboard.routersOnlineCount').replace('{count}', String(onlineRouters))}</span>
              {offlineRouters > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }}><span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--text-muted)', display: 'inline-block' }} />{t('dashboard.routersOfflineCount').replace('{count}', String(offlineRouters))}</span>}
            </div>
          </div>
          <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: 'var(--secondary)', overflow: 'hidden' }}>
            <div style={{ width: `${usagePercent}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      {savedRouters.length > 0 && (
        <div style={{ marginTop: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '3.5px', height: '14px', backgroundColor: 'var(--primary)', borderRadius: '2px' }} />
          <h3 style={{ fontSize: '13.5px', fontWeight: '750', margin: 0, color: 'var(--foreground)' }}>{t('dashboard.registeredRouters')}</h3>
        </div>
      )}
      <div className="router-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {savedRouters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '16px', gridColumn: '1 / -1' }}>
            <Server size={16} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>No routers added yet</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Click the "Add Router" button to get started.</p>
          </div>
        ) : sortedRouters.map(router => {
          const status = (router as any)._status;
          const isOnline = (router as any)._isOnline;
          const routerImg = (router as any)._routerImg;

          return (
            <Link
              key={router.id}
              to={`/${router.id}`}
              className="router-card"
              style={{ textDecoration: 'none', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s', display: 'block', opacity: status ? (isOnline ? 1 : 0.55) : 0.8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '10px', minWidth: 0 }}>
                  <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                    {routerImg ? <img src={routerImg} style={{ width: '36px', height: '36px', objectFit: 'contain' }} alt="Router" />
                    : <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--input-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--glass-border)' }}><Cpu size={18} color="var(--text-muted)" /></div>}
                    {isOnline && status && <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', border: '1.5px solid var(--card-bg)', boxShadow: '0 0 4px #22c55e' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{router.name || 'MikroTik Router'}</h3>
                  </div>
                </div>
              </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr', gap: '4px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)', marginTop: '2px', opacity: isOnline ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && status ? (status.activeUsers || 0) : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && status ? (status.cpuLoad_display || (status.cpuLoad !== undefined ? `${status.cpuLoad}%` : '—')) : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Cpu size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && status && typeof status.totalMemory === 'number' ? `${Math.round((status.totalMemory - status.freeMemory) / (1024 * 1024))}M` : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Thermometer size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && status ? (status.temperature_display || `${getTemperature(status) ?? '—'}°C`) : '—'}</strong></div>
                {/* <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && status ? `↓${formatSpeedCompact(status.wanRxSpeed, speedUnit)}` : '—'}</strong></div> */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} color="var(--primary)" /><strong style={{ color: isOnline ? 'var(--foreground)' : 'var(--text-muted)', fontSize: '11px' }}>{isOnline && status ? (status.uptime_display || (status.uptime ? formatUptimeAPI(status.uptime) : '—')) : '—'}</strong></div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}