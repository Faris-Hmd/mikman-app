import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Radio,
  Network,
  Wifi,
  Save,
  X,
  Check,
  Activity,
  AlertCircle,
  Router,
  Tag,
  Users,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterInterfacesAPI, updateRouterProfileAPI } from '../api';

interface PortApModalProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  initialPortMap?: Record<string, string>;
  onPortMapUpdated?: (newMap: Record<string, string>) => void;
}

export default function PortApModal({
  isOpen,
  onClose,
  routerId,
  initialPortMap = {},
  onPortMapUpdated,
}: PortApModalProps) {
  const { t, isRtl } = useLanguage();
  const [portMap, setPortMap] = useState<Record<string, string>>(initialPortMap);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch live physical/wireless interfaces and active client counts per port
  const { data: ifaceData, isLoading: isLoadingIfaces, mutate: mutateIfaces } = useSWR(
    isOpen && routerId ? `router-interfaces-${routerId}` : null,
    () => fetchRouterInterfacesAPI(routerId),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (ifaceData?.portApMap) {
      setPortMap((prev) => ({ ...prev, ...ifaceData.portApMap }));
    } else if (initialPortMap && Object.keys(initialPortMap).length > 0) {
      setPortMap(initialPortMap);
    }
  }, [ifaceData, initialPortMap]);

  if (!isOpen) return null;

  const rawInterfaces = ifaceData?.interfaces || [];
  const interfaces = [...rawInterfaces];
  if (!interfaces.some((i) => i.name.toLowerCase() === 'bridge')) {
    interfaces.push({
      id: 'bridge-main',
      name: 'bridge',
      type: 'bridge',
      running: true,
      disabled: false,
      comment: 'Main Hotspot Bridge',
    });
  }

  // Sort interfaces so physical ether & wlan interfaces appear first, bridge/vpn last
  const sortedInterfaces = [...interfaces].sort((a, b) => {
    const isBridgeA = a.name.toLowerCase().includes('bridge');
    const isBridgeB = b.name.toLowerCase().includes('bridge');
    if (isBridgeA && !isBridgeB) return 1;
    if (!isBridgeA && isBridgeB) return -1;

    const isEthA = a.name.startsWith('ether');
    const isEthB = b.name.startsWith('ether');
    const isWlanA = a.name.startsWith('wlan') || a.name.startsWith('wifi');
    const isWlanB = b.name.startsWith('wlan') || b.name.startsWith('wifi');

    if (isEthA && !isEthB) return -1;
    if (!isEthA && isEthB) return 1;
    if (isWlanA && !isWlanB) return -1;
    if (!isWlanA && isWlanB) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  const handlePortChange = (portName: string, value: string) => {
    setPortMap((prev) => ({
      ...prev,
      [portName]: value,
    }));
    setSavedSuccess(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!routerId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      // Clean up empty entries
      const cleanedMap: Record<string, string> = {};
      Object.entries(portMap).forEach(([k, v]) => {
        if (v && v.trim()) {
          cleanedMap[k] = v.trim();
        }
      });

      await updateRouterProfileAPI(routerId, { portApMap: cleanedMap });

      // Save to localStorage for instant local caching
      try {
        localStorage.setItem(`@router_port_map_${routerId}`, JSON.stringify(cleanedMap));
      } catch {}

      setSavedSuccess(true);
      if (onPortMapUpdated) {
        onPortMapUpdated(cleanedMap);
      }

      // Revalidate cache across app
      mutate(`router-interfaces-${routerId}`);
      mutate(`router-clients-${routerId}`);
      mutate(`router-profiles-user`);
      mutate('user-routers');

      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save port AP mapping');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        className="responsive-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(6,182,212,0.05))',
                border: '1.5px solid #06b6d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#06b6d4',
                flexShrink: 0,
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: '800',
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                {t('users.assignAps') || 'Ports & APs Mapping'}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('users.assignApsDesc') ||
                  'Assign custom AP names to ports (ether2, ether3, wlan) to identify where clients connect.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--input-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {saveError && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '11.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{saveError}</span>
            </div>
          )}

          {savedSuccess && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontSize: '11.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={14} style={{ flexShrink: 0 }} />
              <span>{t('users.portMapSaved') || 'Port & AP assignments saved successfully!'}</span>
            </div>
          )}

          {isLoadingIfaces ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  border: '2.5px solid var(--primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 10px',
                }}
              />
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                Loading router physical interfaces...
              </p>
            </div>
          ) : sortedInterfaces.length === 0 ? (
            // Fallback default ports if router REST interface returns empty
            ['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'wlan1'].map((portName) => {
              const isWireless = portName.startsWith('wlan') || portName.startsWith('wifi');
              return (
                <div
                  key={portName}
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isWireless ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                      color: isWireless ? '#10b981' : '#3b82f6',
                      border: isWireless ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(59,130,246,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isWireless ? <Wifi size={16} /> : <Network size={16} />}
                  </div>

                  <div style={{ width: '90px', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {portName}
                    </div>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                      {isWireless ? t('users.wirelessPort') || 'Wi-Fi' : t('users.ethernetPort') || 'Ethernet'}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={portMap[portName] || ''}
                      onChange={(e) => handlePortChange(portName, e.target.value)}
                      placeholder={t('users.assignApNamePlaceholder') || 'e.g. Roof AP, Floor 1 TP-Link...'}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '7px',
                        color: 'var(--foreground)',
                        fontSize: '11.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            sortedInterfaces.map((iface) => {
              const portName = iface.name;
              const isWireless = portName.startsWith('wlan') || portName.startsWith('wifi') || iface.type === 'wlan';
              const isEthernet = portName.startsWith('ether') || iface.type === 'ether';
              const clientCount = iface.clientCount || 0;

              return (
                <div
                  key={iface.id || portName}
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isWireless
                        ? 'rgba(16,185,129,0.12)'
                        : isEthernet
                        ? 'rgba(59,130,246,0.12)'
                        : 'rgba(148,163,184,0.12)',
                      color: isWireless ? '#10b981' : isEthernet ? '#3b82f6' : 'var(--text-muted)',
                      border: '1px solid var(--glass-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isWireless ? <Wifi size={16} /> : isEthernet ? <Network size={16} /> : <Router size={16} />}
                  </div>

                  <div style={{ width: '100px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {portName}
                      </span>
                      {iface.running && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 4px #10b981',
                          }}
                          title="Port Active / Link UP"
                        />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                      {clientCount > 0 ? (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <Users size={9} />
                          {clientCount} {t('users.activeClientsOnPort') || 'clients'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                          {isWireless
                            ? t('users.wirelessPort') || 'Wi-Fi'
                            : isEthernet
                            ? t('users.ethernetPort') || 'Ethernet'
                            : iface.type || 'Port'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={portMap[portName] !== undefined ? portMap[portName] : iface.apName || ''}
                      onChange={(e) => handlePortChange(portName, e.target.value)}
                      placeholder={t('users.assignApNamePlaceholder') || 'e.g. Roof AP, Floor 1 TP-Link, Cashier...'}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '7px',
                        color: 'var(--foreground)',
                        fontSize: '11.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            background: 'var(--glass-bg)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--input-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel') || 'Cancel'}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'var(--primary)',
              border: 'none',
              color: '#ffffff',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : savedSuccess ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            {isSaving
              ? t('common.saving') || 'Saving...'
              : savedSuccess
              ? t('common.saved') || 'Saved!'
              : t('users.savePortMap') || 'Save AP Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}
