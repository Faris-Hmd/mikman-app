import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchIpBindingsAPI,
  fetchNetworkClientsAPI,
  fetchPortForwardsAPI,
  addIpBindingAPI,
  removeIpBindingAPI,
  addPortForwardAPI,
  removePortForwardAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { DeviceItem, DeviceCategory, PortForwardRule } from '../../components/aps/types';
import { DeviceDetailModal } from '../../components/aps/DeviceDetailModal';
import {
  Radio,
  RefreshCw,
  Search,
  Smartphone,
  Laptop,
  Printer,
  Tv,
  HardDrive,
  Shield,
  Filter,
  ChevronDown,
  Check,
} from 'lucide-react';
import './Aps.css';

const CATEGORY_MAP: Record<DeviceCategory, { icon: any; className: string }> = {
  mobile: { icon: Smartphone, className: 'aps-cat-mobile' },
  laptop: { icon: Laptop, className: 'aps-cat-laptop' },
  ap: { icon: Radio, className: 'aps-cat-ap' },
  printer: { icon: Printer, className: 'aps-cat-printer' },
  tv: { icon: Tv, className: 'aps-cat-tv' },
  other: { icon: HardDrive, className: 'aps-cat-other' },
};

export default function ApsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bypassed'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterOpen]);

  // Fetch IP Bindings from server
  const { data: bindingsData, isLoading: isLoadingBindings, mutate: mutateBindings } = useSWR(
    routerId ? `router-ip-bindings-${routerId}` : null,
    () => fetchIpBindingsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  // Fetch Connected Clients to match online status
  const { data: clientsData, isLoading: isLoadingClients, mutate: mutateClients } = useSWR(
    routerId ? `router-network-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  // Fetch Port Forwards
  const { data: pfData, mutate: mutatePortForwards } = useSWR(
    routerId ? `router-port-forwards-${routerId}` : null,
    () => fetchPortForwardsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const portForwardMap = useMemo(() => {
    const map = new Map<string, PortForwardRule>();
    const list = Array.isArray(pfData) ? pfData : pfData?.portForwards;
    if (Array.isArray(list)) {
      list.forEach((pf: any) => {
        const targetIp = pf.toAddress || pf.toAddresses || pf['to-addresses'];
        if (targetIp) {
          map.set(targetIp, pf);
        }
      });
    }
    return map;
  }, [pfData]);

  // Combined Device list
  const deviceList: DeviceItem[] = useMemo(() => {
    const macMap = new Map<string, DeviceItem>();
    const clientList: any[] = Array.isArray(clientsData)
      ? clientsData
      : (clientsData as any)?.clients || [];

    // Seed with IP Bindings (Bypassed / Fixed Devices)
    if (Array.isArray(bindingsData)) {
      bindingsData.forEach((b: any) => {
        const cleanMac = (b.macAddress || b['mac-address'] || b.mac || '').toLowerCase();
        if (!cleanMac) return;

        const bId = b.id || b['.id'] || b._id;
        macMap.set(cleanMac, {
          id: bId,
          bindingId: bId,
          mac: cleanMac,
          ip: b.address || b.ip || '',
          isBypassed: b.isBypassed ?? b.type === 'bypassed',
          category: (b.category as DeviceCategory) || 'other',
          comment: b.comment || '',
          name: b.comment || '',
          isOnline: false,
        });
      });
    }

    // Merge with connected client telemetry
    clientList.forEach((c: any) => {
      const cleanMac = (c.mac || c.macAddress || '').toLowerCase();
      if (!cleanMac) return;

      const existing = macMap.get(cleanMac);
      if (existing) {
        existing.isOnline = c.isOnline ?? true;
        if (!existing.ip && c.ip) existing.ip = c.ip;
        if (!existing.name && (c.dhcpHostName || c.name)) {
          existing.name = c.dhcpHostName || c.name;
        }
      } else {
        macMap.set(cleanMac, {
          id: c.id,
          mac: cleanMac,
          ip: c.ip || '',
          isBypassed: false,
          category: 'other',
          comment: c.comment || '',
          name: c.dhcpHostName || c.name || '',
          isOnline: c.isOnline ?? true,
        });
      }
    });

    return Array.from(macMap.values());
  }, [bindingsData, clientsData]);

  // Telemetry counts
  const totalCount = deviceList.length;
  const bypassedCount = deviceList.filter((d) => d.isBypassed).length;
  const onlineCount = deviceList.filter((d) => d.isOnline).length;

  // Filtered devices
  const filteredDevices = useMemo(() => {
    let list = deviceList;

    if (selectedFilter === 'bypassed') {
      list = list.filter((d) => d.isBypassed);
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter((d) => {
      const nameMatch = (d.name || '').toLowerCase().includes(term);
      const ipMatch = (d.ip || '').toLowerCase().includes(term);
      const macMatch = d.mac.toLowerCase().includes(term);
      const commentMatch = (d.comment || '').toLowerCase().includes(term);
      return nameMatch || ipMatch || macMatch || commentMatch;
    });
  }, [deviceList, selectedFilter, searchTerm]);

  const handleRefresh = () => {
    mutateBindings();
    mutateClients();
    mutatePortForwards();
  };

  const handleToggleBypass = async (device: DeviceItem) => {
    if (!routerId) return;
    if (device.isBypassed) {
      const bindingId = device.bindingId || device.id;
      if (!bindingId) {
        throw new Error('Missing IP binding ID');
      }
      const res: any = await removeIpBindingAPI(routerId, bindingId);
      if (res && res.success === false) {
        throw new Error(res.error || res.message || 'Failed to remove IP binding');
      }
    } else {
      const res: any = await addIpBindingAPI(
        routerId,
        device.mac,
        device.ip || '',
        device.name || device.comment || 'AP Bypassed',
        'bypassed'
      );
      if (res && res.success === false) {
        throw new Error(res.error || res.message || 'Failed to add IP binding');
      }
    }
    await Promise.all([mutateBindings(), mutateClients()]);
  };

  const handleTogglePortForward = async (device: DeviceItem, rule?: PortForwardRule) => {
    if (!routerId || !device.ip) return;
    if (rule && (rule.id || rule['.id'])) {
      await removePortForwardAPI(routerId, rule.id || rule['.id']);
    } else {
      const usedPorts = new Set(
        Array.from(portForwardMap.values()).map((r) => Number(r.dstPort))
      );
      let dstPort = 8080;
      while (usedPorts.has(dstPort)) {
        dstPort++;
      }

      await addPortForwardAPI(routerId, {
        toAddress: device.ip,
        toPort: 80,
        dstPort,
        comment: `Web Access: ${device.name || device.ip}`,
      });
    }
    await mutatePortForwards();
  };

  const isLoading = isLoadingBindings && isLoadingClients;

  return (
    <div className="responsive-container" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Page Header ─── */}
      <div className="page-header-card">
        <div className="page-header-left-group">
          <div className="page-header-icon">
            <Radio />
          </div>
          <div className="page-header-titles">
            <h2 className="page-header-title">{t('aps.title')}</h2>
            <p className="page-header-subtitle">{t('aps.subtitle')}</p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          className="page-header-btn"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hide-sm-only">{t('common.refresh')}</span>
        </button>
      </div>

      {/* ─── Statistics Summary Grid ─── */}
      <div className="aps-stats-grid">
        <div className="aps-stat-card">
          <div className="aps-stat-icon total">
            <Radio size={14} />
          </div>
          <div className="aps-stat-info">
            <span className="aps-stat-label">{t('aps.totalDevices')}</span>
            <strong className="aps-stat-value">{totalCount}</strong>
          </div>
        </div>

        <div className="aps-stat-card">
          <div className="aps-stat-icon bypassed">
            <Radio size={14} />
          </div>
          <div className="aps-stat-info">
            <span className="aps-stat-label">{t('aps.bypassedDevices')}</span>
            <strong className="aps-stat-value text-emerald">{bypassedCount}</strong>
          </div>
        </div>

        <div className="aps-stat-card">
          <div className="aps-stat-icon online">
            <Radio size={14} />
          </div>
          <div className="aps-stat-info">
            <span className="aps-stat-label">{t('users.signedIn')}</span>
            <strong className="aps-stat-value text-blue">{onlineCount}</strong>
          </div>
        </div>
      </div>

      {/* ─── Controls & Search ─── */}
      <div className="aps-controls-card">
        <div className="aps-search-wrapper">
          <Search size={14} className="aps-search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('aps.searchPlaceholder')}
            className="aps-search-input"
          />
        </div>

        <div className="aps-filter-dropdown" ref={filterDropdownRef}>
          <button
            type="button"
            className={`aps-filter-dropdown-btn ${selectedFilter === 'bypassed' ? 'active' : ''}`}
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-expanded={isFilterOpen}
            aria-haspopup="listbox"
          >
            <Filter size={13} />
            <span>
              {selectedFilter === 'bypassed' ? t('aps.bypassedDevices') : t('aps.allDevices')}
            </span>
            <ChevronDown size={14} className={`aps-filter-chevron ${isFilterOpen ? 'open' : ''}`} />
          </button>

          {isFilterOpen && (
            <div className="aps-filter-menu" role="listbox">
              <button
                type="button"
                role="option"
                aria-selected={selectedFilter === 'all'}
                className={`aps-filter-option ${selectedFilter === 'all' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedFilter('all');
                  setIsFilterOpen(false);
                }}
              >
                <span className="aps-filter-option-label">
                  {t('aps.allDevices')} ({totalCount})
                </span>
                {selectedFilter === 'all' && <Check size={14} />}
              </button>

              <button
                type="button"
                role="option"
                aria-selected={selectedFilter === 'bypassed'}
                className={`aps-filter-option ${selectedFilter === 'bypassed' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedFilter('bypassed');
                  setIsFilterOpen(false);
                }}
              >
                <span className="aps-filter-option-label">
                  {t('aps.bypassedDevices')} ({bypassedCount})
                </span>
                {selectedFilter === 'bypassed' && <Check size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Devices Grid ─── */}
      {isLoading ? (
        <div className="profiles-list-stack">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton aps-skeleton-item"
            />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="profiles-empty-state">
          <Shield size={24} className="profiles-empty-icon" />
          <h4 className="profiles-empty-title">{t('aps.noApsFound')}</h4>
          <p className="profiles-empty-desc">{t('aps.noApsDesc')}</p>
        </div>
      ) : (
        <div className="aps-devices-grid">
          {filteredDevices.map((device) => {
            const cat = CATEGORY_MAP[device.category] || CATEGORY_MAP.other;
            const IconComp = cat.icon;

            return (
              <div
                key={device.id || device.mac}
                className="aps-device-card"
                onClick={() => setSelectedDevice(device)}
              >
                <div className="aps-device-left">
                  <div className={`aps-device-icon ${cat.className}`}>
                    <IconComp size={14} />
                  </div>
                  <div className="aps-device-info">
                    <span className="aps-device-name" title={device.name || device.comment || device.ip}>
                      {device.name || device.comment || device.ip || 'Device'}
                    </span>
                    <span className="aps-device-ip">{device.ip || device.mac}</span>
                  </div>
                </div>

                <div className="aps-device-badges">
                  {device.isBypassed && (
                    <span className="aps-status-pill bypassed">
                      {t('aps.bypassed')}
                    </span>
                  )}
                  {device.isOnline && (
                    <span className="aps-status-pill online">
                      {t('aps.online')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Device Detail Modal ─── */}
      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        portForwardMap={portForwardMap}
        onToggleBypass={handleToggleBypass}
        onTogglePortForward={handleTogglePortForward}
      />
    </div>
  );
}
