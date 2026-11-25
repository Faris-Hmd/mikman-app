import { useState, useRef, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetchSingleRouterStatusAPI, fetchRouterProfilesWithUserAPI, fetchAllRoutersStatusAPI, formatUptimeAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { cleanDisplayName, getRouterImage } from '../../lib/helpers';
import './shell.css';
import { Cpu, Clock, Users, Thermometer, ChevronDown, Check, LayoutGrid, Activity } from 'lucide-react';

export default function RouterStatusHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { t, isRtl } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const match = location.pathname.match(/^\/([^\/]+)/);
  const pathRouterId = match ? match[1] : null;
  const isExcluded = !pathRouterId || ['account', 'register-router', 'auth', ''].includes(pathRouterId);
  const routerId = !isExcluded ? (params.routerId || pathRouterId) : null;

  const { data: status, isLoading: isStatusLoading } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 15000, dedupingInterval: 5000 }
  );

  const { data: profilesResponse } = useSWR(
    'all-router-profiles',
    fetchRouterProfilesWithUserAPI,
    { dedupingInterval: 10000 }
  );

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
  const currentRouterImg = getRouterImage(currentProfile);

  const handleSwitchRouter = (targetRouterId: string) => {
    setIsOpen(false);
    if (targetRouterId === routerId) return;

    const currentSubPath = location.pathname.replace(`/${routerId}`, '');
    navigate(`/${targetRouterId}${currentSubPath}`);
  };

  return (
    <div className={`shell-status-header ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Left: Router Switcher Dropdown & Status Dot */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            className={`shell-status-switcher-btn ${isOpen ? 'open' : ''}`}
            title={t('sidebar.switchRouter') || 'Switch Router'}
          >
            <img src={currentRouterImg} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
            <span className="truncate max-w-[140px]">
              {routerDisplayName}
            </span>
            <span
              className={`shell-status-dot ${isStatusLoading ? 'connecting' : isOnline ? 'online' : 'offline'}`}
              title={isStatusLoading ? 'Connecting...' : isOnline ? 'Online' : 'Offline'}
            />
            <ChevronDown
              size={12}
              className={`text-muted transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Menu Overlay */}
          {isOpen && (
            <div className={`shell-status-dropdown ${isRtl ? 'rtl' : 'ltr'}`}>
              <div className="px-2 py-1 text-[10px] font-bold text-muted uppercase flex justify-between items-center">
                <span>{t('sidebar.switchRouter') || 'Switch Router'}</span>
                {profiles.length > 0 && (
                  <span className="text-[9px] opacity-80">
                    {profiles.length} {profiles.length === 1 ? 'router' : 'routers'}
                  </span>
                )}
              </div>

              <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5">
                {profiles.length > 0 ? (
                  profiles.map((p: any) => {
                    const isActive = p.id === routerId;
                    const pStatus = p.id === routerId ? status : statusMap[p.id];
                    const pOnline = p.id === routerId ? isOnline : !!(pStatus?.online || pStatus?.status === 'online');
                    const displayName = cleanDisplayName(p.name || p.wifiName, p.id);
                    const pImg = getRouterImage(p);

                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSwitchRouter(p.id)}
                        type="button"
                        className={`shell-status-dropdown-item ${isActive ? 'active' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img src={pImg} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                          <span
                            className={`shell-status-dot ${pOnline ? 'online' : 'offline'}`}
                          />
                          <span className="truncate">
                            {displayName}
                          </span>
                        </div>

                        {isActive && <Check size={13} className="text-primary flex-shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="flex flex-col gap-1 p-1">
                    <div className="skeleton shell-dropdown-skeleton" />
                    <div className="skeleton shell-dropdown-skeleton" />
                  </div>
                )}
              </div>

              <div className="border-t border-glass mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/');
                  }}
                  type="button"
                  className="shell-status-dropdown-item text-muted"
                >
                  <LayoutGrid size={12} />
                  <span>{t('header.routerSelection') || 'All Routers'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Quick Telemetry */}
      <div className="shell-telemetry-strip">
        {isStatusLoading && !status ? (
          <>
            <div className="skeleton shell-telemetry-skeleton" />
            <div className="skeleton shell-telemetry-skeleton hide-on-mobile" />
            <div className="skeleton shell-telemetry-skeleton" />
          </>
        ) : (
          <>
            {status?.activeUsers != null && (
          <div className="shell-telemetry-badge" title={t('dashboard.activeSessions')}>
            <Users size={13} className="text-blue-400" />
            <strong>{status.activeUsers}</strong>
          </div>
        )}

        {status?.cpuLoad != null && (
          <div className="shell-telemetry-badge hide-on-mobile" title={t('header.cpuLoad')}>
            <Cpu size={13} className="text-orange-400" />
            <strong>{status.cpuLoad}%</strong>
          </div>
        )}

        {status?.totalMemory != null && status?.freeMemory != null && (
          <div className="shell-telemetry-badge hide-on-mobile" title={t('header.ram') || 'RAM'}>
            <Activity size={13} className="text-purple-400" />
            <strong>
              {Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024))}MB
            </strong>
          </div>
        )}

        {status?.uptime && (
          <div className="shell-telemetry-badge" title={t('header.uptime')}>
            <Clock size={13} className="text-emerald-400" />
            <strong>{formatUptimeAPI(status.uptime)}</strong>
          </div>
        )}

        {status?.temperature != null && (
          <div className="shell-telemetry-badge" title={t('header.temp')}>
            <Thermometer size={13} className="text-red-400" />
            <strong>{status.temperature}°C</strong>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
