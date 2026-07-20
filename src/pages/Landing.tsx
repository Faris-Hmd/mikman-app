import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRouterProfilesWithUserAPI, fetchAllRoutersStatusAPI, deleteRouterProfileAPI, formatUptimeAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import { useSpeedUnit } from '../lib/speedUnit';
import { RouterConfig } from '../store';
import { getRemainingDays, getTemperature, formatSpeedCompact, getRouterImage, getWinboxAddress, skeletonStyle, getQuotaName } from '../lib/helpers';
import { Server, Plus, Trash2, MoreVertical, Users, Activity, Cpu, Clock, RefreshCw, Settings, User as UserIcon, ExternalLink, Thermometer, Globe, SlidersHorizontal } from 'lucide-react';

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const { t, isRtl } = useLanguage();
  const [speedUnit] = useSpeedUnit();
  const [nowTime, setNowTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
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

  useEffect(() => { const timer = setTimeout(() => setNowTime(Date.now()), 0); return () => clearTimeout(timer); }, []);

  useEffect(() => {
    const handleGlobalClick = () => setActiveDropdownId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const sortedRouters = React.useMemo(() => {
    return [...savedRouters].sort((a, b) => {
      const statusA = routerStatuses.find(s => s.id === a.id);
      const statusB = routerStatuses.find(s => s.id === b.id);
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
  }, [savedRouters, routerStatuses, sortBy]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchRouterProfilesWithUserAPI();
      mutateRouters(fresh, false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(err);
      showAlert(t('dashboard.refreshFailed'), t('dashboard.refreshFailedMsg').replace('{error}', errMsg), 'error');
    } finally { setIsRefreshing(false); }
  };

  const handleDeleteRouter = (routerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    showConfirm(t('dashboard.deleteRouterTitle'), t('dashboard.deleteRouterConfirm'), async () => {
      try {
        setIsLoading(true);
        await deleteRouterProfileAPI(routerId);
        const fresh = await fetchRouterProfilesWithUserAPI();
        mutateRouters(fresh, false);
        showAlert(t('dashboard.deleted'), t('dashboard.deleteSuccess'), 'success');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        showAlert(t('dashboard.deleteFailed'), t('dashboard.deleteFailedMsg').replace('{error}', errMsg), 'error');
      } finally { setIsLoading(false); }
    });
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
          <button onClick={handleRefresh} disabled={isRefreshing || isLoading} className="gateway-refresh-btn" title={t('dashboard.refreshGateways')}>
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
          const routerStatus = routerStatuses.find(s => s.id === router.id);
          const isOnline = routerStatus?.status === 'online';
          const routerImg = getRouterImage(router);

          return (
            <Link
              key={router.id}
              to={`/${router.id}`}
              className="router-card"
              style={{ textDecoration: 'none', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s', zIndex: activeDropdownId === router.id ? 10 : 1, display: 'block', opacity: routerStatus ? (isOnline ? 1 : 0.55) : 0.8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '10px', minWidth: 0 }}>
                  <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                    {routerImg ? <img src={routerImg} style={{ width: '36px', height: '36px', objectFit: 'contain' }} alt="Router" />
                    : <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--input-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--glass-border)' }}><Cpu size={18} color="var(--text-muted)" /></div>}
                    {isOnline && routerStatus && <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', border: '1.5px solid var(--card-bg)', boxShadow: '0 0 4px #22c55e' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--foreground)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{router.name || 'MikroTik Router'}</h3>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={(e) => e.preventDefault()}>
                  <div style={{ position: 'relative' }}>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdownId(activeDropdownId === router.id ? null : (router.id || null)); }} style={{ padding: '4px', cursor: 'pointer', background: 'none', border: 'none' }}><MoreVertical size={16} color="var(--text-muted)" /></button>
                    {activeDropdownId === router.id && (
                      <div style={{ position: 'absolute', top: 0, right: isRtl ? 'auto' : '24px', left: isRtl ? '24px' : 'auto', backgroundColor: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)', width: '125px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
                        <a href={`winbox://${getWinboxAddress(router)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdownId(null); const ip = getWinboxAddress(router); if (ip && navigator.clipboard) { navigator.clipboard.writeText(ip); showAlert(t('dashboard.winboxCopiedTitle'), t('dashboard.winboxCopiedDesc', { ip }), 'success'); } }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--glass-border)', color: 'var(--foreground)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: 'none', textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
                          <ExternalLink size={13} /> <span>Winbox</span>
                        </a>
                        <Link to={`/${router.id}/settings`} onClick={() => setActiveDropdownId(null)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--glass-border)', color: 'var(--foreground)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: 'none', textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
                          <Settings size={13} /> <span>{t('sidebar.settings')}</span>
                        </Link>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdownId(null); handleDeleteRouter(router.id!, e); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', color: '#ef4444', fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', width: '100%', boxSizing: 'border-box' }}>
                          <Trash2 size={13} color="#ef4444" /> <span>{t('common.delete')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)', marginTop: '2px', opacity: isOnline ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && routerStatus ? (routerStatus.activeUsers || 0) : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && routerStatus ? (routerStatus.cpuLoad_display || (routerStatus.cpuLoad !== undefined ? `${routerStatus.cpuLoad}%` : '—')) : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Cpu size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && routerStatus && typeof routerStatus.totalMemory === 'number' ? `${Math.round((routerStatus.totalMemory - routerStatus.freeMemory) / (1024 * 1024))}M` : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Thermometer size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && routerStatus ? (routerStatus.temperature_display || `${getTemperature(routerStatus) ?? '—'}°C`) : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={10} color="var(--primary)" /><strong style={{ color: 'var(--foreground)', fontSize: '11px' }}>{isOnline && routerStatus ? `↓${formatSpeedCompact(routerStatus.wanRxSpeed, speedUnit)}` : '—'}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} color="var(--primary)" /><strong style={{ color: isOnline ? 'var(--foreground)' : 'var(--text-muted)', fontSize: '11px' }}>{isOnline && routerStatus ? (routerStatus.uptime_display || (routerStatus.uptime ? formatUptimeAPI(routerStatus.uptime) : '—')) : '—'}</strong></div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}