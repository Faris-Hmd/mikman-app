import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchNetworkClientsAPI, removeActiveSessionAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

import {
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  X,
  Wifi,
  WifiOff,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Check,
  Globe,
  Layers,
  Smartphone,
  Info,
  Shield,
  Activity,
  LogOut,
  MessageSquare
} from 'lucide-react';

interface NetworkClient {
  id?: string;
  name?: string;
  user?: string;
  mac?: string;
  ip?: string;
  uptime?: string;
  sessionTimeLeft?: string;
  timeLeft?: string;
  remainingTime?: string;
  session_time_left?: string;
  limitUptime?: string;
  signal?: number;
  profile?: string;
  rxBytes?: number;
  txBytes?: number;
  bytesIn?: number;
  bytesOut?: number;
  comment?: string;
}

// Utility to format bytes into readable strings
const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
};

// Signal strength color helper
const getSignalColor = (signal?: number) => {
  if (signal === undefined || signal === null) return { text: '#9ca3af', bg: 'rgba(156, 163, 175, 0.12)', border: 'rgba(156, 163, 175, 0.25)' };
  if (signal >= 70) return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
  if (signal >= 40) return { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' };
  return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' };
};

// Helper to reliably check if a client is an active authenticated hotspot voucher user
const checkIsSignedUser = (client: NetworkClient): boolean => {
  // Hotspot user must be in user or voucherCode (never fall back to device name)
  const hotspotUser = (client.user || (client as any).voucherCode || '').trim();
  if (!hotspotUser) return false;

  const cleanUser = hotspotUser.toLowerCase().replace(/[:-]/g, '');
  const cleanMac = client.mac ? client.mac.toLowerCase().replace(/[:-]/g, '') : '';
  const cleanIp = client.ip ? client.ip.trim() : '';

  // Exclude MAC or IP logins if they match raw credentials
  if (cleanUser === cleanMac || hotspotUser === cleanIp) return false;

  // Exclude bypassed bindings (check boolean & string formats)
  const isBypassed = (client as any).bypassed === true ||
                     (client as any).bypassed === 'true' ||
                     (client as any).type === 'bypassed';
  if (isBypassed) return false;

  // Exclude AP devices by flag, comment, or device name keywords
  const commentStr = (client.comment || '').toLowerCase();
  const nameStr = (client.name || '').toLowerCase();
  const isApDevice = (client as any).isAp === true ||
                     (client as any).isAp === 'true' ||
                     /\b(ap|access point|bypass|binding)\b/i.test(commentStr) ||
                     (/\b(ap|access point|routerboard|tp-link|ubiquiti|mikrotik|tenda|netgear|cisco)\b/i.test(nameStr));
  if (isApDevice) return false;

  if ((client as any).authorized === false) return false;

  return true;
};

export default function UsersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();

  const [activeTab, setActiveTab] = useState<'signedIn' | 'waiting' | 'all'>('signedIn');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<NetworkClient | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const { data: clients, isLoading, mutate } = useSWR(
    routerId ? `router-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const rawClientList: NetworkClient[] = useMemo(() => {
    if (Array.isArray(clients)) return clients;
    if (clients && typeof clients === 'object') {
      if (Array.isArray((clients as any).clients)) return (clients as any).clients;
      if (Array.isArray((clients as any).data)) return (clients as any).data;
    }
    return [];
  }, [clients]);

  // Separate clients into signed-in voucher users and waiting/unauthenticated clients
  const { signedInClients, waitingClients } = useMemo(() => {
    const signed: NetworkClient[] = [];
    const waiting: NetworkClient[] = [];

    rawClientList.forEach(c => {
      if (checkIsSignedUser(c)) {
        signed.push(c);
      } else {
        waiting.push(c);
      }
    });

    return { signedInClients: signed, waitingClients: waiting };
  }, [rawClientList]);

  // Select active tab list
  const currentTabList = useMemo(() => {
    if (activeTab === 'signedIn') return signedInClients;
    if (activeTab === 'waiting') return waitingClients;
    return rawClientList;
  }, [activeTab, signedInClients, waitingClients, rawClientList]);

  // Filter clients based on search input
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return currentTabList;
    const term = searchTerm.toLowerCase().trim();
    return currentTabList.filter(c => {
      const nameMatch = (c.name || c.user || '').toLowerCase().includes(term);
      const macMatch = (c.mac || '').toLowerCase().includes(term);
      const ipMatch = (c.ip || '').toLowerCase().includes(term);
      const profileMatch = (c.profile || '').toLowerCase().includes(term);
      return nameMatch || macMatch || ipMatch || profileMatch;
    });
  }, [currentTabList, searchTerm]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDisconnect = async () => {
    if (!routerId || !selectedClient) return;
    const targetId = selectedClient.id || selectedClient.user || (selectedClient as any).voucherCode;
    if (!targetId) return;

    setIsDisconnecting(true);
    try {
      await removeActiveSessionAPI(routerId, targetId);
      setSelectedClient(null);
      setShowDisconnectConfirm(false);
      mutate();
    } catch (err) {
      console.error('Failed to disconnect session:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div
      className="responsive-container"
      style={{
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* ─── 1. Page Header ─── */}
      <div className="responsive-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.45) 100%)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.35)',
            boxShadow: '0 2px 6px rgba(59,130,246,0.2)',
            flexShrink: 0
          }}>
            <Users size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('users.title')}
            </h2>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          <span className="hide-sm-only">{t('common.refresh') || 'Refresh'}</span>
        </button>
      </div>

      {/* ─── 2. Overview Stat Cards / Interactive Group Tabs ─── */}
      <div className="stat-summary-grid">
        {/* Group 1: Signed In Users */}
        <div
          onClick={() => setActiveTab('signedIn')}
          style={{
            background: activeTab === 'signedIn'
              ? 'rgba(59, 130, 246, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: activeTab === 'signedIn'
              ? '1px solid rgba(59, 130, 246, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'signedIn' ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: activeTab === 'signedIn' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.15)',
            color: activeTab === 'signedIn' ? '#60a5fa' : '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            flexShrink: 0
          }}>
            <UserCheck size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('users.signedIn')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', marginTop: '1px' }}>
              {isLoading ? '—' : signedInClients.length}
            </div>
          </div>
        </div>

        {/* Group 2: Waiting to Sign In */}
        <div
          onClick={() => setActiveTab('waiting')}
          style={{
            background: activeTab === 'waiting'
              ? 'rgba(245, 158, 11, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: activeTab === 'waiting'
              ? '1px solid rgba(245, 158, 11, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'waiting' ? '0 2px 8px rgba(245, 158, 11, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: activeTab === 'waiting' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            flexShrink: 0
          }}>
            <Clock size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('users.waiting')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', marginTop: '1px' }}>
              {isLoading ? '—' : waitingClients.length}
            </div>
          </div>
        </div>

        {/* Group 3: All Users */}
        <div
          onClick={() => setActiveTab('all')}
          style={{
            background: activeTab === 'all'
              ? 'rgba(99, 102, 241, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: activeTab === 'all'
              ? '1px solid rgba(99, 102, 241, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'all' ? '0 2px 8px rgba(99, 102, 241, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: activeTab === 'all' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.15)',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            flexShrink: 0
          }}>
            <Users size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('users.all')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', marginTop: '1px' }}>
              {isLoading ? '—' : rawClientList.length}
            </div>
          </div>
        </div>
      </div>

      {/* Search Input Filter Bar */}
      <div style={{
        position: 'relative',
        width: '100%',
      }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            [isRtl ? 'right' : 'left']: '10px',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('users.searchPlaceholder')}
          style={{
            width: '100%',
            padding: `8px ${isRtl ? '30px' : '30px'} 8px ${isRtl ? '30px' : '30px'}`,
            background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '8px',
            color: 'var(--foreground)',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
          }}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              [isRtl ? 'left' : 'right']: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ─── 3. Main Content List / Skeleton / Empty State ─── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className="skeleton"
              style={{
                height: '84px',
                borderRadius: '16px',
                width: '100%'
              }}
            />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div style={{
          background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
          borderRadius: '18px',
          padding: '40px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            background: 'rgba(156, 163, 175, 0.1)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(156, 163, 175, 0.2)'
          }}>
            <WifiOff size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--foreground)' }}>
              {t('users.noClientsFound')}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', maxWidth: '320px' }}>
              {t('users.noClientsDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredClients.map((client, idx) => {
            const isSignedUser = checkIsSignedUser(client);
            const rawUser = (client.user || (client as any).voucherCode || '').trim();

            const deviceNameCandidate = (() => {
              const rawDevName = (
                client.name ||
                (client as any).hostName ||
                (client as any)['host-name'] ||
                (client as any).dhcpName ||
                client.comment ||
                ''
              ).trim();

              if (!rawDevName) return '';
              const lowerDev = rawDevName.toLowerCase();
              const lowerUser = rawUser.toLowerCase();
              const lowerMac = (client.mac || '').toLowerCase();
              const lowerIp = (client.ip || '').toLowerCase();

              if (
                lowerDev === lowerUser ||
                lowerDev === lowerMac ||
                lowerDev === lowerIp ||
                lowerDev === 'active client' ||
                lowerDev === 'offline client' ||
                lowerDev === 'unnamed client'
              ) {
                return '';
              }

              return rawDevName;
            })();

            const clientName = isSignedUser
              ? rawUser
              : (client.name && client.name !== client.mac ? client.name : (client.ip || client.mac || t('users.waiting')));

            const sigStyle = getSignalColor(client.signal);
            const rx = client.rxBytes || client.bytesIn || 0;
            const tx = client.txBytes || client.bytesOut || 0;
            const remainingTime = client.sessionTimeLeft || client.timeLeft || client.remainingTime || client.session_time_left || client.limitUptime || client.uptime;

            return (
              <div
                key={client.id || idx}
                onClick={() => setSelectedClient(client)}
                style={{
                  border: isSignedUser
                    ? '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))'
                    : '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                className="list-item-card hover-card"
              >
                {/* Left: Device / User Avatar & Identifiers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  {/* Avatar Icon + Online Pulse Dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      className="item-icon"
                      style={{
                        background: isSignedUser
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.3) 100%)'
                          : 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.3) 100%)',
                        color: isSignedUser ? 'var(--primary, #3b82f6)' : '#f59e0b',
                        border: isSignedUser ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(245,158,11,0.3)'
                      }}
                    >
                      {isSignedUser ? <Smartphone size={16} /> : <UserX size={16} />}
                    </div>
                    <span style={{
                      position: 'absolute',
                      bottom: '-1px',
                      [isRtl ? 'left' : 'right']: '-1px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isSignedUser ? '#10b981' : '#f59e0b',
                      border: '1.5px solid var(--card-bg, #0f172a)',
                      boxShadow: isSignedUser ? '0 0 4px rgba(16,185,129,0.8)' : '0 0 4px rgba(245,158,11,0.8)'
                    }} />
                  </div>

                  {/* Name & Details */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {isSignedUser && deviceNameCandidate ? (
                      <>
                        <strong
                          title={deviceNameCandidate}
                          className="item-title"
                          style={{
                            maxWidth: '140px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block'
                          }}
                        >
                          {deviceNameCandidate}
                        </strong>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px', flexWrap: 'wrap' }}>
                          <span className="item-subtext" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <Shield size={10} style={{ opacity: 0.7 }} />
                            {rawUser}
                          </span>

                          {client.profile && (
                            <span className="item-badge" style={{
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#818cf8',
                              border: '1px solid rgba(99, 102, 241, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              <Layers size={9} />
                              {client.profile}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong className="item-title" style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {clientName}
                        </strong>

                        {!isSignedUser ? (
                          <span className="item-badge" style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <Clock size={9} />
                            {t('users.waiting')}
                          </span>
                        ) : client.profile ? (
                          <span className="item-badge" style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <Layers size={9} />
                            {client.profile}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Uptime, Signal Strength & Traffic */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexShrink: 0
                }}>
                  {/* Traffic Down / Up (Hidden on sm screens) */}
                  {(rx > 0 || tx > 0) && (
                    <div className="hide-sm" style={{ textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#10b981' }}>
                        <ArrowDownRight size={11} />
                        <span>{formatBytes(rx)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#6366f1' }}>
                        <ArrowUpRight size={11} />
                        <span>{formatBytes(tx)}</span>
                      </div>
                    </div>
                  )}

                  {/* Remaining Time Badge */}
                  {remainingTime && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      border: '1px solid var(--glass-border)',
                      whiteSpace: 'nowrap'
                    }}>
                      <Clock size={10} />
                      <span>{remainingTime}</span>
                    </div>
                  )}

                  {/* Signal Strength Badge */}
                  {client.signal != null && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: sigStyle.text,
                      background: sigStyle.bg,
                      padding: '2px 6px',
                      borderRadius: '6px',
                      border: `1px solid ${sigStyle.border}`,
                      whiteSpace: 'nowrap'
                    }}>
                      <Wifi size={10} />
                      <span>{client.signal}%</span>
                    </div>
                  )}

                  {/* Info Icon Button */}
                  <div style={{
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px'
                  }}>
                    <Info size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 4. Client Detail Glass Modal ─── */}
      {selectedClient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedClient(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--card-bg, #0f172a)',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              direction: isRtl ? 'rtl' : 'ltr',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.4) 100%)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(59,130,246,0.3)'
                }}>
                  <Smartphone size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--foreground)' }}>
                    {selectedClient.name || selectedClient.user || 'Unnamed Client'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('users.clientDetails')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '10px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Details Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Hotspot User / Voucher Code */}
              {(selectedClient.user || (selectedClient as any).voucherCode) && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <Shield size={15} style={{ color: '#3b82f6' }} />
                    <span>{t('users.user')}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                    {selectedClient.user || (selectedClient as any).voucherCode}
                  </span>
                </div>
              )}

              {/* IP Address Card */}
              {selectedClient.ip && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <Globe size={15} style={{ color: '#10b981' }} />
                    <span>{t('users.ipAddress')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                      {selectedClient.ip}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedClient.ip!, 'ip')}
                      style={{
                        background: copiedField === 'ip' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        color: copiedField === 'ip' ? '#10b981' : 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedField === 'ip' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === 'ip' ? t('users.copied') : t('users.copyIp')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MAC Address Card */}
              {selectedClient.mac && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <Activity size={15} style={{ color: '#6366f1' }} />
                    <span>{t('users.macAddress')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                      {selectedClient.mac}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedClient.mac!, 'mac')}
                      style={{
                        background: copiedField === 'mac' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        color: copiedField === 'mac' ? '#10b981' : 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copiedField === 'mac' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === 'mac' ? t('users.copied') : t('users.copyMac')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Device Name Card */}
              {(() => {
                const modalUser = (selectedClient.user || (selectedClient as any).voucherCode || '').trim();
                const rawDevName = (
                  selectedClient.name ||
                  (selectedClient as any).hostName ||
                  (selectedClient as any)['host-name'] ||
                  (selectedClient as any).dhcpName ||
                  selectedClient.comment ||
                  ''
                ).trim();
                if (!rawDevName) return null;
                const lowerDev = rawDevName.toLowerCase();
                const lowerUser = modalUser.toLowerCase();
                const lowerMac = (selectedClient.mac || '').toLowerCase();
                const lowerIp = (selectedClient.ip || '').toLowerCase();

                if (
                  lowerDev === lowerUser ||
                  lowerDev === lowerMac ||
                  lowerDev === lowerIp ||
                  lowerDev === 'active client' ||
                  lowerDev === 'offline client' ||
                  lowerDev === 'unnamed client'
                ) {
                  return null;
                }

                return (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <Smartphone size={15} style={{ color: '#3b82f6' }} />
                      <span>{t('users.deviceName')}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {rawDevName}
                    </span>
                  </div>
                );
              })()}

              {/* Remaining Time Card */}
              {(selectedClient.sessionTimeLeft || selectedClient.timeLeft || selectedClient.remainingTime || selectedClient.session_time_left || selectedClient.limitUptime || selectedClient.uptime) && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <Clock size={15} style={{ color: '#f59e0b' }} />
                    <span>{t('users.remainingTime')}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                    {selectedClient.sessionTimeLeft || selectedClient.timeLeft || selectedClient.remainingTime || selectedClient.session_time_left || selectedClient.limitUptime || selectedClient.uptime}
                  </span>
                </div>
              )}

              {/* Profile Card */}
              {selectedClient.profile && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <Layers size={15} style={{ color: '#a855f7' }} />
                    <span>{t('users.profile')}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary, #3b82f6)' }}>
                    {selectedClient.profile}
                  </span>
                </div>
              )}

              {/* Comment Card */}
              {selectedClient.comment && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <MessageSquare size={15} style={{ color: '#f59e0b' }} />
                    <span>{t('users.comment')}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                    {selectedClient.comment}
                  </span>
                </div>
              )}

              {/* Traffic Cards */}
              {((selectedClient.rxBytes || selectedClient.bytesIn) || (selectedClient.txBytes || selectedClient.bytesOut)) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px'
                }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <ArrowDownRight size={18} style={{ color: '#10b981' }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('users.rxBytes')}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {formatBytes(selectedClient.rxBytes || selectedClient.bytesIn)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <ArrowUpRight size={18} style={{ color: '#6366f1' }} />
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('users.txBytes')}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {formatBytes(selectedClient.txBytes || selectedClient.bytesOut)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Disconnect Action Button */}
              <div style={{ marginTop: '8px', paddingTop: '14px', borderTop: '1px solid var(--glass-border)' }}>
                {showDisconnectConfirm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', textAlign: 'center', fontWeight: 600 }}>
                      {t('users.confirmDisconnect')}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        disabled={isDisconnecting}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '10px',
                          border: '1px solid var(--glass-border)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--foreground)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {t('aps.cancel')}
                      </button>
                      <button
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '10px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          background: 'linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(220,38,38,0.9) 100%)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        {isDisconnecting ? (
                          <>
                            <RefreshCw size={13} className="spin" />
                            <span>{t('users.disconnecting')}</span>
                          </>
                        ) : (
                          <>
                            <LogOut size={13} />
                            <span>{t('users.disconnectUser')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <LogOut size={15} />
                    <span>{t('users.disconnectUser')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}