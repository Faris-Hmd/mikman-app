import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchIpBindingsAPI,
  fetchNetworkClientsAPI,
  addIpBindingAPI,
  removeIpBindingAPI,
  fetchPortForwardsAPI,
  addPortForwardAPI,
  removePortForwardAPI,
  PortForwardRule,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useVpnModal } from '../../context/VpnModalContext';
import WireguardIcon from '../../components/WireguardIcon';

import {
  Radio,
  RefreshCw,
  Search,
  X,
  Globe,
  Smartphone,
  Laptop,
  Printer,
  Tv,
  HardDrive,
  ArrowUpRight,
  Info,
  Lock,
  Copy,
  Check,
} from 'lucide-react';

export type DeviceCategory = 'mobile' | 'laptop' | 'ap' | 'printer' | 'tv' | 'other';

interface DeviceItem {
  id?: string;
  bindingId?: string;
  mac: string;
  ip?: string;
  isBypassed: boolean;
  category: DeviceCategory;
  comment?: string;
  name?: string;
  uptime?: string;
  isOnline: boolean;
  rawComment?: string;
}

const CATEGORY_MAP: Record<DeviceCategory, { labelKey: string; defaultLabel: string; icon: any; color: string; bg: string; border: string }> = {
  mobile: { labelKey: 'aps.mobile', defaultLabel: 'Mobile', icon: Smartphone, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.3) 100%)', border: 'rgba(59,130,246,0.25)' },
  laptop: { labelKey: 'aps.laptop', defaultLabel: 'Laptop', icon: Laptop, color: '#8b5cf6', bg: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.3) 100%)', border: 'rgba(139,92,246,0.25)' },
  ap: { labelKey: 'aps.ap', defaultLabel: 'Access Point', icon: Radio, color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.3) 100%)', border: 'rgba(16,185,129,0.25)' },
  printer: { labelKey: 'aps.printer', defaultLabel: 'Printer', icon: Printer, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.3) 100%)', border: 'rgba(245,158,11,0.25)' },
  tv: { labelKey: 'aps.tv', defaultLabel: 'Smart TV', icon: Tv, color: '#ec4899', bg: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(219,39,119,0.3) 100%)', border: 'rgba(236,72,153,0.25)' },
  other: { labelKey: 'aps.other', defaultLabel: 'Device', icon: HardDrive, color: '#6b7280', bg: 'linear-gradient(135deg, rgba(107,114,128,0.15) 0%, rgba(75,85,99,0.3) 100%)', border: 'rgba(107,114,128,0.25)' },
};

function normalizeMac(mac?: string): string {
  if (!mac) return '';
  return mac.toLowerCase().replace(/[^a-f0-9]/g, '');
}

function parseCategoryAndComment(commentStr?: string, nameStr?: string): { category: DeviceCategory; cleanComment: string } {
  const text = (commentStr || nameStr || '').trim();
  
  const tagMatch = text.match(/^\[(Mobile|Laptop|AP|Printer|TV|Other)\]\s*(.*)$/i);
  if (tagMatch) {
    const tag = tagMatch[1].toLowerCase();
    const cleanComment = tagMatch[2] || '';
    let category: DeviceCategory = 'other';
    if (tag === 'mobile') category = 'mobile';
    else if (tag === 'laptop') category = 'laptop';
    else if (tag === 'ap') category = 'ap';
    else if (tag === 'printer') category = 'printer';
    else if (tag === 'tv') category = 'tv';
    return { category, cleanComment };
  }

  const lower = text.toLowerCase();
  if (lower.includes('phone') || lower.includes('iphone') || lower.includes('android') || lower.includes('galaxy') || lower.includes('mobile')) {
    return { category: 'mobile', cleanComment: text };
  }
  if (lower.includes('laptop') || lower.includes('pc') || lower.includes('macbook') || lower.includes('desktop')) {
    return { category: 'laptop', cleanComment: text };
  }
  if (lower.includes('ap') || lower.includes('router') || lower.includes('tp-link') || lower.includes('access point') || lower.includes('wifi')) {
    return { category: 'ap', cleanComment: text };
  }
  if (lower.includes('printer') || lower.includes('hp') || lower.includes('epson') || lower.includes('canon')) {
    return { category: 'printer', cleanComment: text };
  }
  if (lower.includes('tv') || lower.includes('smarttv') || lower.includes('roku') || lower.includes('firestick')) {
    return { category: 'tv', cleanComment: text };
  }

  return { category: 'other', cleanComment: text };
}

export default function ApsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const { openVpnModal } = useVpnModal();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bypassed'>('all');
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);

  // Bypass Switch State
  const [isBypassSubmitting, setIsBypassSubmitting] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  // Port Forwarding State
  const [isPfSubmitting, setIsPfSubmitting] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);

  // Copy Feedback State
  const [copiedField, setCopiedField] = useState<'ip' | 'mac' | null>(null);

  const handleCopyField = (val: string, field: 'ip' | 'mac') => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fetch IP Bindings from RouterOS
  const { data: bindingsData, isLoading: isLoadingBindings, mutate: mutateBindings } = useSWR(
    routerId ? `router-ip-bindings-${routerId}` : null,
    () => fetchIpBindingsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  // Fetch Active Connected Clients / DHCP Leases / Hotspot Hosts
  const { data: clientsData, isLoading: isLoadingClients, mutate: mutateClients } = useSWR(
    routerId ? `router-network-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  // Fetch Active Port Forwarding / NAT rules for AP Web Access
  const { data: pfData, mutate: mutatePortForwards } = useSWR(
    routerId ? `router-port-forwards-${routerId}` : null,
    () => fetchPortForwardsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const portForwardMap = useMemo(() => {
    const map = new Map<string, PortForwardRule>();
    if (pfData?.portForwards && Array.isArray(pfData.portForwards)) {
      pfData.portForwards.forEach((pf) => {
        if (pf.toAddress) {
          map.set(pf.toAddress, pf);
        }
      });
    }
    return map;
  }, [pfData]);

  const routerVpnIp = pfData?.routerVpnIp || '';

  const getSuggestedPort = (targetPort: string | number = 443) => {
    const isSsl = String(targetPort) === '443';
    const usedPorts = new Set<number>();
    if (pfData?.portForwards && Array.isArray(pfData.portForwards)) {
      pfData.portForwards.forEach((pf) => {
        const p = parseInt(String(pf.dstPort), 10);
        if (!isNaN(p)) usedPorts.add(p);
      });
    }
    let p = isSsl ? 8443 : 8081;
    while (usedPorts.has(p)) {
      p++;
    }
    return p;
  };

  const getPortForwardUrl = (pf: PortForwardRule, host: string) => {
    const isHttps = String(pf.toPort) === '443' || String(pf.dstPort).startsWith('84') || String(pf.dstPort).endsWith('443');
    return `${isHttps ? 'https' : 'http'}://${host}:${pf.dstPort}`;
  };

  useEffect(() => {
    setPfError(null);
    setBypassError(null);
  }, [selectedDevice]);

  const handleEnablePortForward = async () => {
    if (!routerId || !selectedDevice?.ip) return;
    setIsPfSubmitting(true);
    setPfError(null);
    try {
      // 1. If device is not already bypassed, automatically bypass it first
      if (!selectedDevice.isBypassed && selectedDevice.mac) {
        const categoryTag = selectedDevice.category.charAt(0).toUpperCase() + selectedDevice.category.slice(1);
        const formattedComment = selectedDevice.comment
          ? `[${categoryTag}] ${selectedDevice.comment}`
          : `[${categoryTag}]`;

        await addIpBindingAPI(
          routerId,
          selectedDevice.mac,
          selectedDevice.ip,
          formattedComment,
          'bypassed'
        );
        setSelectedDevice(prev => prev ? { ...prev, isBypassed: true } : null);
        await mutateBindings();
      }

      // 2. Add port forwarding rule
      await addPortForwardAPI(routerId, {
        toAddress: selectedDevice.ip,
        toPort: 443,
        dstPort: getSuggestedPort(443),
        comment: selectedDevice.comment || selectedDevice.name || selectedDevice.mac,
      });
      await mutatePortForwards();
    } catch (err: any) {
      setPfError(err?.message || 'Failed to enable port forwarding');
    } finally {
      setIsPfSubmitting(false);
    }
  };

  const handleDisablePortForward = async () => {
    if (!routerId || !selectedDevice?.ip) return;
    const existing = portForwardMap.get(selectedDevice.ip);
    setIsPfSubmitting(true);
    setPfError(null);
    try {
      await removePortForwardAPI(routerId, existing?.id, selectedDevice.ip);
      await mutatePortForwards();
    } catch (err: any) {
      setPfError(err?.message || 'Failed to remove port forwarding');
    } finally {
      setIsPfSubmitting(false);
    }
  };

  const handleRefresh = () => {
    mutateBindings();
    mutateClients();
    mutatePortForwards();
  };

  // Compare & Merge IP Bindings with Active Devices List
  const allCombinedDevices = useMemo(() => {
    // 1. Process Active Clients
    let activeList: any[] = [];
    if (Array.isArray(clientsData)) {
      activeList = clientsData;
    } else if (clientsData && typeof clientsData === 'object') {
      if (Array.isArray((clientsData as any).clients)) activeList = (clientsData as any).clients;
      else if (Array.isArray((clientsData as any).active)) activeList = (clientsData as any).active;
      else if (Array.isArray((clientsData as any).hosts)) activeList = (clientsData as any).hosts;
      else if (Array.isArray((clientsData as any).data)) activeList = (clientsData as any).data;
    }

    const activeMap = new Map<string, any>();
    activeList.forEach(c => {
      const mac = c.mac || c['mac-address'] || c.macAddress;
      const normalized = normalizeMac(mac);
      if (normalized) {
        activeMap.set(normalized, c);
      }
    });

    // 2. Process IP Bindings
    let bindingRawList: any[] = [];
    if (Array.isArray(bindingsData)) {
      bindingRawList = bindingsData;
    } else if (bindingsData && typeof bindingsData === 'object') {
      if (Array.isArray((bindingsData as any).bindings)) bindingRawList = (bindingsData as any).bindings;
      else if (Array.isArray((bindingsData as any).data)) bindingRawList = (bindingsData as any).data;
    }

    const boundMap = new Map<string, any>();
    bindingRawList.forEach(item => {
      const mac = item.mac || item['mac-address'] || item.macAddress || '';
      const normalized = normalizeMac(mac);
      if (normalized) {
        boundMap.set(normalized, item);
      }
    });

    const combinedList: DeviceItem[] = [];
    const processedMacs = new Set<string>();

    // Add all active clients
    activeList.forEach(c => {
      const mac = c.mac || c['mac-address'] || c.macAddress || '';
      const normalized = normalizeMac(mac);
      if (!normalized || processedMacs.has(normalized)) return;
      processedMacs.add(normalized);

      const boundItem = boundMap.get(normalized);
      const isBypassed = boundItem ? ((boundItem.type || '').toLowerCase() === 'bypassed' || boundItem.bypassed === true) : false;
      const rawComment = (boundItem?.comment || boundItem?.name) || (c.comment || c.hostName || c.name || '');
      const { category, cleanComment } = parseCategoryAndComment(rawComment, c.hostName || boundItem?.name);

      combinedList.push({
        id: normalized,
        bindingId: boundItem?.id || boundItem?.['.id'],
        mac: mac,
        ip: boundItem?.ip || boundItem?.address || c.ip || c.address || c.ipAddress || '',
        isBypassed: isBypassed,
        category: category,
        comment: cleanComment,
        rawComment: rawComment,
        name: cleanComment || c.hostName || t('aps.networkDevice'),
        uptime: c.uptime || boundItem?.uptime,
        isOnline: true,
      });
    });

    // Add any bindings that are not active currently
    bindingRawList.forEach(item => {
      const mac = item.mac || item['mac-address'] || item.macAddress || '';
      const normalized = normalizeMac(mac);
      if (!normalized || processedMacs.has(normalized)) return;
      processedMacs.add(normalized);

      const isBypassed = (item.type || '').toLowerCase() === 'bypassed' || item.bypassed === true;
      const rawComment = item.comment || item.name || '';
      const { category, cleanComment } = parseCategoryAndComment(rawComment, item.name);

      combinedList.push({
        id: normalized,
        bindingId: item.id || item['.id'],
        mac: mac,
        ip: item.ip || item.address || item.ipAddress || '',
        isBypassed: isBypassed,
        category: category,
        comment: cleanComment,
        rawComment: rawComment,
        name: item.name || cleanComment,
        uptime: item.uptime,
        isOnline: false,
      });
    });

    return combinedList;
  }, [bindingsData, clientsData]);

  // Compute Stat Counters
  const stats = useMemo(() => {
    const total = allCombinedDevices.length;
    const bypassed = allCombinedDevices.filter(d => d.isBypassed).length;
    return { total, bypassed };
  }, [allCombinedDevices]);

  // Filtered devices list based on Search & Selected Filter Tab
  const filteredDevices = useMemo(() => {
    let list = allCombinedDevices;

    if (selectedFilter === 'bypassed') {
      list = list.filter(d => d.isBypassed);
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(d => {
      const ipMatch = (d.ip || '').toLowerCase().includes(term);
      const commentMatch = (d.comment || '').toLowerCase().includes(term);
      return ipMatch || commentMatch;
    });
  }, [allCombinedDevices, selectedFilter, searchTerm]);

  // Toggle Bypass Switch (ON / OFF)
  const handleToggleBypass = async () => {
    if (!routerId || !selectedDevice) return;
    setIsBypassSubmitting(true);
    setBypassError(null);
    try {
      if (selectedDevice.isBypassed) {
        // Switch OFF -> Remove binding
        const targetId = selectedDevice.bindingId || selectedDevice.id || selectedDevice.mac;
        await removeIpBindingAPI(routerId, targetId);

        // If device also has active port forwarding, remove port forward as well
        if (selectedDevice.ip && portForwardMap.has(selectedDevice.ip)) {
          const existingPf = portForwardMap.get(selectedDevice.ip);
          await removePortForwardAPI(routerId, existingPf?.id, selectedDevice.ip);
          await mutatePortForwards();
        }

        setSelectedDevice(prev => prev ? { ...prev, isBypassed: false, bindingId: undefined } : null);
      } else {
        // Switch ON -> Add bypassed binding
        const categoryTag = selectedDevice.category.charAt(0).toUpperCase() + selectedDevice.category.slice(1);
        const formattedComment = selectedDevice.comment
          ? `[${categoryTag}] ${selectedDevice.comment}`
          : `[${categoryTag}]`;

        await addIpBindingAPI(
          routerId,
          selectedDevice.mac,
          selectedDevice.ip || '',
          formattedComment,
          'bypassed'
        );
        setSelectedDevice(prev => prev ? { ...prev, isBypassed: true } : null);
      }
      handleRefresh();
    } catch (err: any) {
      console.error('Failed to toggle bypass:', err);
      setBypassError(err?.message || 'Failed to update bypass');
    } finally {
      setIsBypassSubmitting(false);
    }
  };

  const renderCategoryIcon = (category: DeviceCategory, size = 16) => {
    const config = CATEGORY_MAP[category] || CATEGORY_MAP.other;
    const IconComp = config.icon;
    return <IconComp size={size} style={{ color: config.color }} />;
  };

  const isLoading = isLoadingBindings || isLoadingClients;

  return (
    <div
      className="responsive-container"
      style={{
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* ─── 1. Page Header ─── */}
      <div className="page-header-card" style={{ padding: '8px 12px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            className="page-header-icon"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Laptop size={15} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="page-header-title" style={{ fontSize: '15px' }}>
              {t('aps.title')}
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="page-header-btn"
            style={{ padding: '4px 8px', fontSize: '11px', height: '28px' }}
            title="Refresh"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hide-sm-only" style={{ whiteSpace: 'nowrap' }}>{t('common.refresh') || 'تحديث'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Compact Filter Strip (All / Bypassed) ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
        {[
          { key: 'all', label: t('common.all') || 'All', count: stats.total, color: '#3b82f6' },
          { key: 'bypassed', label: t('aps.statBypassed') || 'Bypassed', count: stats.bypassed, color: '#10b981' },
        ].map(tab => {
          const isSelected = selectedFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedFilter(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 11px',
                borderRadius: '20px',
                border: isSelected ? `1px solid ${tab.color}` : '1px solid var(--glass-border)',
                background: isSelected ? `${tab.color}20` : 'var(--card-bg)',
                color: isSelected ? tab.color : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: isSelected ? `${tab.color}35` : 'rgba(255, 255, 255, 0.06)',
                color: isSelected ? tab.color : 'var(--foreground)',
                fontWeight: 700
              }}>
                {isLoading ? '—' : tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── 3. Search Bar ─── */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search
          size={13}
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
          placeholder={t('aps.searchPlaceholder') || 'Search devices...'}
          style={{
            width: '100%',
            padding: `6px ${isRtl ? '28px' : '28px'} 6px ${isRtl ? '28px' : '28px'}`,
            background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '8px',
            color: 'var(--foreground)',
            fontSize: '11px',
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
            <X size={12} />
          </button>
        )}
      </div>

      {/* ─── 4. Devices List (Green border if forwarded AND bypassed) ─── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className="skeleton"
              style={{
                height: '56px',
                borderRadius: '10px',
                width: '100%'
              }}
            />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div style={{
          background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          padding: '36px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <Radio size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
              {t('aps.noApsFound')}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '320px' }}>
              {t('aps.noApsDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="list-container">
          {filteredDevices.map(device => {
            const catConfig = CATEGORY_MAP[device.category] || CATEGORY_MAP.other;
            const CategoryIcon = catConfig.icon;
            const isForwarded = Boolean(device.ip && portForwardMap.has(device.ip));
            const showGreenBorder = isForwarded && device.isBypassed;

            return (
              <div
                key={device.id || device.mac}
                onClick={() => setSelectedDevice(device)}
                className="list-item-card hover-card"
                style={{
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: 'pointer',
                  border: showGreenBorder
                    ? '1.5px solid rgba(16, 185, 129, 0.7)'
                    : undefined,
                  background: showGreenBorder
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--card-bg) 100%)'
                    : undefined,
                  boxShadow: showGreenBorder
                    ? '0 0 10px rgba(16, 185, 129, 0.15)'
                    : undefined,
                }}
              >
                {/* Left: Category Icon & Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  {/* Avatar Icon + Online Pulse Dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      className="item-icon"
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: catConfig.bg,
                        color: catConfig.color,
                        border: `1px solid ${catConfig.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <CategoryIcon size={13} />
                    </div>
                    <span style={{
                      position: 'absolute',
                      bottom: '-1px',
                      [isRtl ? 'left' : 'right']: '-1px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: device.isOnline ? '#10b981' : '#6b7280',
                      border: '1.5px solid var(--card-bg, #1a1a1a)',
                      boxShadow: device.isOnline ? '0 0 4px rgba(16,185,129,0.8)' : 'none'
                    }} />
                  </div>

                  {/* Name & IP only */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong className="item-title" style={{
                      fontSize: '12.5px',
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      {device.comment || device.name || t('aps.networkDevice')}
                    </strong>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'nowrap' }}>
                      {device.ip ? (
                        <span className="item-subtext" style={{ fontSize: '10.5px', color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>
                          {device.ip}
                        </span>
                      ) : (
                        <span className="item-subtext" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {t(catConfig.labelKey) || catConfig.defaultLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Bypassed Badge (if active) & Info Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {device.isBypassed && (
                    <span className="item-badge" style={{
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      whiteSpace: 'nowrap'
                    }}>
                      {t('aps.statBypassed') || 'Bypassed'}
                    </span>
                  )}

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
      )}

      {/* ─── 5. Consolidated Clean Single Device Modal ─── */}
      {selectedDevice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="responsive-card" style={{
            width: '100%',
            maxWidth: '360px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--glass-bg, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {renderCategoryIcon(selectedDevice.category, 16)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedDevice.comment || selectedDevice.name || t('aps.networkDevice')}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span>{CATEGORY_MAP[selectedDevice.category]?.defaultLabel}</span>
                    <span>•</span>
                    <span style={{ color: selectedDevice.isOnline ? '#10b981' : '#6b7280', fontWeight: 600 }}>
                      {selectedDevice.isOnline ? t('aps.online') || 'Online' : t('aps.offline') || 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDevice(null)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error alerts */}
            {(bypassError || pfError) && (
              <div style={{ padding: '7px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '11px' }}>
                {bypassError || pfError}
              </div>
            )}

            {/* Device Network Info: IP & MAC Address Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* IP Address Row */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Globe size={13} style={{ color: '#3b82f6' }} />
                  <span>{t('aps.ipAddress') || 'IP Address'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: selectedDevice.ip ? '#3b82f6' : 'var(--text-muted)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedDevice.ip || '—'}
                  </span>
                  {selectedDevice.ip && (
                    <button
                      type="button"
                      onClick={() => handleCopyField(selectedDevice.ip!, 'ip')}
                      title={copiedField === 'ip' ? (t('common.copied') || 'Copied!') : (t('aps.copyIp') || 'Copy IP')}
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
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copiedField === 'ip' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
              </div>

              {/* MAC Address Row */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Laptop size={13} style={{ color: '#8b5cf6' }} />
                  <span>{t('aps.macAddress') || 'MAC Address'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedDevice.mac || '—'}
                  </span>
                  {selectedDevice.mac && (
                    <button
                      type="button"
                      onClick={() => handleCopyField(selectedDevice.mac, 'mac')}
                      title={copiedField === 'mac' ? (t('common.copied') || 'Copied!') : (t('aps.copyMac') || 'Copy MAC')}
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
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copiedField === 'mac' ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Block: Bypass Toggle Switch & Port Forward Toggle Switch */}
            {(() => {
              const isSelectedForwarded = Boolean(selectedDevice.ip && portForwardMap.has(selectedDevice.ip));
              const selectedActivePf = selectedDevice.ip ? portForwardMap.get(selectedDevice.ip) : undefined;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* 1. Bypass Toggle Switch Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {t('aps.statBypassed') || 'Bypass'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {selectedDevice.isBypassed ? (t('aps.bypassed') || 'No login required') : (t('aps.regular') || 'Requires Hotspot login')}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selectedDevice.isBypassed}
                      onClick={handleToggleBypass}
                      disabled={isBypassSubmitting}
                      style={{
                        width: '42px',
                        height: '24px',
                        borderRadius: '12px',
                        background: selectedDevice.isBypassed ? '#10b981' : 'rgba(255, 255, 255, 0.15)',
                        border: 'none',
                        position: 'relative',
                        cursor: isBypassSubmitting ? 'wait' : 'pointer',
                        transition: 'background 0.2s ease',
                        padding: 0,
                        flexShrink: 0
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        left: !isRtl ? (selectedDevice.isBypassed ? '20px' : '2px') : 'auto',
                        right: isRtl ? (selectedDevice.isBypassed ? '20px' : '2px') : 'auto',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>

                  {/* 2. Port Forward Toggle Switch Row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {t('aps.portForwarding') || 'Port Forward'}
                      </span>
                      {selectedDevice.ip ? (
                        isSelectedForwarded && selectedActivePf ? (
                          <span style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                            Port {selectedActivePf.dstPort} &rarr; {selectedActivePf.toPort || 443}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {t('aps.portForwardSubtitle') || 'Remote Web GUI Access (VPN)'}
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {t('aps.noIpAssigned') || 'No IP assigned'}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSelectedForwarded}
                      onClick={isSelectedForwarded ? handleDisablePortForward : handleEnablePortForward}
                      disabled={isPfSubmitting || !selectedDevice.ip}
                      style={{
                        width: '42px',
                        height: '24px',
                        borderRadius: '12px',
                        background: isSelectedForwarded ? '#3b82f6' : 'rgba(255, 255, 255, 0.15)',
                        border: 'none',
                        position: 'relative',
                        cursor: (isPfSubmitting || !selectedDevice.ip) ? (isPfSubmitting ? 'wait' : 'not-allowed') : 'pointer',
                        opacity: !selectedDevice.ip ? 0.5 : 1,
                        transition: 'background 0.2s ease, opacity 0.2s ease',
                        padding: 0,
                        flexShrink: 0
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        left: !isRtl ? (isSelectedForwarded ? '20px' : '2px') : 'auto',
                        right: isRtl ? (isSelectedForwarded ? '20px' : '2px') : 'auto',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }} />
                    </button>
                  </div>

                  {/* 3. When Port Forward is ON: Web GUI Link & VPN Requirement Message */}
                  {isSelectedForwarded && selectedActivePf && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          window.open(getPortForwardUrl(selectedActivePf, routerVpnIp), '_blank');
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)',
                          color: '#10b981',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Globe size={13} />
                        <span>{t('aps.openWebGui') || 'Open Web GUI'}</span>
                        <ArrowUpRight size={13} />
                      </button>

                      {/* WireGuard VPN Requirement Warning Notice */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'rgba(234, 179, 8, 0.1)',
                          border: '1px solid rgba(234, 179, 8, 0.25)',
                          color: '#eab308',
                          fontSize: '11px',
                          lineHeight: 1.4,
                        }}
                      >
                        <WireguardIcon size={16} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, marginBottom: '2px', color: '#facc15' }}>
                            {t('aps.vpnRequiredTitle') || 'WireGuard VPN Required'}
                          </div>
                          <div style={{ color: 'var(--foreground)', opacity: 0.9 }}>
                            {t('aps.vpnRequiredNotice') || 'You must be connected to the WireGuard VPN to access the forwarded Web GUI.'}
                          </div>
                          <button
                            type="button"
                            onClick={() => openVpnModal(routerVpnIp)}
                            style={{
                              marginTop: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.35)',
                              color: '#facc15',
                              borderRadius: '5px',
                              padding: '3px 8px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Lock size={11} />
                            <span>{t('sidebar.vpnAccess') || 'VPN Access'}</span>
                            <span>&rarr;</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}