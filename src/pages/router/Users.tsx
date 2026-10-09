import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchNetworkClientsAPI,
  removeActiveSessionAPI,
  fetchRouterInterfacesAPI,
  fetchRouterProfilesWithUserAPI,
  fetchIpBindingsAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import {
  NetworkClient,
  formatBytes,
  getSignalColor,
  getLeaseDeviceName,
  getRemainingTime,
  getRemainingBytes,
  checkIsSignedUser,
  getClientApName,
  resolveClientPortAndAp,
} from '../../lib/clientPortDetection';

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
  Activity,
  MessageSquare,
  Radio,
  Network,
  Database,
  Tag,
} from 'lucide-react';

export default function UsersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portParam = searchParams.get('port');
  const { t, isRtl } = useLanguage();

  const [activeTab, setActiveTab] = useState<'signedIn' | 'waiting' | 'all'>('signedIn');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState<'port' | 'profile'>('port');
  const [selectedPortFilter, setSelectedPortFilter] = useState<string>(portParam || 'all');
  const [selectedClient, setSelectedClient] = useState<NetworkClient | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    if (portParam) {
      setSelectedPortFilter(portParam);
    }
  }, [portParam]);

  // Fetch router interfaces to get live portApMap
  const { data: ifaceData } = useSWR(
    routerId ? `router-interfaces-${routerId}` : null,
    () => fetchRouterInterfacesAPI(routerId!),
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );

  // Fetch IP Bindings to match AP devices and bypassed comments
  const { data: bindingsData } = useSWR(
    routerId ? `router-ip-bindings-${routerId}` : null,
    () => fetchIpBindingsAPI(routerId!),
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );

  // Manual device-to-port assignments saved by the admin in this browser session/localStorage
  const [clientPortOverrides, setClientPortOverrides] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem(`@router_client_ports_${routerId}`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Fetch router profiles to fallback for portApMap
  const { data: profilesResponse } = useSWR(
    'router-profiles-with-user',
    fetchRouterProfilesWithUserAPI,
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );

  const portApMap = useMemo(() => {
    let map: Record<string, string> = {};
    try {
      const cached = localStorage.getItem(`@router_port_map_${routerId}`);
      if (cached) map = { ...map, ...JSON.parse(cached) };
    } catch {}

    const profiles = Array.isArray(profilesResponse) ? profilesResponse : profilesResponse?.profiles || [];
    const currentProfile = profiles.find((p: any) => p.id === routerId);
    if (currentProfile?.portApMap && typeof currentProfile.portApMap === 'object') {
      map = { ...map, ...currentProfile.portApMap };
    }

    if (ifaceData?.portApMap && typeof ifaceData.portApMap === 'object') {
      map = { ...map, ...ifaceData.portApMap };
    }
    return map;
  }, [routerId, profilesResponse, ifaceData]);

  const bindingsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(bindingsData)) {
      bindingsData.forEach((b: any) => {
        const comment = (b.comment || '').toLowerCase().trim();
        const mac = (b.macAddress || b.mac || '').toLowerCase().replace(/[^a-f0-9]/g, '');
        const ip = (b.address || b.ip || '').trim();

        // Check if binding comment matches a port in portApMap
        let matchedPort = '';
        for (const [k, v] of Object.entries(portApMap)) {
          if (k !== 'bridge' && k !== 'all') {
            const cleanK = k.toLowerCase().trim();
            const cleanV = (v || '').toLowerCase().trim();
            if ((cleanV && comment.includes(cleanV)) || (cleanK && comment.includes(cleanK))) {
              matchedPort = k;
              break;
            }
          }
        }

        if (matchedPort) {
          if (mac) map.set(mac, matchedPort);
          if (ip) map.set(ip, matchedPort);
        }
      });
    }
    return map;
  }, [bindingsData, portApMap]);

  const { data: clients, isLoading, mutate } = useSWR(
    routerId ? `router-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const rawClientList: NetworkClient[] = useMemo(() => {
    let list: any[] = [];
    if (Array.isArray(clients)) list = clients;
    else if (clients && typeof clients === 'object') {
      if (Array.isArray((clients as any).clients)) list = (clients as any).clients;
      else if (Array.isArray((clients as any).data)) list = (clients as any).data;
    }

    return list.map((c: any) => {
      const res = resolveClientPortAndAp(c, portApMap, clientPortOverrides, bindingsMap);
      return {
        ...c,
        port: res.port || '',
        apName: res.apName || '',
        dhcpServer: res.dhcpServer || c.dhcpServer || c.server || '',
        dhcpHostName: res.dhcpHostName || c.hostName || c['host-name'] || '',
        agentCircuitId: res.agentCircuitId || c.agentCircuitId || c['agent-circuit-id'] || '',
        detectionSource: res.detectionSource,
      };
    });
  }, [clients, portApMap, clientPortOverrides, bindingsMap]);

  // Extract distinct ports & their assigned APs from active clients and router interfaces
  const availablePorts = useMemo(() => {
    const map = new Map<string, { port: string; apName?: string; count: number; isWireless?: boolean }>();

    // Seed with known router interfaces (excluding generic bridge)
    const ifaces = ifaceData?.interfaces || [];
    ifaces.forEach((iface: any) => {
      const p = (iface.name || '').trim();
      if (p && p !== 'bridge' && !map.has(p)) {
        const ap = iface.apName || portApMap[p] || '';
        const isWireless = iface.type === 'wlan' || p.startsWith('wlan') || p.startsWith('wifi');
        map.set(p, {
          port: p,
          apName: ap,
          count: 0,
          isWireless,
        });
      }
    });

    // Seed with any configured ports in portApMap (excluding bridge)
    Object.entries(portApMap).forEach(([p, ap]) => {
      if (p && p !== 'bridge' && !map.has(p)) {
        const isWireless = p.startsWith('wlan') || p.startsWith('wifi');
        map.set(p, {
          port: p,
          apName: ap || '',
          count: 0,
          isWireless,
        });
      }
    });

    // Count clients for each port
    rawClientList.forEach((c) => {
      const p = c.port || (c.isWireless ? 'wlan1' : '');
      if (p && p !== 'bridge') {
        const ap = c.apName || portApMap[p] || '';
        const existing = map.get(p);
        if (existing) {
          existing.count += 1;
          if (!existing.apName && ap) existing.apName = ap;
        } else {
          map.set(p, {
            port: p,
            apName: ap,
            count: 1,
            isWireless: c.isWireless || p.startsWith('wlan') || p.startsWith('wifi'),
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const isEthA = a.port.startsWith('ether');
      const isEthB = b.port.startsWith('ether');
      if (isEthA && !isEthB) return -1;
      if (!isEthA && isEthB) return 1;
      return a.port.localeCompare(b.port, undefined, { numeric: true });
    });
  }, [rawClientList, portApMap, ifaceData]);

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

    if (selectedPortFilter !== 'all') {
      const targetFilter = selectedPortFilter.toLowerCase().trim();
      list = list.filter((c) => {
        const p = (c.port || (c.isWireless ? 'wlan1' : '')).toLowerCase().trim();
        const ap = (c.apName || portApMap[c.port || ''] || '').toLowerCase().trim();
        const mappedAp = (portApMap[selectedPortFilter] || '').toLowerCase().trim();

        return (
          p === targetFilter ||
          ap === targetFilter ||
          (mappedAp && ap === mappedAp) ||
          p.includes(targetFilter) ||
          ap.includes(targetFilter)
        );
      });
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(c => {
      const devName = getLeaseDeviceName(c).toLowerCase();
      const ipMatch = (c.ip || '').toLowerCase().includes(term);
      const profileMatch = (c.profile || '').toLowerCase().includes(term);
      const portMatch = (c.port || '').toLowerCase().includes(term);
      const apMatch = (c.apName || '').toLowerCase().includes(term);
      return devName.includes(term) || ipMatch || profileMatch || portMatch || apMatch;
    });
  }, [currentTabList, selectedPortFilter, searchTerm, portApMap]);

  // Group clients by either connected Port/AP OR Profile
  const clientGroups = useMemo(() => {
    if (groupBy === 'port') {
      const map = new Map<string, { key: string; title: string; iconType: 'ap' | 'wifi' | 'ether'; port?: string; clients: NetworkClient[] }>();

      filteredClients.forEach((client) => {
        const portName = client.port || (client.isWireless ? 'wlan1' : '');
        const apName = client.apName || (portName && portApMap[portName] ? portApMap[portName] : '') || getClientApName(client, portName, portApMap) || '';

        const isUnassigned = !portName || portName === 'bridge' || portName === 'unknown' || portName === 'all';

        const key = isUnassigned
          ? 'unassigned'
          : (portName && apName ? `${portName}_${apName}` : portName || apName);

        let title = '';
        let iconType: 'ap' | 'wifi' | 'ether' = 'ether';

        if (isUnassigned) {
          title = t('users.noPortDetected') || 'غير محدد / منفذ عام';
          iconType = 'ether';
        } else if (apName && portName) {
          title = `${apName} (${portName})`;
          iconType = portName.startsWith('wlan') || portName.startsWith('wifi') ? 'wifi' : 'ap';
        } else if (apName) {
          title = apName;
          iconType = 'ap';
        } else if (portName) {
          const isWifi = portName.startsWith('wlan') || portName.startsWith('wifi') || client.isWireless;
          title = isWifi ? `Wi-Fi (${portName})` : portName;
          iconType = isWifi ? 'wifi' : 'ether';
        }

        if (!map.has(key)) {
          map.set(key, {
            key,
            title,
            iconType,
            port: isUnassigned ? '' : portName,
            clients: [],
          });
        }
        map.get(key)!.clients.push(client);
      });

      return Array.from(map.values()).sort((a, b) => {
        if (a.key === 'unassigned') return 1;
        if (b.key === 'unassigned') return -1;
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
  }, [filteredClients, groupBy, portApMap, t]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAssignClientPort = (client: NetworkClient, targetPort: string) => {
    if (!routerId || !client) return;
    const cleanMac = (client.mac || '').toLowerCase().replace(/[^a-f0-9]/g, '');
    const cleanIp = (client.ip || '').trim();
    const cleanUser = (client.user || '').trim();

    setClientPortOverrides((prev) => {
      const updated = { ...prev };
      if (!targetPort || targetPort === 'auto') {
        if (cleanMac) delete updated[cleanMac];
        if (cleanIp) delete updated[cleanIp];
        if (cleanUser) delete updated[cleanUser];
      } else {
        if (cleanMac) updated[cleanMac] = targetPort;
        if (cleanIp) updated[cleanIp] = targetPort;
        if (cleanUser) updated[cleanUser] = targetPort;
      }
      try {
        localStorage.setItem(`@router_client_ports_${routerId}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save client port override:', e);
      }
      return updated;
    });

    setSelectedClient((prev) => {
      if (!prev) return null;
      const ap = portApMap[targetPort] || '';
      return {
        ...prev,
        port: targetPort,
        apName: ap,
      };
    });
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Port & AP Settings Link Button */}
          <button
            onClick={() => navigate(`/${routerId}/settings#ports`)}
            title={t('users.assignAps') || 'Port & AP Settings'}
            className="page-header-btn page-header-btn-primary"
          >
            <Radio size={14} />
            <span>{t('users.assignAps') || 'تسمية وتعيين المنافذ'}</span>
            <ArrowUpRight size={13} />
          </button>

          <button
            onClick={() => mutate()}
            className="page-header-btn"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hide-sm-only" style={{ whiteSpace: 'nowrap' }}>{t('common.refresh') || 'تحديث'}</span>
          </button>
        </div>
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
                background: groupBy === 'port' ? 'var(--primary, #3b82f6)' : 'transparent',
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

        {/* Active Port Filter Indicator Tag */}
        {selectedPortFilter !== 'all' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '6px 10px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <Radio size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('users.filterByPort') || 'تصفية حسب المنفذ'}:{' '}
                <strong style={{ color: '#3b82f6' }}>
                  {portApMap[selectedPortFilter] ? `${portApMap[selectedPortFilter]} (${selectedPortFilter})` : selectedPortFilter}
                </strong>
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedPortFilter('all');
                navigate(`/${routerId}/users`, { replace: true });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: 'none',
                color: '#3b82f6',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <X size={11} />
              <span>{t('users.clearFilter') || 'عرض كل المنافذ'}</span>
            </button>
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
                height: '60px',
                borderRadius: '10px',
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
              ? { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.25)', color: '#3b82f6', Icon: Radio }
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
                    const leaseDeviceName = getLeaseDeviceName(client, t('aps.networkDevice') || 'Device');
                    const sigStyle = getSignalColor(client.signal);

                    const remainingTime = getRemainingTime(client);
                    const remainingBytes = getRemainingBytes(client);

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
                        {/* Left: Device Avatar & Lease Device Name (IP hidden) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
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

                          {/* Primary Lease Device Name (PIN and IP hidden) */}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong
                              title={leaseDeviceName}
                              className="item-title"
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: 'var(--foreground)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block'
                              }}
                            >
                              {leaseDeviceName}
                            </strong>

                            {client.apName && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px', fontSize: '10px', color: '#3b82f6' }}>
                                <Radio size={9} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.apName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Profile Badge, Remaining Data & Remaining Time (Aligned together) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          flexShrink: 0
                        }}>
                          {/* Profile Badge Slot (Aligned with data & time) */}
                          {client.profile && (
                            <span
                              className="item-badge"
                              title={`${t('users.profile')}: ${client.profile}`}
                              style={{
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: '#818cf8',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                fontSize: '9.5px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '5px',
                                height: '19px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                                boxSizing: 'border-box',
                              }}
                            >
                              <Layers size={10} style={{ flexShrink: 0 }} />
                              <span>{client.profile}</span>
                            </span>
                          )}

                          {!isSignedUser && (
                            <span
                              className="item-badge"
                              style={{
                                background: 'rgba(245, 158, 11, 0.12)',
                                color: '#fbbf24',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                fontSize: '9.5px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '5px',
                                height: '19px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Clock size={10} style={{ flexShrink: 0 }} />
                              <span>{t('users.waiting')}</span>
                            </span>
                          )}

                          {/* Remaining Data Badge */}
                          {remainingBytes !== null && (
                            <div
                              title={`${t('users.remainingData') || 'Remaining Data'}: ${formatBytes(remainingBytes)}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#10b981',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                padding: '1px 5px',
                                borderRadius: '5px',
                                height: '19px',
                                whiteSpace: 'nowrap',
                                boxSizing: 'border-box'
                              }}
                            >
                              <Database size={9.5} style={{ flexShrink: 0 }} />
                              <span>{formatBytes(remainingBytes)}</span>
                            </div>
                          )}

                          {/* Remaining Time Badge */}
                          {remainingTime && (
                            <div
                              title={`${t('users.remainingTime') || 'Remaining Time'}: ${remainingTime}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                padding: '1px 5px',
                                borderRadius: '5px',
                                height: '19px',
                                whiteSpace: 'nowrap',
                                boxSizing: 'border-box'
                              }}
                            >
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
                    {getLeaseDeviceName(selectedClient, 'Unnamed Device')}
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

              {/* Remaining Time Card */}
              {getRemainingTime(selectedClient) && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#f59e0b', flexShrink: 0 }}>
                    <Clock size={13} />
                    <span>{t('users.remainingTime')}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', whiteSpace: 'nowrap' }}>
                    {getRemainingTime(selectedClient)}
                  </span>
                </div>
              )}

              {/* Remaining Data Card */}
              {getRemainingBytes(selectedClient) !== null && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#10b981', flexShrink: 0 }}>
                    <Database size={13} />
                    <span>{t('users.remainingData') || 'Remaining Data'}</span>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                    {formatBytes(getRemainingBytes(selectedClient)!)}
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

              {/* Connected Port / AP & Manual Assignment */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#3b82f6', flexShrink: 0 }}>
                    {selectedClient.apName ? (
                      <Radio size={13} style={{ color: '#3b82f6' }} />
                    ) : selectedClient.isWireless ? (
                      <Wifi size={13} style={{ color: '#10b981' }} />
                    ) : (
                      <Network size={13} style={{ color: '#3b82f6' }} />
                    )}
                    <span>{t('users.connectedTo') || 'متصل عبر'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                    {selectedClient.apName ? (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedClient.apName}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 4px' }}>
                          ({selectedClient.port || 'Port'})
                        </span>
                      </span>
                    ) : (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                        {selectedClient.isWireless
                          ? `Wi-Fi (${selectedClient.port || 'wlan1'})`
                          : (selectedClient.port || t('users.noPortDetected') || 'غير محدد')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Interactive Port / AP Assignment Dropdown */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(59, 130, 246, 0.15)',
                }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {t('users.assignPortLabel') || 'تعيين المنفذ / AP:'}
                  </span>
                  <select
                    value={selectedClient.port || ''}
                    onChange={(e) => handleAssignClientPort(selectedClient, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'var(--card-bg, rgba(0, 0, 0, 0.2))',
                      color: 'var(--foreground)',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">{t('users.autoDetected') || 'تلقائي (حسب الراوتر)'}</option>
                    {availablePorts.filter(p => p.port && p.port !== 'bridge').map((p) => (
                      <option key={p.port} value={p.port}>
                        {p.port} {p.apName ? `(${p.apName})` : p.isWireless ? '(Wi-Fi)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DHCP Lease Info Card */}
              {(selectedClient.dhcpServer || selectedClient.dhcpHostName || selectedClient.agentCircuitId || selectedClient.detectionSource) && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      <Database size={13} style={{ color: '#06b6d4' }} />
                      <span>{t('users.dhcpServer') || 'خادم DHCP'}</span>
                    </div>
                    {selectedClient.dhcpServer && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
                        {selectedClient.dhcpServer}
                      </span>
                    )}
                  </div>

                  {selectedClient.dhcpHostName && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '10.5px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('users.dhcpHostName') || 'اسم الجهاز في DHCP'}:</span>
                      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{selectedClient.dhcpHostName}</span>
                    </div>
                  )}

                  {selectedClient.agentCircuitId && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '10.5px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('users.dhcpCircuitId') || 'معرف المنفذ / AP'}:</span>
                      <span style={{ color: 'var(--foreground)', fontFamily: 'monospace' }}>{selectedClient.agentCircuitId}</span>
                    </div>
                  )}

                  {selectedClient.detectionSource && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', fontSize: '10px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('users.detectionSource') || 'طريقة التعرف'}:</span>
                      <span style={{
                        color: selectedClient.detectionSource === 'override' ? '#a855f7' : selectedClient.detectionSource === 'wireless' ? '#10b981' : '#3b82f6',
                        fontWeight: 600,
                        background: 'rgba(255,255,255,0.05)',
                        padding: '1px 5px',
                        borderRadius: '4px'
                      }}>
                        {selectedClient.detectionSource === 'override' ? t('users.detectedViaOverride') || 'تعيين يدوي' :
                         selectedClient.detectionSource === 'option82' ? t('users.detectedViaOption82') || 'Option 82' :
                         selectedClient.detectionSource === 'dhcp-server' ? t('users.detectedViaServer') || 'خادم DHCP' :
                         selectedClient.detectionSource === 'bridge-port' ? t('users.detectedViaBridge') || 'منفذ الجسر' :
                         selectedClient.detectionSource === 'wireless' ? t('users.detectedViaWifi') || 'واجهة Wi-Fi' :
                         selectedClient.detectionSource === 'binding' ? t('users.detectedViaBinding') || 'ربط IP' :
                         t('users.detectedViaDhcp') || 'عقد DHCP'}
                      </span>
                    </div>
                  )}
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

              {/* Traffic Used Cards (Modal Only) */}
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
                          border: 'none',
                          background: '#ef4444',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isDisconnecting ? t('users.disconnecting') : t('users.disconnectUser')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.2s'
                    }}
                  >
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