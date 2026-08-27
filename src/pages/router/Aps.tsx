import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchIpBindingsAPI, fetchNetworkClientsAPI, addIpBindingAPI, removeIpBindingAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

import {
  Radio,
  RefreshCw,
  Search,
  Plus,
  X,
  Globe,
  Activity,
  Copy,
  Check,
  Trash2,
  Shield,
  MessageSquare,
  Server,
  Layers,
  Smartphone,
  Laptop,
  Printer,
  Tv,
  HardDrive,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowUpRight,
  Info
} from 'lucide-react';

export type DeviceCategory = 'mobile' | 'laptop' | 'ap' | 'printer' | 'tv' | 'other';

interface DeviceItem {
  id?: string;
  mac: string;
  ip?: string;
  type: 'bypassed' | 'regular' | 'blocked' | 'unbound';
  category: DeviceCategory;
  comment?: string;
  disabled?: boolean;
  name?: string;
  uptime?: string;
  isOnline: boolean;
  isBound: boolean;
  rawComment?: string;
}

const CATEGORY_MAP: Record<DeviceCategory, { labelKey: string; defaultLabel: string; icon: any; color: string; bg: string; border: string }> = {
  mobile: { labelKey: 'aps.mobile', defaultLabel: 'Mobile / Phone', icon: Smartphone, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.3) 100%)', border: 'rgba(59,130,246,0.25)' },
  laptop: { labelKey: 'aps.laptop', defaultLabel: 'Laptop / PC', icon: Laptop, color: '#8b5cf6', bg: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.3) 100%)', border: 'rgba(139,92,246,0.25)' },
  ap: { labelKey: 'aps.ap', defaultLabel: 'Access Point / Router', icon: Radio, color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.3) 100%)', border: 'rgba(16,185,129,0.25)' },
  printer: { labelKey: 'aps.printer', defaultLabel: 'Printer', icon: Printer, color: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.3) 100%)', border: 'rgba(245,158,11,0.25)' },
  tv: { labelKey: 'aps.tv', defaultLabel: 'Smart TV', icon: Tv, color: '#ec4899', bg: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(219,39,119,0.3) 100%)', border: 'rgba(236,72,153,0.25)' },
  other: { labelKey: 'aps.other', defaultLabel: 'Other Device', icon: HardDrive, color: '#6b7280', bg: 'linear-gradient(135deg, rgba(107,114,128,0.15) 0%, rgba(75,85,99,0.3) 100%)', border: 'rgba(107,114,128,0.25)' },
};

function normalizeMac(mac?: string): string {
  if (!mac) return '';
  return mac.toLowerCase().replace(/[^a-f0-9]/g, '');
}

function parseCategoryAndComment(commentStr?: string, nameStr?: string): { category: DeviceCategory; cleanComment: string } {
  const text = (commentStr || nameStr || '').trim();
  
  // Check for explicit tag like [Mobile], [Laptop], [AP], [Printer], [TV], [Other]
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

  // Auto-detect based on text keywords
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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bypassed' | 'regular' | 'blocked' | 'unbound'>('all');
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [newMac, setNewMac] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newType, setNewType] = useState<'bypassed' | 'regular' | 'blocked'>('bypassed');
  const [newCategory, setNewCategory] = useState<DeviceCategory>('mobile');
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleRefresh = () => {
    mutateBindings();
    mutateClients();
  };

  // Compare & Merge IP Bindings with Active Devices List
  const { deviceList, activeUnboundList } = useMemo(() => {
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

    const boundMacSet = new Set<string>();
    const boundDevices: DeviceItem[] = bindingRawList.map(item => {
      const mac = item.mac || item['mac-address'] || item.macAddress || '';
      const normalized = normalizeMac(mac);
      if (normalized) boundMacSet.add(normalized);

      const activeMatch = normalized ? activeMap.get(normalized) : null;
      const rawComment = item.comment || item.name || '';
      const { category, cleanComment } = parseCategoryAndComment(rawComment, item.name);

      let bType: 'bypassed' | 'regular' | 'blocked' = 'regular';
      const rawType = (item.type || '').toLowerCase();
      if (rawType === 'bypassed' || item.bypassed) bType = 'bypassed';
      else if (rawType === 'blocked') bType = 'blocked';

      return {
        id: item.id || item['.id'] || mac,
        mac: mac,
        ip: item.ip || item['address'] || item.ipAddress || (activeMatch ? (activeMatch.ip || activeMatch.address) : ''),
        type: bType,
        category: category,
        comment: cleanComment,
        rawComment: rawComment,
        disabled: item.disabled === true || item.disabled === 'true',
        name: item.name || cleanComment,
        uptime: item.uptime || (activeMatch ? activeMatch.uptime : undefined),
        isOnline: !!activeMatch,
        isBound: true,
      };
    });

    // 3. Find Unbound Active Devices (Devices online on network but NOT in IP bindings)
    const unboundDevices: DeviceItem[] = [];
    activeList.forEach(c => {
      const mac = c.mac || c['mac-address'] || c.macAddress || '';
      const normalized = normalizeMac(mac);
      if (normalized && !boundMacSet.has(normalized)) {
        const rawComment = c.comment || c.hostName || c.name || '';
        const { category, cleanComment } = parseCategoryAndComment(rawComment, c.hostName);

        unboundDevices.push({
          id: `unbound-${normalized}`,
          mac: mac,
          ip: c.ip || c.address || c.ipAddress || '',
          type: 'unbound',
          category: category,
          comment: cleanComment,
          rawComment: rawComment,
          disabled: false,
          name: cleanComment || c.hostName || t('aps.networkDevice'),
          uptime: c.uptime,
          isOnline: true,
          isBound: false,
        });
      }
    });

    return {
      deviceList: boundDevices,
      activeUnboundList: unboundDevices,
    };
  }, [bindingsData, clientsData]);

  // Combined All List for filtering
  const allCombinedDevices = useMemo(() => {
    return [...deviceList, ...activeUnboundList];
  }, [deviceList, activeUnboundList]);

  // Compute Stat Counters
  const stats = useMemo(() => {
    const totalBindings = deviceList.length;
    const bypassed = deviceList.filter(d => d.type === 'bypassed').length;
    const blocked = deviceList.filter(d => d.type === 'blocked').length;
    const regular = deviceList.filter(d => d.type === 'regular').length;
    const online = deviceList.filter(d => d.isOnline).length;
    const unbound = activeUnboundList.length;
    return { totalBindings, bypassed, blocked, regular, online, unbound };
  }, [deviceList, activeUnboundList]);

  // Filtered devices list based on Search & Selected Filter Tab
  const filteredDevices = useMemo(() => {
    let list = allCombinedDevices;

    if (selectedFilter === 'bypassed') {
      list = list.filter(d => d.type === 'bypassed');
    } else if (selectedFilter === 'regular') {
      list = list.filter(d => d.type === 'regular');
    } else if (selectedFilter === 'blocked') {
      list = list.filter(d => d.type === 'blocked');
    } else if (selectedFilter === 'unbound') {
      list = list.filter(d => d.type === 'unbound');
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(d => {
      const macMatch = (d.mac || '').toLowerCase().includes(term);
      const ipMatch = (d.ip || '').toLowerCase().includes(term);
      const commentMatch = (d.comment || '').toLowerCase().includes(term);
      const typeMatch = (d.type || '').toLowerCase().includes(term);
      return macMatch || ipMatch || commentMatch || typeMatch;
    });
  }, [allCombinedDevices, selectedFilter, searchTerm]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenAddModalForUnbound = (device: DeviceItem) => {
    setNewMac(device.mac);
    setNewIp(device.ip || '');
    setNewType('bypassed');
    setNewCategory(device.category || 'mobile');
    setNewComment(device.comment || '');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    if (!newMac.trim()) {
      setFormError(t('aps.enterMac'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    // Format comment with category prefix so it persists on RouterOS
    const categoryTag = newCategory.charAt(0).toUpperCase() + newCategory.slice(1);
    const formattedComment = newComment.trim()
      ? `[${categoryTag}] ${newComment.trim()}`
      : `[${categoryTag}]`;

    try {
      await addIpBindingAPI(
        routerId,
        newMac.trim(),
        newIp.trim(),
        formattedComment,
        newType
      );

      setNewMac('');
      setNewIp('');
      setNewType('bypassed');
      setNewCategory('mobile');
      setNewComment('');
      setIsAddModalOpen(false);
      handleRefresh();
    } catch (err: any) {
      console.error('Failed to add IP binding:', err);
      setFormError(err?.message || t('aps.addFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!routerId || !selectedDevice) return;
    const targetId = selectedDevice.id || selectedDevice.mac;
    if (!targetId) return;

    setIsDeleting(true);
    try {
      await removeIpBindingAPI(routerId, targetId);
      setSelectedDevice(null);
      setShowDeleteConfirm(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete binding:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    if (type === 'bypassed') {
      return {
        background: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: '#10b981',
        label: t('aps.bypassed') || 'Bypassed'
      };
    }
    if (type === 'blocked') {
      return {
        background: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#ef4444',
        label: t('aps.blocked') || 'Blocked'
      };
    }
    if (type === 'unbound') {
      return {
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#f59e0b',
        label: t('aps.activeUnbound') || 'Active (Unbound)'
      };
    }
    return {
      background: 'rgba(59, 130, 246, 0.15)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      color: '#3b82f6',
      label: t('aps.regular') || 'Regular'
    };
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
      <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div className="page-header-icon">
            <Radio />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="page-header-title">
              {t('aps.title')}
            </h2>
            <p className="page-header-subtitle">
              {t('aps.subtitle') || 'إدارة أجهزة الشبكة وربط عناوين الماك'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="page-header-btn"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hide-sm-only" style={{ whiteSpace: 'nowrap' }}>{t('common.refresh') || 'تحديث'}</span>
          </button>
          <button
            onClick={() => {
              setNewMac('');
              setNewIp('');
              setNewType('bypassed');
              setNewCategory('mobile');
              setNewComment('');
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="page-header-btn page-header-btn-primary"
          >
            <Plus size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{t('common.add') || 'إضافة'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Overview Stat Cards / Interactive Group Tabs ─── */}
      <div className="stat-summary-grid">
        {/* Total Bindings */}
        <div
          onClick={() => setSelectedFilter('all')}
          style={{
            background: selectedFilter === 'all'
              ? 'rgba(16, 185, 129, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: selectedFilter === 'all'
              ? '1px solid rgba(16, 185, 129, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedFilter === 'all' ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
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
            <Radio size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('aps.totalDevices') || 'Total'}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>
              {isLoading ? '—' : stats.totalBindings}
            </div>
          </div>
        </div>

        {/* Bypassed */}
        <div
          onClick={() => setSelectedFilter('bypassed')}
          style={{
            background: selectedFilter === 'bypassed'
              ? 'rgba(16, 185, 129, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: selectedFilter === 'bypassed'
              ? '1px solid rgba(16, 185, 129, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedFilter === 'bypassed' ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
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
            <CheckCircle2 size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('aps.bypassed')}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
              {isLoading ? '—' : stats.bypassed}
            </div>
          </div>
        </div>

        {/* Regular */}
        <div
          onClick={() => setSelectedFilter('regular')}
          style={{
            background: selectedFilter === 'regular'
              ? 'rgba(59, 130, 246, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: selectedFilter === 'regular'
              ? '1px solid rgba(59, 130, 246, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedFilter === 'regular' ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
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
            <Shield size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('aps.regular') || 'Regular'}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', marginTop: '2px' }}>
              {isLoading ? '—' : stats.regular}
            </div>
          </div>
        </div>

        {/* Active Unbound */}
        <div
          onClick={() => setSelectedFilter('unbound')}
          style={{
            background: selectedFilter === 'unbound'
              ? 'rgba(245, 158, 11, 0.12)'
              : 'var(--card-bg, rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(12px)',
            border: selectedFilter === 'unbound'
              ? '1px solid rgba(245, 158, 11, 0.4)'
              : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedFilter === 'unbound' ? '0 2px 8px rgba(245, 158, 11, 0.15)' : 'none'
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            flexShrink: 0
          }}>
            <Zap size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1 }}>
              {t('aps.unboundCount') || 'Unbound'}
            </div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
              {isLoading ? '—' : stats.unbound}
            </div>
          </div>
        </div>
      </div>

      {/* Search Input Filter Bar */}
      <div style={{ position: 'relative', width: '100%' }}>
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
          placeholder={t('aps.searchPlaceholder') || 'Search by MAC, IP, category, comment...'}
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

      {/* ─── 4. Devices List / Skeletons / Empty State ─── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              className="skeleton"
              style={{
                height: '72px',
                borderRadius: '12px',
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
          padding: '40px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <Radio size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>
              {t('aps.noApsFound')}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '320px' }}>
              {t('aps.noApsDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="list-container">
          {filteredDevices.map(device => {
            const badgeStyle = getTypeBadgeStyle(device.type);
            const catConfig = CATEGORY_MAP[device.category] || CATEGORY_MAP.other;
            const CategoryIcon = catConfig.icon;

            return (
              <div
                key={device.id || device.mac}
                onClick={() => setSelectedDevice(device)}
                className="list-item-card hover-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: 'pointer',
                  border: device.type === 'unbound' ? '1px dashed rgba(245, 158, 11, 0.4)' : undefined,
                }}
              >
                {/* Left: Category Icon & Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  {/* Avatar Icon + Online Pulse Dot */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      className="item-icon"
                      style={{
                        background: catConfig.bg,
                        color: catConfig.color,
                        border: `1px solid ${catConfig.border}`
                      }}
                    >
                      <CategoryIcon size={16} />
                    </div>
                    <span style={{
                      position: 'absolute',
                      bottom: '-1px',
                      [isRtl ? 'left' : 'right']: '-1px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: device.isOnline ? '#10b981' : '#6b7280',
                      border: '1.5px solid var(--card-bg, #0f172a)',
                      boxShadow: device.isOnline ? '0 0 4px rgba(16,185,129,0.8)' : 'none'
                    }} />
                  </div>

                  {/* Name & Identifiers */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <strong className="item-title" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {device.comment || device.name || device.mac}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span className="item-subtext" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {device.mac}
                      </span>

                      {device.ip && (
                        <>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
                          <span className="item-subtext" style={{ color: '#3b82f6', fontFamily: 'monospace' }}>
                            {device.ip}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status Badge & Info Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {device.type === 'unbound' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddModalForUnbound(device);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.3) 100%)',
                        color: '#10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} />
                      <span>{t('aps.bypassNow')}</span>
                    </button>
                  ) : (
                    <span className="item-badge" style={{
                      background: badgeStyle.background,
                      border: badgeStyle.border,
                      color: badgeStyle.color,
                      whiteSpace: 'nowrap'
                    }}>
                      {badgeStyle.label}
                    </span>
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

      {/* ─── 5. Add Device Modal ─── */}
      {isAddModalOpen && (
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
            maxWidth: '420px',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
                  {t('aps.addDeviceTitle')}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '12px',
                marginBottom: '12px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddDevice} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Device Category Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
                  {t('aps.deviceCategory') || 'Device Type / Category'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {(Object.keys(CATEGORY_MAP) as DeviceCategory[]).map(catKey => {
                    const cat = CATEGORY_MAP[catKey];
                    const IconC = cat.icon;
                    const isSelected = newCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setNewCategory(catKey)}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: isSelected ? `1px solid ${cat.color}` : '1px solid var(--border-color)',
                          background: isSelected ? `${cat.color}15` : 'var(--card-bg)',
                          color: isSelected ? cat.color : 'var(--muted)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          justifyContent: 'center'
                        }}
                      >
                        <IconC size={14} />
                        <span>{t(cat.labelKey) || cat.defaultLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Binding Type Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  {t('aps.bindingType')}
                </label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    fontSize: '12px'
                  }}
                >
                  <option value="bypassed">{t('aps.bypassed')}</option>
                  <option value="regular">{t('aps.regular')}</option>
                  <option value="blocked">{t('aps.blocked')}</option>
                </select>
              </div>

              {/* MAC Address */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  {t('aps.macAddress')} *
                </label>
                <input
                  type="text"
                  value={newMac}
                  onChange={e => setNewMac(e.target.value)}
                  placeholder="e.g. AA:BB:CC:DD:EE:FF"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                  required
                />
              </div>

              {/* IP Address */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  {t('aps.ipAddress')} (Optional)
                </label>
                <input
                  type="text"
                  value={newIp}
                  onChange={e => setNewIp(e.target.value)}
                  placeholder="e.g. 192.168.88.100"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {/* Device Comment / Name */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                  {t('aps.deviceName')}
                </label>
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="e.g. Manager iPhone, Reception Printer..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    fontSize: '12px'
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {t('aps.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(5,150,105,1) 100%)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? t('aps.saving') : t('aps.saveDevice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Device Detail & Action Modal ─── */}
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
            maxWidth: '440px',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--glass-bg, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {renderCategoryIcon(selectedDevice.category, 16)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                    {selectedDevice.comment || selectedDevice.name || selectedDevice.mac}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{CATEGORY_MAP[selectedDevice.category]?.defaultLabel}</span>
                    <span>•</span>
                    <span style={{ color: selectedDevice.isOnline ? '#10b981' : '#6b7280', fontWeight: 600 }}>
                      {selectedDevice.isOnline ? t('aps.online') || 'Online' : t('aps.offline') || 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedDevice(null);
                  setShowDeleteConfirm(false);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Specifications Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {/* Type Badge */}
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--glass-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                  {t('aps.bindingType')}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: getTypeBadgeStyle(selectedDevice.type).color
                }}>
                  {getTypeBadgeStyle(selectedDevice.type).label}
                </span>
              </div>

              {/* Category */}
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--glass-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                  {t('aps.deviceCategory') || 'Category'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t(CATEGORY_MAP[selectedDevice.category]?.labelKey) || CATEGORY_MAP[selectedDevice.category]?.defaultLabel}
                </span>
              </div>

              {/* MAC Address */}
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--glass-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{t('aps.macAddress')}</span>
                  <button
                    onClick={() => handleCopy(selectedDevice.mac, 'mac')}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    {copiedField === 'mac' ? <Check size={10} /> : <Copy size={10} />}
                    <span>{copiedField === 'mac' ? t('aps.copied') : t('aps.copyMac')}</span>
                  </button>
                </div>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--foreground)', display: 'block', marginTop: '2px' }}>
                  {selectedDevice.mac}
                </span>
              </div>

              {/* IP Address */}
              {selectedDevice.ip && (
                <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--glass-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{t('aps.ipAddress')}</span>
                    <button
                      onClick={() => handleCopy(selectedDevice.ip!, 'ip')}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      {copiedField === 'ip' ? <Check size={10} /> : <Copy size={10} />}
                      <span>{copiedField === 'ip' ? t('aps.copied') : t('aps.copyIp')}</span>
                    </button>
                  </div>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6', display: 'block', marginTop: '2px' }}>
                    {selectedDevice.ip}
                  </span>
                </div>
              )}
            </div>

            {/* Actions / Deletion */}
            {selectedDevice.type === 'unbound' ? (
              <button
                onClick={() => {
                  const dev = selectedDevice;
                  setSelectedDevice(null);
                  handleOpenAddModalForUnbound(dev);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(5,150,105,1) 100%)',
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
                <Plus size={14} />
                <span>{t('aps.bypassNow')}</span>
              </button>
            ) : showDeleteConfirm ? (
              <div style={{
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#ef4444', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  {t('aps.confirmRemove')}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--card-bg)',
                      color: 'var(--foreground)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {t('aps.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteDevice}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {isDeleting ? t('aps.removing') : t('aps.removeBinding')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Trash2 size={14} />
                <span>{t('aps.removeBinding')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}