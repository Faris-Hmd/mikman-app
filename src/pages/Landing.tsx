import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchRouterProfilesWithUserAPI,
  fetchAllRoutersStatusAPI,
  formatUptimeAPI,
  fetchUserVpnPeersStatusAPI,
  deleteUserVpnPeerAPI,
  UserPeerStatusItem,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useLanguage } from '../context/LanguageContext';
import { getRemainingDays, getTemperature, getRouterImage, skeletonStyle, getQuotaName, getRouterVpnIp } from '../lib/helpers';
import { getPublicKeyFromPrivateKey } from '../lib/wireguardVpn';
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
  Laptop,
  Smartphone,
  Trash2,
  MoreVertical,
  Terminal,
  ExternalLink,
  X,
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
  const [peerToDelete, setPeerToDelete] = useState<UserPeerStatusItem | null>(null);
  const [isDeletingPeer, setIsDeletingPeer] = useState(false);

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
      if (openMenuRouterId && !(e.target as HTMLElement).closest('.router-dropdown-menu-container')) {
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
  const usagePercent = userData ? Math.min(100, Math.round((totalRouters / maxRouters) * 100)) : 0;
  const days = userData ? getRemainingDays(userData.expiresAt, nowTime) : null;
  const planName = userData ? getQuotaName(t, userData.quota as string, userData.maxRouters as number) : null;

  const userName = userData?.name || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : '');

  // Read existing VPN client IP from localStorage without calling the server.
  // Calling fetchUserVpnConfigAPI here would re-register the peer on the VPS,
  // which undoes any deletion the user just performed.
  const vpnServerConfig = React.useMemo(() => {
    const email = (currentUser?.email || '').toLowerCase().trim();
    if (!email) return null;
    const existingPriv = localStorage.getItem(`@wg_user_privkey_${email}_pc`) || localStorage.getItem(`@wg_user_privkey_${email}`);
    if (!existingPriv) return null;
    return { clientIp: null as string | null };
  }, [currentUser?.email]);

  const { data: peerTelemetryList, mutate: mutatePeers } = useSWR(
    currentUser?.email ? ['user-vpn-peers-telemetry', currentUser.email] : null,
    async () => {
      try {
        // ONLY read existing keys — never auto-create. Peer creation is handled
        // exclusively by VpnAccessModal.  If no key exists yet, just call
        // the status endpoint without a key filter to get all user peers.
        const email = (currentUser?.email || '').toLowerCase().trim();
        const existingPriv = email
          ? (localStorage.getItem(`@wg_user_privkey_${email}_pc`) || localStorage.getItem(`@wg_user_privkey_${email}`))
          : null;
        const pubKey = existingPriv ? getPublicKeyFromPrivateKey(existingPriv) : undefined;
        return await fetchUserVpnPeersStatusAPI(pubKey);
      } catch {
        return [];
      }
    },
    { refreshInterval: 10000, dedupingInterval: 5000, revalidateOnFocus: true }
  );

  const confirmDeletePeer = async () => {
    if (!peerToDelete?.publicKey) return;
    setIsDeletingPeer(true);
    try {
      const success = await deleteUserVpnPeerAPI(peerToDelete.publicKey);
      if (success) {
        // Clean up local storage key if it corresponds to this peer slot
        const email = currentUser?.email?.toLowerCase().trim() || '';
        if (email) {
          ['pc', 'phone', 'default'].forEach((slot) => {
            const priv = localStorage.getItem(`@wg_user_privkey_${email}_${slot}`);
            if (priv && getPublicKeyFromPrivateKey(priv) === peerToDelete.publicKey) {
              localStorage.removeItem(`@wg_user_privkey_${email}_${slot}`);
              localStorage.removeItem(`@wg_dev_name_${slot}_${email}`);
            }
          });
          const legacyPriv = localStorage.getItem(`@wg_user_privkey_${email}`);
          if (legacyPriv && getPublicKeyFromPrivateKey(legacyPriv) === peerToDelete.publicKey) {
            localStorage.removeItem(`@wg_user_privkey_${email}`);
          }
        }
        // Optimistically remove the deleted peer from the local list
        // instead of re-fetching (which would re-derive keys and potentially
        // re-register a new peer on the VPS).
        const deletedPubKey = peerToDelete.publicKey;
        await mutatePeers(
          (currentPeers: UserPeerStatusItem[] | undefined) =>
            (currentPeers || []).filter((p) => p.publicKey !== deletedPubKey),
          false // Don't revalidate immediately — let the next 10s poll pick it up
        );
        setPeerToDelete(null);
      } else {
        showAlert(t('common.error') || 'Error', t('dashboard.deletePeerFailed') || 'Failed to delete peer from server', 'error');
      }
    } catch (err: any) {
      showAlert(t('common.error') || 'Error', err?.message || String(err), 'error');
    } finally {
      setIsDeletingPeer(false);
    }
  };

  // peerTelemetryList states:
  //  undefined = SWR still loading (show skeleton)
  //  []        = server confirmed zero peers (show empty state)
  //  [...]     = real peers to render
  const isPeersLoading = peerTelemetryList === undefined;
  const livePeers = peerTelemetryList || [];

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
              {userName || <span style={skeletonStyle('80px')} />}
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
        <div className="account-status-group account-status-group-bottom" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {userData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: '700', color: 'var(--foreground)' }}>{planName}</span>
              {userData?.expiresAt && days !== null && (
                <span>• {days > 0 ? `${days} ${language === 'ar' ? 'يوم' : 'd'}` : (t('dashboard.expired') || 'Expired')}</span>
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

      {/* Small WireGuard Peers List (PC & Phone) */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '12.5px', fontWeight: '800', margin: '0 0 8px 0', color: 'var(--foreground)' }}>
          {t('dashboard.vpnPeersTitle') || 'WireGuard Peers'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
          {isPeersLoading ? (
            /* Loading skeleton */
            [1, 2].map(n => (
              <div
                key={n}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '15px', height: '15px', borderRadius: '4px', ...skeletonStyle('15px') }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '12px', width: '60%', borderRadius: '3px', ...skeletonStyle('100%') }} />
                </div>
                <div style={{ height: '12px', width: '40px', borderRadius: '3px', ...skeletonStyle('40px') }} />
              </div>
            ))
          ) : livePeers.length === 0 ? (
            /* Empty state — no peers configured */
            <div
              style={{
                gridColumn: '1 / -1',
                background: 'var(--card-bg)',
                border: '1px dashed var(--glass-border)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--text-muted)',
              }}
            >
              <Laptop size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span style={{ fontSize: '11.5px' }}>
                {t('dashboard.noPeersDesc') || 'No WireGuard peers configured. Open VPN Access to set up a tunnel.'}
              </span>
            </div>
          ) : (
          livePeers.map((peer, idx) => {
            const isPhone = peer.deviceType === 'phone' || peer.name.toLowerCase().includes('phone');
            const Icon = isPhone ? Smartphone : Laptop;
            const iconColor = isPhone ? '#10b981' : 'var(--primary)';

            return (
              <div
                key={peer.publicKey || peer.clientIp || idx}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Icon size={15} color={iconColor} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {peer.name || (isPhone ? 'Admin Phone' : 'Admin PC')}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {isPhone ? 'Phone' : 'PC'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <div style={{ textAlign: isRtl ? 'left' : 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: peer.isOnline ? '#10b981' : 'var(--text-muted)' }}>
                      {peer.isOnline ? (isRtl ? 'متصل' : 'Online') : (isRtl ? 'غير متصل' : 'Offline')}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {peer.lastHandshakeHuman !== 'Never' ? `${peer.lastHandshakeHuman}` : (isRtl ? 'لم يتصل' : 'Never')}
                    </div>
                  </div>
                  {peer.publicKey && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPeerToDelete(peer);
                      }}
                      title={t('common.delete') || 'Delete Peer'}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        borderRadius: '6px',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          }))
          }
        </div>
      </div>

      {/* Routers Grid Header */}
      {(savedRouters.length > 0 || isInitialLoading) && (
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '13.5px', fontWeight: '800', margin: 0, color: 'var(--foreground)' }}>
            {t('dashboard.registeredRouters')}
          </h3>
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
            <p style={{ fontSize: '14px', fontWeight: '750', margin: '0 0 4px', color: 'var(--foreground)' }}>{t('dashboard.noRoutersTitle')}</p>
            <p style={{ fontSize: '12px', margin: '0 0 12px', color: 'var(--text-muted)' }}>{t('dashboard.noRoutersDesc')}</p>
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
            const routerIp = getRouterVpnIp(router, status);
            const routerUser = router.user || 'admin';
            const sshCmd = `ssh ${routerUser}@${routerIp}`;
            const isIpCopied = copiedIpMap[router.id || routerIp];
            const isSshCopied = copiedSshMap[router.id || routerIp];

            return (
              <Link
                key={router.id}
                to={`/${router.id}`}
                className="router-card"
                style={{
                  textDecoration: 'none',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  opacity: isOnline ? 1 : 0.6,
                  filter: isOnline ? 'none' : 'grayscale(0.2)',
                  position: 'relative',
                }}
              >
                {/* Column 1: Vertically Centered Router Image */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '48px', height: '48px' }}>
                  {routerImg ? (
                    <img
                      src={routerImg}
                      style={{
                        width: '48px',
                        height: '48px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
                      }}
                      alt="Router"
                    />
                  ) : (
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <Cpu size={22} color="var(--primary)" />
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-1px',
                      right: isRtl ? undefined : '-1px',
                      left: isRtl ? '-1px' : undefined,
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      backgroundColor: isOnline ? '#22c55e' : '#94a3b8',
                      border: '2px solid var(--card-bg)',
                      boxShadow: isOnline ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none',
                    }}
                  />
                </div>

                {/* Column 2: Router Content Div (Name + Dropdown top, Telemetry stats bottom) */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                  {/* Top Row: Name & Dropdown Menu + Navigation Chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: 'var(--foreground)',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {router.name || 'MikroTik Router'}
                    </h3>

                    {/* 3-dots Dropdown Menu Container */}
                    <div className="router-dropdown-menu-container" style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuRouterId(openMenuRouterId === router.id ? null : (router.id || null));
                        }}
                        title="Quick Actions"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          padding: '2px',
                          color: openMenuRouterId === router.id ? 'var(--primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease',
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Dropdown Menu Popup */}
                      {openMenuRouterId === router.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            [isRtl ? 'left' : 'right']: 0,
                            zIndex: 100,
                            minWidth: '190px',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '10px',
                            padding: '6px',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
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
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--foreground)',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: routerIp ? 'pointer' : 'not-allowed',
                              textAlign: isRtl ? 'right' : 'left',
                              width: '100%',
                              transition: 'background 0.15s ease',
                              opacity: routerIp ? 1 : 0.5,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.15)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Globe size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>WebFig</span>
                            <ExternalLink size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                          </button>

                          {/* SSH */}
                          <button
                            onClick={(e) => handleCopySsh(e, sshCmd, router.id || routerIp)}
                            disabled={!routerIp}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isSshCopied ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                              color: isSshCopied ? '#10b981' : 'var(--foreground)',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: routerIp ? 'pointer' : 'not-allowed',
                              textAlign: isRtl ? 'right' : 'left',
                              width: '100%',
                              transition: 'background 0.15s ease',
                              opacity: routerIp ? 1 : 0.5,
                            }}
                            onMouseEnter={(e) => {
                              if (!isSshCopied) {
                                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.15)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSshCopied) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {isSshCopied ? (
                              <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                            ) : (
                              <Terminal size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                            )}
                            <span style={{ flex: 1 }}>
                              {isSshCopied ? (t('common.copied') || 'Copied SSH!') : 'SSH Command'}
                            </span>
                          </button>

                          {/* Copy IP */}
                          <button
                            onClick={(e) => handleCopyIp(e, routerIp, router.id || routerIp)}
                            disabled={!routerIp}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isIpCopied ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                              color: isIpCopied ? '#10b981' : 'var(--foreground)',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: routerIp ? 'pointer' : 'not-allowed',
                              textAlign: isRtl ? 'right' : 'left',
                              width: '100%',
                              transition: 'background 0.15s ease',
                              opacity: routerIp ? 1 : 0.5,
                            }}
                            onMouseEnter={(e) => {
                              if (!isIpCopied) {
                                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.15)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isIpCopied) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {isIpCopied ? (
                              <Check size={14} color="#10b981" style={{ flexShrink: 0 }} />
                            ) : (
                              <Copy size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                            )}
                            <span style={{ flex: 1 }}>
                              {isIpCopied ? (t('common.copied') || 'Copied IP!') : (routerIp ? `Copy IP (${routerIp})` : 'Copy IP')}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Telemetry Stats Strip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      gap: '4px',
                      flexWrap: 'wrap',
                      marginTop: '3px',
                      fontSize: '11.5px',
                      color: 'var(--foreground)',
                      opacity: isOnline ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Active Hotspot Users">
                      <Users size={13} color="var(--primary)" />
                      <span style={{ fontWeight: '700' }}>{isOnline && status ? (status.activeUsers || 0) : '0'}</span>
                    </div>

                    <span style={{ opacity: 0.3, color: 'var(--text-muted)', fontSize: '10px' }}>|</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="CPU Usage">
                      <Activity size={13} color="var(--primary)" />
                      <span style={{ fontWeight: '700' }}>{isOnline && status ? (status.cpuLoad_display || (status.cpuLoad !== undefined ? `${status.cpuLoad}%` : '—')) : '—'}</span>
                    </div>

                    <span style={{ opacity: 0.3, color: 'var(--text-muted)', fontSize: '10px' }}>|</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="RAM Usage">
                      <Cpu size={13} color="var(--primary)" />
                      <span style={{ fontWeight: '700' }}>{isOnline && status && typeof status.totalMemory === 'number' ? `${Math.round((status.totalMemory - status.freeMemory) / (1024 * 1024))}M` : '—'}</span>
                    </div>

                    <span style={{ opacity: 0.3, color: 'var(--text-muted)', fontSize: '10px' }}>|</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Router Temperature">
                      <Thermometer size={13} color="var(--primary)" />
                      <span style={{ fontWeight: '700' }}>{isOnline && status ? (status.temperature_display || `${getTemperature(status) ?? '—'}°C`) : '—'}</span>
                    </div>

                    <span style={{ opacity: 0.3, color: 'var(--text-muted)', fontSize: '10px' }}>|</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="System Uptime">
                      <Clock size={13} color="var(--primary)" />
                      <span style={{ fontWeight: '700', fontSize: '11px' }}>{isOnline && status ? formatUptimeAPI(status.uptime || status.uptime_display) : '—'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Dedicated Delete WireGuard Peer Modal */}
      {peerToDelete && (
        <div
          className="modal-overlay"
          dir={isRtl ? 'rtl' : 'ltr'}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !isDeletingPeer && setPeerToDelete(null)}
        >
          <div
            className="responsive-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--foreground)' }}>
                    {t('dashboard.deletePeerModalTitle') || 'Delete WireGuard Peer'}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => !isDeletingPeer && setPeerToDelete(null)}
                disabled={isDeletingPeer}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isDeletingPeer ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {t('dashboard.deletePeerModalDesc') || 'Are you sure you want to delete this WireGuard peer? The device will immediately lose VPN access to your connected routers.'}
              </p>

              {/* Peer Info Box */}
              <div
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {peerToDelete.deviceType === 'phone' || peerToDelete.name?.toLowerCase().includes('phone') ? (
                    <Smartphone size={18} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <Laptop size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {peerToDelete.name || 'WireGuard Device'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {peerToDelete.clientIp || '10.8.x.x'}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: isRtl ? 'left' : 'right', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: peerToDelete.isOnline ? '#10b981' : 'var(--text-muted)',
                    }}
                  >
                    {peerToDelete.isOnline ? (isRtl ? 'متصل' : 'Online') : (isRtl ? 'غير متصل' : 'Offline')}
                  </span>
                </div>
              </div>

              {/* Buttons (Solid High Contrast buttons per AGENTS.md) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPeerToDelete(null)}
                  disabled={isDeletingPeer}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--foreground)',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: isDeletingPeer ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={confirmDeletePeer}
                  disabled={isDeletingPeer}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: isDeletingPeer ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isDeletingPeer && <RefreshCw size={13} className="spinner" />}
                  <span>{isDeletingPeer ? (t('common.deleting') || 'Deleting...') : (t('common.delete') || 'Delete Peer')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}