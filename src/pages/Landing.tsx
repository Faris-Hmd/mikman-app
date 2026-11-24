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
import { getRouterImage, getQuotaName, getRouterVpnIp } from '../lib/helpers';
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
  Copy,
  Check,
  Globe,
  MoreVertical,
  Terminal,
  ExternalLink,
} from 'lucide-react';

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { showAlert } = useModal();
  const { t, language, isRtl } = useLanguage();
  const [nowTime, setNowTime] = useState<number>(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedIpMap, setCopiedIpMap] = useState<Record<string, boolean>>({});
  const [copiedSshMap, setCopiedSshMap] = useState<Record<string, boolean>>({});
  const [openMenuRouterId, setOpenMenuRouterId] = useState<string | null>(null);

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
    setNowTime(Date.now());
  }, []);

  // Close router action dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuRouterId && !(e.target as HTMLElement).closest('.landing-router-menu-container')) {
        setOpenMenuRouterId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuRouterId]);

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
      .sort((a, b) => a._parsedTime - b._parsedTime);
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

  const handleCopyIp = async (e: React.MouseEvent, ip: string, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedIpMap((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setCopiedIpMap((prev) => ({ ...prev, [id]: false })), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = ip;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIpMap((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setCopiedIpMap((prev) => ({ ...prev, [id]: false })), 2000);
    }
  };

  const handleCopySsh = async (e: React.MouseEvent, cmd: string, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedSshMap((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setCopiedSshMap((prev) => ({ ...prev, [id]: false })), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = cmd;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSshMap((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => setCopiedSshMap((prev) => ({ ...prev, [id]: false })), 2000);
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
            <RefreshCw size={15} color="var(--primary)" className={isRefreshing ? 'spinner' : ''} />
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
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold m-0 text-foreground">
            {t('dashboard.registeredRouters')}
          </h3>
        </div>
      )}

      {/* Router Cards Grid */}
      <div className="landing-router-grid">
        {isInitialLoading ? (
          [1, 2].map(n => (
            <div key={n} className="landing-router-card pointer-events-none">
              <div className="landing-router-img-wrapper">
                <div className="skeleton-box skeleton-avatar" />
              </div>
              <div className="landing-router-content">
                <div className="skeleton-box skeleton-text-55 mb-2" />
                <div className="flex items-center gap-2">
                  <div className="skeleton-box skeleton-pill" />
                  <div className="skeleton-box skeleton-pill" />
                  <div className="skeleton-box skeleton-pill" />
                </div>
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
        ) : (
          sortedRouters.map(router => {
            const status = (router as any)._status;
            const isOnline = (router as any)._isOnline;
            const routerImg = (router as any)._routerImg;
            const routerIp = getRouterVpnIp(router, status);
            const routerUser = router.user || 'admin';
            const sshCmd = `ssh ${routerUser}@${routerIp}`;
            const isIpCopied = copiedIpMap[router.id || routerIp];
            const isSshCopied = copiedSshMap[router.id || routerIp];

            return (
              <Link
                key={router.id}
                to={`/${router.id}`}
                className={`landing-router-card ${isOnline ? 'online' : 'offline'}`}
              >
                {/* Column 1: Vertically Centered Router Image */}
                <div className="landing-router-img-wrapper">
                  {routerImg ? (
                    <img
                      src={routerImg}
                      className="landing-router-img"
                      alt="Router"
                    />
                  ) : (
                    <div className="landing-router-fallback-icon">
                      <Cpu size={22} color="var(--primary)" />
                    </div>
                  )}
                  <div
                    className={`landing-router-status-dot ${isOnline ? 'online' : 'offline'}`}
                  />
                </div>

                {/* Column 2: Router Content Div */}
                <div className="landing-router-content">
                  {/* Top Row: Name & Dropdown Menu */}
                  <div className="landing-router-top">
                    <h3 className="landing-router-name">
                      {router.name || 'MikroTik Router'}
                    </h3>

                    {/* 3-dots Dropdown Menu Container */}
                    <div className="landing-router-menu-container">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuRouterId(openMenuRouterId === router.id ? null : (router.id || null));
                        }}
                        title="Quick Actions"
                        className={`landing-router-menu-btn ${openMenuRouterId === router.id ? 'active' : ''}`}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu Popup */}
                      {openMenuRouterId === router.id && (
                        <div
                          className={`landing-router-dropdown ${isRtl ? 'rtl' : 'ltr'}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          {/* WebFig */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (routerIp) {
                                window.open(`http://${routerIp}`, '_blank', 'noopener,noreferrer');
                              }
                              setOpenMenuRouterId(null);
                            }}
                            disabled={!routerIp}
                            className="landing-dropdown-item"
                          >
                            <Globe size={14} color="var(--primary)" className="flex-shrink-0" />
                            <span className="flex-1">WebFig</span>
                            <ExternalLink size={12} className="opacity-50 flex-shrink-0" />
                          </button>

                          {/* SSH */}
                          <button
                            onClick={(e) => handleCopySsh(e, sshCmd, router.id || routerIp)}
                            disabled={!routerIp}
                            className={`landing-dropdown-item ${isSshCopied ? 'text-emerald-500' : ''}`}
                          >
                            {isSshCopied ? (
                              <Check size={14} color="var(--success)" className="flex-shrink-0" />
                            ) : (
                              <Terminal size={14} color="var(--primary)" className="flex-shrink-0" />
                            )}
                            <span className="flex-1">
                              {isSshCopied ? (t('common.copied') || 'Copied SSH!') : 'SSH Command'}
                            </span>
                          </button>

                          {/* Copy IP */}
                          <button
                            onClick={(e) => handleCopyIp(e, routerIp, router.id || routerIp)}
                            disabled={!routerIp}
                            className={`landing-dropdown-item ${isIpCopied ? 'text-emerald-500' : ''}`}
                          >
                            {isIpCopied ? (
                              <Check size={14} color="var(--success)" className="flex-shrink-0" />
                            ) : (
                              <Copy size={14} color="var(--primary)" className="flex-shrink-0" />
                            )}
                            <span className="flex-1">
                              {isIpCopied ? (t('common.copied') || 'Copied IP!') : (routerIp ? `Copy IP (${routerIp})` : 'Copy IP')}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Telemetry Stats Strip */}
                  <div className="landing-router-telemetry">
                    <div className="landing-telemetry-item" title="Active Hotspot Users">
                      <Users size={13} color="var(--primary)" />
                      <span className="font-bold">{isOnline && status ? (status.activeUsers || 0) : '0'}</span>
                    </div>

                    <span className="landing-telemetry-sep">|</span>

                    <div className="landing-telemetry-item" title="CPU Usage">
                      <Activity size={13} color="var(--primary)" />
                      <span className="font-bold">{isOnline && status ? (status.cpuLoad_display || (status.cpuLoad !== undefined ? `${status.cpuLoad}%` : '—')) : '—'}</span>
                    </div>

                    <span className="landing-telemetry-sep">|</span>

                    <div className="landing-telemetry-item" title="RAM Usage">
                      <Cpu size={13} color="var(--primary)" />
                      <span className="font-bold">
                        {isOnline && status && typeof status.totalMemory === 'number' && status.totalMemory > 0 && typeof status.freeMemory === 'number'
                          ? `${Math.round(((status.totalMemory - status.freeMemory) / status.totalMemory) * 100)}%`
                          : '—'}
                      </span>
                    </div>

                    <span className="landing-telemetry-sep">|</span>

                    <div className="landing-telemetry-item" title="Router Temperature">
                      <Thermometer size={13} color="var(--primary)" />
                      <span className="font-bold">{isOnline && status ? (status.temperature_display || (status.temperature != null ? `${status.temperature}°C` : '—')) : '—'}</span>
                    </div>

                    <span className="landing-telemetry-sep">|</span>

                    <div className="landing-telemetry-item" title="System Uptime">
                      <Clock size={13} color="var(--primary)" />
                      <span className="font-bold text-[11px]">{isOnline && status ? formatUptimeAPI(status.uptime || status.uptime_display) : '—'}</span>
                    </div>
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
