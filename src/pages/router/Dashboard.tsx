import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchRouterProfilesAPI,
  fetchSingleRouterStatusAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { getRouterImage, cleanDisplayName } from '../../lib/helpers';
import LoadingScreen from '../../components/ui/LoadingScreen';
import SystemHealthGrid from '../../components/dashboard/SystemHealthGrid';
import QuickActionsGrid from '../../components/dashboard/QuickActionsGrid';
import './Dashboard.css';

export default function RouterDashboardPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();

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

  const rawName = profileData?.name || (profileData as any)?.wifiName || status?.wifiName;
  const routerName = cleanDisplayName(rawName, routerId && !routerId.startsWith('cloud_') ? routerId : 'MikroTik');
  const routerImg = useMemo(() => (profileData ? getRouterImage(profileData as any) : null), [profileData]);
  const memUsed = useMemo(() => {
    if (!status || status.totalMemory == null || status.freeMemory == null) return null;
    return Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024));
  }, [status]);
  const memTotal = useMemo(() => (status?.totalMemory != null ? Math.round(Number(status.totalMemory) / (1024 * 1024)) : null), [status]);
  const memPct = useMemo(
    () => (status && status.totalMemory != null && status.freeMemory != null ? Math.round(((Number(status.totalMemory) - Number(status.freeMemory)) / Number(status.totalMemory)) * 100) : null),
    [status]
  );

  const cpuDisp = status?.cpuLoad_display || (status?.cpuLoad != null ? `${status.cpuLoad}%` : null);
  const tmpDisp = status?.temperature_display || (status?.temperature != null ? `${status.temperature}°C` : null);
  const upDisp = status?.uptime || status?.uptime_display || null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const routerTime = useMemo(() => {
    const tz = status?.timezone;
    if (!tz) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
    } catch {
      return null;
    }
  }, [now, status?.timezone]);

  const routerDate = useMemo(() => {
    const tz = status?.timezone;
    if (!tz) return null;
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(now);
    } catch {
      return null;
    }
  }, [now, status?.timezone]);

  if (isStatusLoading) {
    return <LoadingScreen compact loadingTitle={t('common.loading') || 'Loading router status...'} />;
  }

  return (
    <div className="responsive-container dash-container" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Hero Router Showcase */}
      <div className="responsive-card dash-hero-card">
        <div className="dash-hero-visual">
          {routerImg ? (
            <img src={routerImg} alt={routerName} className="dash-hero-img" />
          ) : (
            <div className="dash-hero-img-fallback" aria-hidden="true" />
          )}
        </div>

        <div className="dash-hero-content">
          <div className="dash-hero-top">
            <div className="dash-hero-identity">
              <div className="dash-hero-status-line">
                <span className={`dash-status-dot ${isConnected ? 'online' : 'offline'}`} aria-hidden="true" />
                <span className="dash-hero-status-text">
                  {isConnected ? (t('common.online') || 'Online') : (t('common.offline') || 'Offline')}
                </span>
                {profileData?.model && (
                  <>
                    <span className="dash-hero-sep" aria-hidden="true">·</span>
                    <span className="dash-hero-model">{profileData.model.toUpperCase()}</span>
                  </>
                )}
              </div>
              <h2 className="dash-hero-title">{routerName}</h2>
            </div>

            {isConnected && routerTime && (
              <div className="dash-hero-clock">
                <div className="dash-hero-time">{routerTime}</div>
                <div className="dash-hero-date">{routerDate}</div>
              </div>
            )}
          </div>

          <div className="dash-hero-meta-row">
            {isConnected && upDisp && (
              <div className="dash-hero-meta-item">
                <span className="dash-hero-meta-label">{t('header.uptime') || 'Uptime'}</span>
                <strong className="dash-hero-meta-val" dir="ltr">{upDisp}</strong>
              </div>
            )}
            {isConnected && status?.wifiName && (
              <div className="dash-hero-meta-item">
                <span className="dash-hero-meta-label">{t('header.ssid') || 'SSID'}</span>
                <strong className="dash-hero-meta-val" dir="ltr">{status.wifiName}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual System Health Gauges */}
      <SystemHealthGrid
        isConnected={isConnected}
        cpuDisp={cpuDisp}
        cpuLoad={status?.cpuLoad}
        memUsed={memUsed}
        memTotal={memTotal}
        memPct={memPct}
        tmpDisp={tmpDisp}
        temperature={status?.temperature}
        upDisp={upDisp}
        activeUsers={status?.activeUsers}
        wifiName={status?.wifiName}
      />

      {/* Quick Actions Section */}
      <QuickActionsGrid routerId={routerId!} />
    </div>
  );
}
