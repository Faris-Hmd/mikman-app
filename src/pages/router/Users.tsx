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
  MessageSquare,
  Radio,
  Network
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
  port?: string;
  bridgePort?: string;
  isWireless?: boolean;
  signalStrength?: string | number;
  apName?: string;
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
  const [groupBy, setGroupBy] = useState<'port' | 'profile'>('port');
  const [selectedPortFilter, setSelectedPortFilter] = useState<string>('all');
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

  // Extract distinct ports & their assigned APs from active clients
  const availablePorts = useMemo(() => {
    const map = new Map<string, { port: string; apName?: string; count: number; isWireless?: boolean }>();
    rawClientList.forEach((c) => {
      const p = c.port || c.bridgePort || (c.isWireless ? 'wlan1' : '');
      if (p) {
        const existing = map.get(p);
        if (existing) {
          existing.count += 1;
          if (!existing.apName && c.apName) existing.apName = c.apName;
        } else {
          map.set(p, {
            port: p,
            apName: c.apName,
            count: 1,
            isWireless: c.isWireless || p.startsWith('wlan') || p.startsWith('wifi'),
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.port.localeCompare(b.port, undefined, { numeric: true }));
  }, [rawClientList]);

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

  // Filter clients based on search input AND selected port
  const filteredClients = useMemo(() => {
    let list = currentTabList;

    // Filter by Port / AP if selected
    if (selectedPortFilter !== 'all') {
      list = list.filter((c) => {
        const p = c.port || c.bridgePort || (c.isWireless ? 'wlan1' : '');
        return p === selectedPortFilter;
      });
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(c => {
      const nameMatch = (c.name || c.user || '').toLowerCase().includes(term);
      const macMatch = (c.mac || '').toLowerCase().includes(term);
      const ipMatch = (c.ip || '').toLowerCase().includes(term);
      const profileMatch = (c.profile || '').toLowerCase().includes(term);
      const portMatch = (c.port || c.bridgePort || '').toLowerCase().includes(term);
      const apMatch = (c.apName || '').toLowerCase().includes(term);
      return nameMatch || macMatch || ipMatch || profileMatch || portMatch || apMatch;
    });
  }, [currentTabList, selectedPortFilter, searchTerm]);

  // Group clients by either connected Port/AP OR Profile
  const clientGroups = useMemo(() => {
    if (groupBy === 'port') {
      const map = new Map<string, { key: string; title: string; iconType: 'ap' | 'wifi' | 'ether'; port?: string; clients: NetworkClient[] }>();

      filteredClients.forEach((client) => {
        const portName = client.port || client.bridgePort || (client.isWireless ? 'wlan1' : '');
        const apName = client.apName || '';

        let key = portName || (client.isWireless ? 'wlan1' : 'unknown');
        let title = '';
        let iconType: 'ap' | 'wifi' | 'ether' = 'ether';

        if (apName && portName) {
          title = `${apName} (${portName})`;
          iconType = 'ap';
        } else if (apName) {
          title = apName;
          iconType = 'ap';
        } else if (portName) {
          const isWifi = portName.startsWith('wlan') || portName.startsWith('wifi') || client.isWireless;
          title = isWifi ? `Wi-Fi (${portName})` : portName;
          iconType = isWifi ? 'wifi' : 'ether';
        } else if (client.isWireless) {
          title = 'Wi-Fi (Wireless)';
          iconType = 'wifi';
        } else {
          title = t('users.noPortDetected') || 'منفذ غير محدد / الراوتر';
          iconType = 'ether';
        }

        if (!map.has(key)) {
          map.set(key, {
            key,
            title,
            iconType,
            port: portName,
            clients: [],
          });
        }
        map.get(key)!.clients.push(client);
      });

      return Array.from(map.values()).sort((a, b) => {
        if (a.key === 'unknown') return 1;
        if (b.key === 'unknown') return -1;
        return a.title.localeCompare(b.title, undefined, { numeric: true });
      });
    } else {
      // Group by Profile
      const map = new Map<string, { key: string; title: string; iconType: 'profile' | 'waiting'; clients: NetworkClient[] }>();

      filteredClients.forEach((client) => {
        const isSigned = checkIsSignedUser(client);
        const groupKey = client.profile
          ? client.profile
          : isSigned
          ? (t('users.defaultProfile') || 'افتراضي')
          : (t('users.waiting') || 'في الانتظار');

        const isWaiting = !isSigned && !client.profile;

        if (!map.has(groupKey)) {
          map.set(groupKey, {
            key: groupKey,
            title: groupKey,
            iconType: isWaiting ? 'waiting' : 'profile',
            clients: [],
          });
        }
        map.get(groupKey)!.clients.push(client);
      });

      const waitingStr = (t('users.waiting') || 'في الانتظار').toLowerCase();
      return Array.from(map.values()).sort((a, b) => {
        if (a.title.toLowerCase() === waitingStr) return 1;
        if (b.title.toLowerCase() === waitingStr) return -1;
        return a.title.localeCompare(b.title);
      });
    }
  }, [filteredClients, groupBy, t]);

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
      <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div className="page-header-icon">
            <Users />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="page-header-title">
              {t('users.title')}
            </h2>
            <p className="page-header-subtitle">
              {t('users.subtitle') || 'مراقبة الجلسات المتصلة والأجهزة النشطة'}
            </p>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          className="page-header-btn"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hide-sm-only" style={{ whiteSpace: 'nowrap' }}>{t('common.refresh') || 'تحديث'}</span>
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
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'signedIn' ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'var(--secondary)',
            color: 'var(--foreground)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <UserCheck size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('users.signedIn')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>
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
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'waiting' ? '0 2px 8px rgba(245, 158, 11, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'var(--secondary)',
            color: 'var(--foreground)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Clock size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('users.waiting')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>
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
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'all' ? '0 2px 8px rgba(99, 102, 241, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'var(--secondary)',
            color: 'var(--foreground)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('users.all')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>
              {isLoading ? '—' : rawClientList.length}
            </div>
          </div>
        </div>
      </div>

      {/* Search Input & Grouping Mode Control */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
        }}>
          {/* Search Input */}
          <div style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
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

          {/* Group By Mode Toggle Switch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '8px',
              padding: '2px',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setGroupBy('port')}
              title={t('users.groupByPort') || 'Group by Connected Port / AP'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 9px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: groupBy === 'port' ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'transparent',
                color: groupBy === 'port' ? '#ffffff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <Radio size={12} />
              <span className="hide-xs" style={{ whiteSpace: 'nowrap' }}>{t('users.groupByPort') || 'المنافذ'}</span>
            </button>
            <button
              onClick={() => setGroupBy('profile')}
              title={t('users.groupByProfile') || 'Group by Profile'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 9px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: groupBy === 'profile' ? 'var(--primary, #3b82f6)' : 'transparent',
                color: groupBy === 'profile' ? '#ffffff' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={12} />
              <span className="hide-xs" style={{ whiteSpace: 'nowrap' }}>{t('users.groupByProfile') || 'الباقات'}</span>
            </button>
          </div>
        </div>

        {/* ─── Port / AP Quick Filter Pills ─── */}
        {availablePorts.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* All Ports Button */}
            <button
              onClick={() => setSelectedPortFilter('all')}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: selectedPortFilter === 'all'
                  ? 'var(--primary, #3b82f6)'
                  : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
                color: selectedPortFilter === 'all' ? '#ffffff' : 'var(--text-muted)',
                border: selectedPortFilter === 'all'
                  ? '1px solid var(--primary, #3b82f6)'
                  : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t('users.allPorts') || 'All Ports'}</span>
              <span style={{
                fontSize: '9.5px',
                opacity: 0.9,
                background: selectedPortFilter === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                padding: '0 4px',
                borderRadius: '10px'
              }}>
                {rawClientList.length}
              </span>
            </button>

            {availablePorts.map((item) => {
              const isSelected = selectedPortFilter === item.port;
              const Icon = item.apName ? Radio : item.isWireless ? Wifi : Network;
              const iconColor = item.apName ? '#06b6d4' : item.isWireless ? '#10b981' : '#818cf8';

              return (
                <button
                  key={item.port}
                  onClick={() => setSelectedPortFilter(isSelected ? 'all' : item.port)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isSelected
                      ? (item.apName ? '#06b6d4' : item.isWireless ? '#10b981' : '#6366f1')
                      : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
                    color: isSelected ? '#ffffff' : 'var(--foreground)',
                    border: isSelected
                      ? `1px solid ${item.apName ? '#06b6d4' : item.isWireless ? '#10b981' : '#6366f1'}`
                      : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={12} style={{ color: isSelected ? '#ffffff' : iconColor }} />
                  <span>{item.apName ? `${item.apName} (${item.port})` : item.port}</span>
                  <span style={{
                    fontSize: '9.5px',
                    opacity: 0.9,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                    padding: '0 4px',
                    borderRadius: '10px'
                  }}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {clientGroups.map((group) => {
            const isAp = group.iconType === 'ap';
            const isWifi = group.iconType === 'wifi';
            const isWaiting = group.iconType === 'waiting';

            const headerTheme = isAp
              ? { bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.3)', color: '#06b6d4', Icon: Radio }
              : isWifi
              ? { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', color: '#10b981', Icon: Wifi }
              : isWaiting
              ? { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b', Icon: Clock }
              : group.iconType === 'profile'
              ? { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.25)', color: '#818cf8', Icon: Layers }
              : { bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.25)', color: '#94a3b8', Icon: Network };

            const HeaderIcon = headerTheme.Icon;

            return (
              <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Group Glass Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: headerTheme.bg,
                    border: `1px solid ${headerTheme.border}`,
                    borderRadius: '8px',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <HeaderIcon size={14} style={{ color: headerTheme.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: headerTheme.color,
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: `1px solid ${headerTheme.border}`,
                      flexShrink: 0
                    }}
                  >
                    {group.clients.length}
                  </span>
                </div>

                {/* Group Users List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {group.clients.map((client, idx) => {
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
                        gap: '6px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                      className="list-item-card hover-card"
                    >
                      {/* Left: Device / User Avatar & Identifiers */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                        {/* Avatar Icon + Online Pulse Dot */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div
                            className="item-icon"
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              background: isSignedUser
                                ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.3) 100%)'
                                : 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.3) 100%)',
                              color: isSignedUser ? 'var(--primary, #3b82f6)' : '#f59e0b',
                              border: isSignedUser ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(245,158,11,0.3)'
                            }}
                          >
                            {isSignedUser ? <Smartphone size={13} /> : <UserX size={13} />}
                          </div>
                          <span style={{
                            position: 'absolute',
                            bottom: '-1px',
                            [isRtl ? 'left' : 'right']: '-1px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: isSignedUser ? '#10b981' : '#f59e0b',
                            border: '1.5px solid var(--card-bg, #1a1a1a)',
                            boxShadow: isSignedUser ? '0 0 4px rgba(16,185,129,0.8)' : '0 0 4px rgba(245,158,11,0.8)'
                          }} />
                        </div>

                        {/* Name, PIN Badge & Profile Badge in Vertically Aligned Column Slots */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                            {/* Device Name Column Slot */}
                            <strong
                              title={isSignedUser && deviceNameCandidate ? deviceNameCandidate : clientName}
                              className="item-title"
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: 'var(--foreground)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '76px',
                                flexShrink: 0,
                              }}
                            >
                              {isSignedUser && deviceNameCandidate ? deviceNameCandidate : clientName}
                            </strong>

                            {/* PIN / Username Badge Slot */}
                            <div style={{ width: '56px', flexShrink: 0, display: 'flex' }}>
                              {isSignedUser && rawUser && (
                                <span
                                  className="item-badge"
                                  style={{
                                    width: '100%',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--glass-border)',
                                    fontSize: '9.5px',
                                    fontWeight: 600,
                                    padding: '0 2px',
                                    borderRadius: '5px',
                                    height: '19px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    whiteSpace: 'nowrap',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <Shield size={9.5} style={{ opacity: 0.8, flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rawUser}</span>
                                </span>
                              )}
                            </div>

                            {/* Profile / Status Badge Slot */}
                            <div style={{ width: '56px', flexShrink: 0, display: 'flex' }}>
                              {client.profile ? (
                                <span
                                  className="item-badge"
                                  style={{
                                    width: '100%',
                                    background: 'rgba(99, 102, 241, 0.12)',
                                    color: '#818cf8',
                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                    fontSize: '9.5px',
                                    fontWeight: 600,
                                    padding: '0 2px',
                                    borderRadius: '5px',
                                    height: '19px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    whiteSpace: 'nowrap',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <Layers size={9.5} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.profile}</span>
                                </span>
                              ) : !isSignedUser ? (
                                <span
                                  className="item-badge"
                                  style={{
                                    width: '100%',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    fontSize: '9.5px',
                                    fontWeight: 600,
                                    padding: '0 2px',
                                    borderRadius: '5px',
                                    height: '19px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    whiteSpace: 'nowrap',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <Clock size={9.5} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('users.waiting')}</span>
                                </span>
                              ) : null}
                            </div>

                            {/* Port / AP Ingress Badge Slot - Always visible on all screen sizes */}
                            {(() => {
                              const portDisplay = client.port || client.bridgePort;
                              const isWlan = client.isWireless || (portDisplay && (portDisplay.startsWith('wlan') || portDisplay.startsWith('wifi')));
                              const hasAp = !!client.apName;
                              const label = client.apName || (portDisplay ? (isWlan ? `WiFi (${portDisplay})` : portDisplay) : (isWlan ? 'WiFi' : ''));

                              if (!label) return null;

                              return (
                                <div style={{ flexShrink: 0, display: 'flex' }}>
                                  <span
                                    className="item-badge"
                                    title={`${t('users.connectedTo') || 'Connected To'}: ${hasAp ? `${client.apName} (${portDisplay || 'Port'})` : label}`}
                                    style={{
                                      background: hasAp
                                        ? 'rgba(6, 182, 212, 0.15)'
                                        : isWlan
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : 'rgba(255, 255, 255, 0.08)',
                                      color: hasAp ? '#06b6d4' : isWlan ? '#10b981' : 'var(--text-muted)',
                                      border: hasAp
                                        ? '1px solid rgba(6, 182, 212, 0.3)'
                                        : isWlan
                                        ? '1px solid rgba(16, 185, 129, 0.3)'
                                        : '1px solid var(--glass-border)',
                                      fontSize: '9.5px',
                                      fontWeight: 700,
                                      padding: '0 5px',
                                      borderRadius: '5px',
                                      height: '19px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '3px',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '110px',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {hasAp ? (
                                      <Radio size={10} style={{ flexShrink: 0 }} />
                                    ) : isWlan ? (
                                      <Wifi size={10} style={{ flexShrink: 0 }} />
                                    ) : (
                                      <Network size={10} style={{ flexShrink: 0 }} />
                                    )}
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {label}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Right: Uptime, Signal Strength & Traffic */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}>
                        {/* Traffic Down / Up (Hidden on sm screens) */}
                        {(rx > 0 || tx > 0) && (
                          <div className="hide-sm" style={{ textAlign: 'right', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#10b981' }}>
                              <ArrowDownRight size={10} />
                              <span>{formatBytes(rx)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#6366f1' }}>
                              <ArrowUpRight size={10} />
                              <span>{formatBytes(tx)}</span>
                            </div>
                          </div>
                        )}

                        {/* Remaining Time Badge */}
                        {remainingTime && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '9.5px',
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.04)',
                            padding: '0 4px',
                            borderRadius: '5px',
                            border: '1px solid var(--glass-border)',
                            height: '19px',
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box'
                          }}>
                            <Clock size={9.5} style={{ flexShrink: 0 }} />
                            <span>{remainingTime}</span>
                          </div>
                        )}

                        {/* Signal Strength Badge */}
                        {client.signal != null && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: sigStyle.text,
                            background: sigStyle.bg,
                            padding: '0 4px',
                            borderRadius: '5px',
                            border: `1px solid ${sigStyle.border}`,
                            height: '19px',
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box'
                          }}>
                            <Wifi size={9.5} style={{ flexShrink: 0 }} />
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
                          <Info size={13} />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
            padding: '12px',
          }}
          onClick={() => setSelectedClient(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--card-bg, #1a1a1a)',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              direction: isRtl ? 'rtl' : 'ltr',
              boxSizing: 'border-box'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.4) 100%)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(59,130,246,0.3)',
                  flexShrink: 0
                }}>
                  <Smartphone size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedClient.name || selectedClient.user || 'Unnamed Client'}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {t('users.clientDetails')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Details Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {/* Connected Port / AP Ingress Card */}
              {(selectedClient.apName || selectedClient.port || selectedClient.bridgePort || selectedClient.isWireless) && (
                <div style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#06b6d4', flexShrink: 0 }}>
                    {selectedClient.apName ? (
                      <Radio size={13} style={{ color: '#06b6d4' }} />
                    ) : selectedClient.isWireless ? (
                      <Wifi size={13} style={{ color: '#10b981' }} />
                    ) : (
                      <Network size={13} style={{ color: '#06b6d4' }} />
                    )}
                    <span>{t('users.connectedTo') || 'Connected To'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                    {selectedClient.apName ? (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedClient.apName}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 4px' }}>
                          ({selectedClient.port || selectedClient.bridgePort || 'Port'})
                        </span>
                      </span>
                    ) : (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                        {selectedClient.isWireless
                          ? `Wi-Fi (${selectedClient.port || 'wlan1'})`
                          : (selectedClient.port || selectedClient.bridgePort || t('users.noPortDetected') || 'Unknown Port')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Hotspot User / Voucher Code */}
              {(selectedClient.user || (selectedClient as any).voucherCode) && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Shield size={13} style={{ color: '#3b82f6' }} />
                    <span>{t('users.user')}</span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedClient.user || (selectedClient as any).voucherCode}
                  </span>
                </div>
              )}

              {/* IP Address Card */}
              {selectedClient.ip && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Globe size={13} style={{ color: '#10b981' }} />
                    <span>{t('users.ipAddress')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedClient.ip}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedClient.ip!, 'ip')}
                      title={copiedField === 'ip' ? t('users.copied') : t('users.copyIp')}
                      style={{
                        background: copiedField === 'ip' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '5px',
                        padding: '3px 6px',
                        color: copiedField === 'ip' ? '#10b981' : 'var(--text-muted)',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        flexShrink: 0
                      }}
                    >
                      {copiedField === 'ip' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              {/* MAC Address Card */}
              {selectedClient.mac && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Activity size={13} style={{ color: '#6366f1' }} />
                    <span>{t('users.macAddress')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedClient.mac}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedClient.mac!, 'mac')}
                      title={copiedField === 'mac' ? t('users.copied') : t('users.copyMac')}
                      style={{
                        background: copiedField === 'mac' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '5px',
                        padding: '3px 6px',
                        color: copiedField === 'mac' ? '#10b981' : 'var(--text-muted)',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        flexShrink: 0
                      }}
                    >
                      {copiedField === 'mac' ? <Check size={11} /> : <Copy size={11} />}
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
                    borderRadius: '8px',
                    padding: '7px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <Smartphone size={13} style={{ color: '#3b82f6' }} />
                      <span>{t('users.deviceName')}</span>
                    </div>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Clock size={13} style={{ color: '#f59e0b' }} />
                    <span>{t('users.remainingTime')}</span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                    {selectedClient.sessionTimeLeft || selectedClient.timeLeft || selectedClient.remainingTime || selectedClient.session_time_left || selectedClient.limitUptime || selectedClient.uptime}
                  </span>
                </div>
              )}

              {/* Profile Card */}
              {selectedClient.profile && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Layers size={13} style={{ color: '#a855f7' }} />
                    <span>{t('users.profile')}</span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary, #3b82f6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedClient.profile}
                  </span>
                </div>
              )}

              {/* Comment Card */}
              {selectedClient.comment && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <MessageSquare size={13} style={{ color: '#f59e0b' }} />
                    <span>{t('users.comment')}</span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedClient.comment}
                  </span>
                </div>
              )}

              {/* Traffic Cards */}
              {((selectedClient.rxBytes || selectedClient.bytesIn) || (selectedClient.txBytes || selectedClient.bytesOut)) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px'
                }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    padding: '7px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ArrowDownRight size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1 }}>{t('users.rxBytes')}</div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatBytes(selectedClient.rxBytes || selectedClient.bytesIn)}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '8px',
                    padding: '7px 9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ArrowUpRight size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1 }}>{t('users.txBytes')}</div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatBytes(selectedClient.txBytes || selectedClient.bytesOut)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Disconnect Action Button */}
              <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                {showDisconnectConfirm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '11.5px', color: '#ef4444', textAlign: 'center', fontWeight: 600 }}>
                      {t('users.confirmDisconnect')}
                    </p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        disabled={isDisconnecting}
                        style={{
                          flex: 1,
                          padding: '7px',
                          borderRadius: '8px',
                          border: '1px solid var(--glass-border)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--foreground)',
                          fontSize: '11.5px',
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
                          padding: '7px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          background: 'linear-gradient(135deg, rgba(239,68,68,0.8) 0%, rgba(220,38,38,0.9) 100%)',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        {isDisconnecting ? (
                          <>
                            <RefreshCw size={12} className="spin" />
                            <span>{t('users.disconnecting')}</span>
                          </>
                        ) : (
                          <>
                            <LogOut size={12} />
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
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <LogOut size={14} />
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