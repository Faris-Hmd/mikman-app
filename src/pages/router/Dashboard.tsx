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
      {/* Page Header Card */}
      <div className="page-header-card dash-header">
        <div className="dash-header-left">
          <div className="dash-header-avatar-box">
            <img src={routerImg || ''} alt="" className="dash-header-avatar-img" />
          </div>
          <div className="dash-header-titles">
            <h2 className="page-header-title dash-header-title">{routerName}</h2>
            <p className="page-header-subtitle dash-header-subtitle">
              {profileData?.model ? profileData.model.toUpperCase() : (status?.timezone || (isConnected ? t('common.online') : t('common.offline')))}
            </p>
          </div>
        </div>

        {isConnected && routerTime && (
          <div className="dash-header-time-box">
            <div className="dash-header-time">{routerTime}</div>
            <div className="dash-header-date">{routerDate}</div>
          </div>
        )}
      </div>

      {/* System Health Section */}
      <SystemHealthGrid
        isConnected={isConnected}
        cpuDisp={cpuDisp}
        cpuLoad={status?.cpuLoad}
        memUsed={memUsed}
        memTotal={memTotal}
        memPct={memPct}
        tmpDisp={tmpDisp}
        upDisp={upDisp}
        activeUsers={status?.activeUsers}
        wifiName={status?.wifiName}
      />

      {/* Quick Actions Section */}
      <QuickActionsGrid routerId={routerId!} />
    </div>
  );
}
