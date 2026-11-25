import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchRouterProfilesWithUserAPI,
  fetchAllRoutersStatusAPI,
  formatUptimeAPI,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import { getRouterImage, getQuotaName } from '../lib/helpers';
import './Landing.css';

import {
  Server,
  Plus,
  Users,
  Activity,
  Cpu,
  Clock,
  RefreshCw,
  User as UserIcon,
  Thermometer,
  Settings,
  KeyRound,
  ArrowUpDown,
} from 'lucide-react';

type RouterFilterMode = 'online-first' | 'default' | 'online-only';

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { showAlert } = useModal();
  const { t, language, isRtl } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<RouterFilterMode>('online-first');

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

  // Sort & filter routers based on selected filterMode
  const sortedRouters = React.useMemo(() => {
    const mapped = [...savedRouters].map((router, index) => {
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
    });

    const filtered = filterMode === 'online-only' ? mapped.filter(r => r._isOnline) : mapped;

    return filtered.sort((a, b) => {
      if (filterMode === 'online-first' && a._isOnline !== b._isOnline) {
        return a._isOnline ? -1 : 1;
      }
      return a._parsedTime - b._parsedTime;
    });
  }, [savedRouters, statusMap, filterMode]);

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
  const days = userData?.remainingDays ?? null;
  const planName = userData ? getQuotaName(t, userData.quota as string, userData.maxRouters as number) : null;

  const userName = userData?.name || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : '');

  return (
    <div className={`landing-container ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Header Section */}
      <div className="landing-header">
        <div>
          <h2 className="page-title m-0">{t('dashboard.dashboardTitle')}</h2>
        </div>
        <div className="landing-header-actions">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="landing-refresh-btn"
            title={t('dashboard.refreshGateways')}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinner' : ''} />
          </button>
          <Link
            to="/register-router"
            className="landing-add-btn"
          >
            <Plus size={15} /> <span>{t('dashboard.addRouterLong')}</span>
          </Link>
        </div>
      </div>

      {/* Sleek Account Status Bar */}
      <div className="account-status-bar responsive-card">
        {/* Row 1 / Left Group: User Identity & Mobile Settings Link */}
        <div className="account-status-group">
          <div className="flex items-center gap-2 min-w-0">
            <div className="account-status-avatar">
              {currentUser?.user_metadata?.avatar_url ? (
                <img src={currentUser.user_metadata.avatar_url} alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={13} />
              )}
            </div>

            <span className="account-status-name">
              {userName || <span className="skeleton-box skeleton-name" />}
            </span>
          </div>

          <Link
            to="/account"
            className="account-status-settings-btn show-sm-only"
            title={t('sidebar.accountDetails') || 'Account Settings'}
          >
            <Settings size={13} />
          </Link>
        </div>

        {/* Row 2 / Right Group: Plan Info & Router Capacity */}
        <div className="account-status-group flex items-center gap-3">
          {userData && (
            <div className="account-status-plan-info">
              <span className="font-bold text-foreground">{planName}</span>
              {userData?.expiresAt && days !== null && (
                <span>• {days > 0 ? `${days} ${language === 'ar' ? 'يوم' : 'd'}` : (t('dashboard.expired') || 'Expired')}</span>
              )}
            </div>
          )}

          <div className="account-status-quota" title="Registered Routers Quota">
            <Server size={13} color="var(--primary)" />
            <span>{totalRouters}/{maxRouters}</span>
          </div>

          <Link
            to="/account"
            className="account-status-settings-btn hide-sm-only"
            title={t('sidebar.accountDetails') || 'Account Settings'}
          >
            <Settings size={13} />
          </Link>
        </div>
      </div>

      {/* Password Prompt Banner if user doesn't have a password set */}
      {userData && userData.hasPassword === false && (
        <div className="landing-prompt-banner">
          <div className="landing-prompt-left">
            <div className="landing-prompt-icon">
              <KeyRound size={18} />
            </div>
            <div>
              <h4 className="landing-prompt-title">
                {t('accountPage.noPasswordPromptTitle') || 'Add Password for Email Login'}
              </h4>
              <p className="landing-prompt-desc">
                {t('accountPage.noPasswordPromptDesc') || "You haven't set a password for email login yet. Set a password to log in directly using your email and password."}
              </p>
            </div>
          </div>
          <Link
            to="/account"
            className="landing-prompt-btn"
          >
            <KeyRound size={14} />
            <span>{t('accountPage.setPasswordBtn') || 'Set Password'}</span>
          </Link>
        </div>
      )}

      {/* Routers Grid Header */}
      {(savedRouters.length > 0 || isInitialLoading) && (
        <div className="landing-routers-bar">
          <h3 className="text-sm font-bold m-0 text-foreground">
            {t('dashboard.registeredRouters')}
          </h3>

          {savedRouters.length > 0 && (
            <div className="landing-filter-wrap">
              <ArrowUpDown size={14} className="landing-filter-icon" />
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as RouterFilterMode)}
                className="landing-filter-select"
                aria-label={language === 'ar' ? 'ترتيب وتصفية الراوترات' : 'Sort and filter routers'}
              >
                <option value="online-first">
                  {language === 'ar' ? 'المتصل أولاً' : 'Online First'}
                </option>
                <option value="default">
                  {language === 'ar' ? 'حسب الإضافة' : 'Default Order'}
                </option>
                <option value="online-only">
                  {language === 'ar' ? 'المتصل فقط' : 'Online Only'}
                </option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Router Cards Grid */}
      <div className="landing-router-grid">
        {isInitialLoading ? (
          [1, 2].map(n => (
            <div key={n} className="landing-router-card pointer-events-none">
              <div className="landing-router-header">
                <div className="landing-router-brand">
                  <div className="landing-router-img-wrapper">
                    <div className="skeleton-box skeleton-avatar" />
                  </div>
                  <div className="skeleton-box skeleton-text-55" />
                </div>
                <div className="skeleton-box skeleton-stat-sm" />
                <div className="skeleton-box skeleton-stat-sm" />
              </div>
              <div className="landing-stats-resources">
                <div className="skeleton-box skeleton-stat-sm" />
                <div className="skeleton-box skeleton-stat-sm" />
                <div className="skeleton-box skeleton-stat-sm" />
              </div>
            </div>
          ))
        ) : savedRouters.length === 0 ? (
          <div className="landing-empty-fleet">
            <Server size={24} color="var(--primary)" className="mb-2 opacity-80" />
            <p className="text-sm font-bold mb-1 text-foreground">{t('dashboard.noRoutersTitle')}</p>
            <p className="text-xs mb-3 text-muted">{t('dashboard.noRoutersDesc')}</p>
            <Link
              to="/register-router"
              className="btn-solid-blue px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> <span>{t('dashboard.addRouterLong')}</span>
            </Link>
          </div>
        ) : sortedRouters.length === 0 ? (
          <div className="landing-empty-fleet">
            <Server size={24} color="var(--primary)" className="mb-2 opacity-80" />
            <p className="text-sm font-bold mb-1 text-foreground">
              {language === 'ar' ? 'لا توجد راوترات متصلة حالياً' : 'No Online Routers'}
            </p>
            <button
              type="button"
              onClick={() => setFilterMode('online-first')}
              className="btn-solid-blue px-3 py-1.5 text-xs rounded-lg inline-flex items-center gap-1.5"
            >
              <span>{language === 'ar' ? 'عرض جميع الراوترات' : 'Show All Routers'}</span>
            </button>
          </div>
        ) : (
          sortedRouters.map(router => {
            const status = (router as any)._status;
            const isOnline = (router as any)._isOnline;
            const routerImg = (router as any)._routerImg;

            const activeUsersDisplay = isOnline && status ? (status.activeUsers ?? 0) : '—';
            const uptimeDisplay = isOnline && status ? formatUptimeAPI(status.uptime || status.uptime_display) : '—';

            const rawCpu = isOnline && status ? (typeof status.cpuLoad === 'number' ? status.cpuLoad : parseFloat(status.cpuLoad)) : NaN;
            const cpuPct = !Number.isNaN(rawCpu) ? Math.min(100, Math.max(0, Math.round(rawCpu))) : 0;
            const cpuDisplay = isOnline && status ? (status.cpuLoad_display || (status.cpuLoad !== undefined ? `${status.cpuLoad}%` : '—')) : '—';
            const cpuTone = !isOnline || Number.isNaN(rawCpu) ? '' : cpuPct >= 90 ? 'crit' : cpuPct >= 70 ? 'warn' : '';

            const ramPct =
              isOnline && status && typeof status.totalMemory === 'number' && status.totalMemory > 0 && typeof status.freeMemory === 'number'
                ? Math.min(100, Math.max(0, Math.round(((status.totalMemory - status.freeMemory) / status.totalMemory) * 100)))
                : null;
            const ramDisplay = ramPct !== null ? `${ramPct}%` : '—';
            const ramTone = ramPct === null ? '' : ramPct >= 90 ? 'crit' : ramPct >= 75 ? 'warn' : '';

            const rawTemp = isOnline && status && status.temperature != null ? Number(status.temperature) : NaN;
            const tempPct = !Number.isNaN(rawTemp) ? Math.min(100, Math.max(0, Math.round(rawTemp))) : 0;
            const tempDisplay = isOnline && status ? (status.temperature_display || (status.temperature != null ? `${status.temperature}°C` : '—')) : '—';
            const tempTone = !isOnline || Number.isNaN(rawTemp) ? '' : rawTemp >= 80 ? 'crit' : rawTemp >= 65 ? 'warn' : '';

            return (
              <Link
                key={router.id}
                to={`/${router.id}`}
                className={`landing-router-card ${isOnline ? 'online' : 'offline'}`}
              >
                {/* Row 1: Router Image + Name | Users | Uptime (3-column grid aligned with Row 2) */}
                <div className="landing-router-header">
                  <div className="landing-router-brand">
                    <div className="landing-router-img-wrapper">
                      {routerImg ? (
                        <img
                          src={routerImg}
                          className="landing-router-img"
                          alt="Router"
                        />
                      ) : (
                        <div className="landing-router-fallback-icon">
                          <Cpu size={18} color="var(--primary)" />
                        </div>
                      )}
                      <div
                        className={`landing-router-status-dot ${isOnline ? 'online' : 'offline'}`}
                      />
                    </div>

                    <div className="landing-router-identity">
                      <h3 className="landing-router-name">
                        {router.name || 'MikroTik Router'}
                      </h3>
                    </div>
                  </div>

                  <div className="landing-stat-mini">
                    <div className="landing-stat-mini-top">
                      <span className="landing-stat-mini-label">
                        <Users size={13} />
                        <span>{language === 'ar' ? 'المتصلون' : 'Users'}</span>
                      </span>
                      <span className="landing-stat-mini-value">{activeUsersDisplay}</span>
                    </div>
                  </div>

                  <div className="landing-stat-mini">
                    <div className="landing-stat-mini-top">
                      <span className="landing-stat-mini-label">
                        <Clock size={13} />
                        <span>{t('header.uptime') || 'Uptime'}</span>
                      </span>
                      <span className="landing-stat-mini-value">{uptimeDisplay}</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: CPU, RAM, Temperature */}
                <div className="landing-stats-resources">
                  <div className="landing-stat-mini">
                    <div className="landing-stat-mini-top">
                      <span className="landing-stat-mini-label">
                        <Activity size={13} />
                        <span>{t('header.cpu') || 'CPU'}</span>
                      </span>
                      <span className={`landing-stat-mini-value ${cpuTone}`}>{cpuDisplay}</span>
                    </div>
                    <progress
                      className={`landing-stat-progress ${cpuTone}`}
                      value={isOnline && !Number.isNaN(rawCpu) ? cpuPct : 0}
                      max={100}
                    />
                  </div>

                  <div className="landing-stat-mini">
                    <div className="landing-stat-mini-top">
                      <span className="landing-stat-mini-label">
                        <Cpu size={13} />
                        <span>{t('header.ram') || 'RAM'}</span>
                      </span>
                      <span className={`landing-stat-mini-value ${ramTone}`}>{ramDisplay}</span>
                    </div>
                    <progress
                      className={`landing-stat-progress ${ramTone}`}
                      value={ramPct !== null ? ramPct : 0}
                      max={100}
                    />
                  </div>

                  <div className="landing-stat-mini">
                    <div className="landing-stat-mini-top">
                      <span className="landing-stat-mini-label">
                        <Thermometer size={13} />
                        <span>{t('header.temp') || 'Temp'}</span>
                      </span>
                      <span className={`landing-stat-mini-value ${tempTone}`}>{tempDisplay}</span>
                    </div>
                    <progress
                      className={`landing-stat-progress ${tempTone}`}
                      value={isOnline && !Number.isNaN(rawTemp) ? tempPct : 0}
                      max={100}
                    />
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
