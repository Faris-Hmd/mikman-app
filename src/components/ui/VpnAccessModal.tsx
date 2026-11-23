import { useState, useEffect, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Download,
  Copy,
  Check,
  X,
  Terminal,
  ChevronDown,
  ChevronUp,
  FileCode,
  RefreshCw,
  Laptop,
  Smartphone,
  Globe,
  ExternalLink,
  Router as RouterIcon,
} from 'lucide-react';
import WireguardIcon from './WireguardIcon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchUserVpnConfigAPI, fetchUserVpnPeersStatusAPI } from '../api';
import { getRouterVpnIp } from '../lib/helpers';
import {
  generateUserVpnConfig,
  downloadVpnConfigFile,
  VpnClientConfig,
  getOrCreateUserPrivateKey,
  getPublicKeyFromPrivateKey,
} from '../lib/wireguardVpn';
import type { RouterConfig } from '../store';

interface VpnAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRouterVpnIp?: string | null;
  initialTab?: string;
}

export default function VpnAccessModal({
  isOpen,
  onClose,
  selectedRouterVpnIp,
  initialTab,
}: VpnAccessModalProps) {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const currentUserEmail = user?.email || '';

  const [activeSlot, setActiveSlot] = useState<'pc' | 'phone'>(
    initialTab === 'phone' ? 'phone' : 'pc'
  );
  const [vpnConfig, setVpnConfig] = useState<VpnClientConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedConf, setCopiedConf] = useState(false);
  const [copiedLinuxCmd, setCopiedLinuxCmd] = useState(false);
  const [showRawConf, setShowRawConf] = useState(false);

  const [deviceName, setDeviceName] = useState('Admin PC');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isNameSaved, setIsNameSaved] = useState(false);
  const [copiedIpMap, setCopiedIpMap] = useState<Record<string, boolean>>({});
  const [copiedSshMap, setCopiedSshMap] = useState<Record<string, boolean>>({});

  // Sync initial tab when modal opens or initialTab prop changes
  useEffect(() => {
    if (initialTab === 'phone' || initialTab === 'pc') {
      setActiveSlot(initialTab);
    }
  }, [initialTab, isOpen]);

  // Hydrate device name from localStorage whenever activeSlot or user changes
  useEffect(() => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;
    const defaultName = activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC';
    const saved =
      localStorage.getItem(`@wg_dev_name_${activeSlot}_${email}`) ||
      localStorage.getItem(`@wg_dev_name_${email}`) ||
      defaultName;
    setDeviceName(saved);
  }, [currentUserEmail, activeSlot]);

  // Query registered peers telemetry to check whether this slot is currently registered on the server
  const normalizedEmail = (currentUserEmail || '').toLowerCase().trim();
  const { data: peersList, mutate: mutatePeersList } = useSWR(
    isOpen && normalizedEmail ? ['user-vpn-peers-telemetry', normalizedEmail] : null,
    async () => {
      try {
        return await fetchUserVpnPeersStatusAPI();
      } catch {
        return [];
      }
    }
  );

  const currentPrivKey = useMemo(() => {
    if (!currentUserEmail) return '';
    return getOrCreateUserPrivateKey(currentUserEmail, activeSlot);
  }, [currentUserEmail, activeSlot]);

  const currentPubKey = useMemo(() => {
    if (!currentPrivKey) return '';
    return getPublicKeyFromPrivateKey(currentPrivKey);
  }, [currentPrivKey]);

  const isPeerRegistered = useMemo(() => {
    if (!Array.isArray(peersList) || !currentPubKey) return false;
    return peersList.some(
      (p: any) =>
        Boolean(p.publicKey && p.publicKey.trim().length > 20) &&
        (p.publicKey.trim() === currentPubKey.trim() || p.deviceType === activeSlot)
    );
  }, [peersList, currentPubKey, activeSlot]);

  // Fetch router profiles to construct user-isolated AllowedIPs and router list
  const { data: profilesResponse, isLoading: isLoadingProfiles } = useSWR(
    isOpen ? 'router-profiles-user' : null,
    fetchRouterProfilesWithUserAPI,
    { revalidateOnFocus: false }
  );

  const profiles: RouterConfig[] = useMemo(() => {
    if (!profilesResponse) return [];
    if (Array.isArray(profilesResponse)) return profilesResponse;
    return profilesResponse.profiles || [];
  }, [profilesResponse]);

  // Save device name to both localStorage and create/update the peer on the VPS server
  const handleSaveDeviceName = async () => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;

    const defaultName = activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC';
    const nameToSave = deviceName.trim() || defaultName;

    setIsSavingName(true);
    try {
      localStorage.setItem(`@wg_dev_name_${activeSlot}_${email}`, nameToSave);
      setDeviceName(nameToSave);

      const privKey = getOrCreateUserPrivateKey(email, activeSlot);
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      // Explicitly register and activate the peer on the VPS WireGuard kernel
      await fetchUserVpnConfigAPI(pubKey, nameToSave, activeSlot, true);

      // Mutate peer telemetry lists so Landing page and Modal update immediately
      await mutatePeersList();
      mutate(['user-vpn-peers-telemetry', email]);
      mutate('user-vpn-peers-status');

      setIsNameSaved(true);
      setTimeout(() => setIsNameSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save device peer:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  // Load persistent configuration for the selected device slot WITHOUT registering on the server
  const loadPersistentConfig = async (slot: 'pc' | 'phone') => {
    if (!isOpen) return;
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;

    setIsGenerating(true);
    try {
      const defaultName = slot === 'phone' ? 'Admin Phone' : 'Admin PC';
      const savedName =
        localStorage.getItem(`@wg_dev_name_${slot}_${email}`) ||
        defaultName;

      // Stable deterministic Curve25519 private key for this specific slot
      const privKey = getOrCreateUserPrivateKey(email, slot);
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      // Retrieve VPS WireGuard parameters WITHOUT registering (register=false)
      const serverConfig = await fetchUserVpnConfigAPI(pubKey, savedName, slot, false);

      if (serverConfig && (serverConfig as any).deviceName) {
        const sName = (serverConfig as any).deviceName;
        setDeviceName(sName);
        localStorage.setItem(`@wg_dev_name_${slot}_${email}`, sName);
      }

      const config = await generateUserVpnConfig(
        email,
        profiles,
        serverConfig?.serverPublicKey,
        serverConfig?.endpointHost,
        serverConfig?.endpointPort,
        slot,
        privKey,
        serverConfig?.clientIp,
        serverConfig?.allowedIps
      );

      setVpnConfig({
        ...config,
        clientIp: serverConfig?.clientIp || config.clientIp,
        allowedIps: serverConfig?.allowedIps || config.allowedIps,
      });
    } catch (err) {
      console.error('Error loading persistent VPN config:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Automatically load the pre-configured persistent peer when modal is open or slot changes
  useEffect(() => {
    if (isOpen) {
      loadPersistentConfig(activeSlot);
    }
  }, [isOpen, currentUserEmail, profiles, activeSlot]);

  if (!isOpen) return null;

  const handleCopyConf = async () => {
    if (!vpnConfig?.confText) return;
    try {
      await navigator.clipboard.writeText(vpnConfig.confText);
      setCopiedConf(true);
      setTimeout(() => setCopiedConf(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = vpnConfig.confText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedConf(true);
      setTimeout(() => setCopiedConf(false), 2000);
    }
  };

  const handleDownloadConf = () => {
    if (!vpnConfig?.confText) return;
    downloadVpnConfigFile(vpnConfig.confText, 'mikman.conf');
  };

  const handleCopyIp = async (ip: string, id: string) => {
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

  const handleCopySsh = async (ip: string, rUser = 'admin', id: string) => {
    if (!ip) return;
    const cmd = `ssh ${rUser || 'admin'}@${ip}`;
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

  // 1-Click Self-Contained Linux Setup Command
  let linuxQuickCmd = 'sudo wg-quick up mikman';
  if (vpnConfig?.confText) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(vpnConfig.confText)));
      linuxQuickCmd = `sudo bash -c 'echo "${b64}" | base64 -d > /etc/wireguard/mikman.conf && chmod 600 /etc/wireguard/mikman.conf && (wg-quick down mikman 2>/dev/null || true) && wg-quick up mikman'`;
    } catch {
      linuxQuickCmd = 'sudo wg-quick up mikman';
    }
  }

  return (
    <div
      className="modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        className="responsive-card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact, Clean Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <WireguardIcon size={19} color="#ef4444" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '14.5px',
                  fontWeight: '800',
                  margin: 0,
                  color: 'var(--foreground)',
                  lineHeight: 1.2,
                }}
              >
                {t('vpnModal.title') || 'WireGuard VPN'}
              </h2>
              <p
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                  margin: '2px 0 0',
                  lineHeight: 1.2,
                }}
              >
                {t('vpnModal.subtitle') || 'Direct access to WinBox & WebFig'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'var(--input-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Device Target Segmented Tabs (Solid high-contrast buttons per AGENTS.md) */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 20px 0 20px', background: 'var(--card-bg)' }}>
          <button
            type="button"
            onClick={() => setActiveSlot('pc')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: activeSlot === 'pc' ? 'var(--primary)' : 'var(--input-bg)',
              color: activeSlot === 'pc' ? '#ffffff' : 'var(--text-muted)',
              border: activeSlot === 'pc' ? 'none' : '1px solid var(--glass-border)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Laptop size={14} />
            <span>{t('vpnModal.tabPc') || 'PC / WinBox'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSlot('phone')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: activeSlot === 'phone' ? '#10b981' : 'var(--input-bg)',
              color: activeSlot === 'phone' ? '#ffffff' : 'var(--text-muted)',
              border: activeSlot === 'phone' ? 'none' : '1px solid var(--glass-border)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={14} />
            <span>{t('vpnModal.tabMobile') || 'Phone (QR)'}</span>
          </button>
        </div>

        {/* Scrollable All-In-One Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isGenerating || isLoadingProfiles ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
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
                {t('vpnModal.generating') || 'Generating WireGuard tunnel...'}
              </p>
            </div>
          ) : (
            <>
              {/* 1. Device Name Bar */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  gap: '8px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {activeSlot === 'phone' ? '📱' : '💻'} {t('vpnModal.deviceName') || 'Device Name'}:
                  </span>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDeviceName(val);
                      if (currentUserEmail) {
                        localStorage.setItem(`@wg_dev_name_${activeSlot}_${currentUserEmail.toLowerCase().trim()}`, val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveDeviceName();
                      }
                    }}
                    placeholder={activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC'}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--foreground)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                    }}
                  />
                </div>
                <button
                  onClick={handleSaveDeviceName}
                  disabled={isSavingName}
                  title={t('common.save') || 'Save Device Name'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: isNameSaved ? '#10b981' : 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: isSavingName ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSavingName ? <RefreshCw size={11} className="spinner" /> : isNameSaved ? <Check size={11} /> : null}
                  <span>
                    {isSavingName
                      ? (t('common.saving') || 'Saving...')
                      : isNameSaved
                        ? (t('common.saved') || 'Saved')
                        : isPeerRegistered
                          ? (t('common.save') || 'Save')
                          : (t('vpnModal.createPeerBtn') || 'Save & Activate')}
                  </span>
                </button>
              </div>

              {!isPeerRegistered ? (
                /* Unregistered device state: do NOT create peer on server until user clicks Save */
                <div
                  style={{
                    padding: '22px 16px',
                    textAlign: 'center',
                    background: 'var(--input-bg)',
                    borderRadius: '12px',
                    border: '1px dashed var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'rgba(37, 99, 235, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                    }}
                  >
                    {activeSlot === 'phone' ? <Smartphone size={20} /> : <Laptop size={20} />}
                  </div>
                  <div style={{ maxWidth: '320px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--foreground)', marginBottom: '4px' }}>
                      {activeSlot === 'phone' ? (t('vpnModal.tabMobile') || 'Admin Phone') : (t('vpnModal.tabPc') || 'Admin PC')}
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {isRtl
                        ? 'هذا النفق غير مسجل على السيرفر بعد. اضغط على زر (حفظ وتفعيل) لإنشاء النفق على السيرفر.'
                        : 'This tunnel is not registered on the server yet. Click "Save & Activate" below to create it.'}
                    </p>
                  </div>
                  <button
                    onClick={handleSaveDeviceName}
                    disabled={isSavingName}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: isSavingName ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    {isSavingName ? <RefreshCw size={13} className="spinner" /> : <Check size={13} />}
                    <span>{isSavingName ? (t('common.saving') || 'Saving...') : (t('vpnModal.createPeerBtn') || 'Save & Activate Tunnel')}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* 2. Phone view: QR Code prominent */}
                  {activeSlot === 'phone' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '10px',
                          borderRadius: '12px',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {vpnConfig?.qrDataUrl ? (
                          <img
                            src={vpnConfig.qrDataUrl}
                            alt="WireGuard QR"
                            style={{
                              width: '165px',
                              height: '165px',
                              display: 'block',
                              imageRendering: 'crisp-edges',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '165px',
                              height: '165px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#666',
                              fontSize: '11px',
                            }}
                          >
                            {t('vpnModal.qrUnavailable') || 'Loading QR...'}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        📱 {t('vpnModal.mobileTip') || 'Scan with WireGuard on your mobile phone'}
                      </span>
                    </div>
                  )}

                  {/* 3. Primary Actions: Download .conf & Copy Config */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={handleDownloadConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--primary)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Download size={14} />
                      <span>{t('vpnModal.downloadConf') || 'Download .conf'}</span>
                    </button>
                    <button
                      onClick={handleCopyConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        backgroundColor: copiedConf ? '#10b981' : '#334155',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedConf ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedConf ? (t('common.copied') || 'Copied!') : (t('vpnModal.copyConfig') || 'Copy Config')}</span>
                    </button>
                  </div>

                  {/* 4. PC view: Linux 1-Click Command */}
                  {activeSlot === 'pc' && (
                    <div
                      style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Terminal size={13} />
                          🐧 {t('vpnModal.linuxTitle') || 'Linux (1-Click Command)'}
                        </span>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(linuxQuickCmd);
                            setCopiedLinuxCmd(true);
                            setTimeout(() => setCopiedLinuxCmd(false), 2000);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            backgroundColor: copiedLinuxCmd ? '#10b981' : '#334155',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedLinuxCmd ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedLinuxCmd ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}</span>
                        </button>
                      </div>

                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          color: '#38bdf8',
                          overflowX: 'auto',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {linuxQuickCmd}
                      </div>
                    </div>
                  )}

                  {/* 5. Connected Routers: WebFig & WinBox Direct Access */}
                  <div
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <RouterIcon size={16} color="var(--primary)" />
                        {t('vpnModal.routersTitle') || (isRtl ? 'الوصول المباشر للراوترات (WebFig & WinBox)' : 'Direct Router Access (WebFig & WinBox)')}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {profiles.length} {isRtl ? 'راوتر' : 'routers'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                      {profiles.length === 0 ? (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                          {t('vpnModal.noRouters') || 'No routers registered yet'}
                        </div>
                      ) : (
                        profiles.map((r) => {
                          const vpnIp = getRouterVpnIp(r);
                          const isIpCopied = copiedIpMap[r.id || ''] || false;
                          const isSshCopied = copiedSshMap[r.id || ''] || false;
                          const isSelected = Boolean(selectedRouterVpnIp && vpnIp === selectedRouterVpnIp);

                          return (
                            <div
                              key={r.id || r.name}
                              style={{
                                background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'rgba(0, 0, 0, 0.25)',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                borderRadius: '9px',
                                padding: '9px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    color: 'var(--foreground)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {r.name || 'MikroTik Router'}
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    color: vpnIp ? '#38bdf8' : 'var(--text-muted)',
                                    marginTop: '2px',
                                  }}
                                >
                                  {vpnIp || 'No VPN IP'}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {vpnIp ? (
                                  <a
                                    href={`http://${vpnIp}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      backgroundColor: 'var(--primary)',
                                      color: '#ffffff',
                                      fontSize: '11.5px',
                                      fontWeight: 800,
                                      textDecoration: 'none',
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Open WebFig in new tab"
                                  >
                                    <Globe size={13} />
                                    <span>{t('vpnModal.openWebFig') || 'WebFig'}</span>
                                    <ExternalLink size={10} />
                                  </a>
                                ) : null}

                                {vpnIp ? (
                                  <button
                                    onClick={() => handleCopyIp(vpnIp, r.id || '')}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '6px 11px',
                                      borderRadius: '6px',
                                      backgroundColor: isIpCopied ? '#10b981' : '#334155',
                                      color: '#ffffff',
                                      fontSize: '11.5px',
                                      fontWeight: 800,
                                      border: 'none',
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Copy WinBox IP"
                                  >
                                    {isIpCopied ? <Check size={13} /> : <Copy size={13} />}
                                    <span>{isIpCopied ? (t('vpnModal.copiedIp') || 'Copied!') : (t('vpnModal.copyWinboxIp') || 'WinBox')}</span>
                                  </button>
                                ) : null}

                                {vpnIp ? (
                                  <button
                                    onClick={() => handleCopySsh(vpnIp, r.user, r.id || '')}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 9px',
                                      borderRadius: '6px',
                                      backgroundColor: isSshCopied ? '#10b981' : '#1e293b',
                                      color: '#ffffff',
                                      fontSize: '11.5px',
                                      fontWeight: 800,
                                      border: 'none',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Copy SSH Command"
                                  >
                                    <Terminal size={12} />
                                    <span>{isSshCopied ? (t('common.copied') || 'Copied!') : 'SSH'}</span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 6. Instructions Card */}
                  <div
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '11.5px', marginBottom: '6px' }}>
                      📖 {t('vpnModal.quickInstructions') || 'Quick Setup Instructions'}
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: isRtl ? 0 : '16px',
                        paddingRight: isRtl ? '16px' : 0,
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      <li><strong>📱 {isRtl ? 'الهاتف:' : 'Phone:'}</strong> {t('vpnModal.instrPhone') || 'Scan the QR code above in the WireGuard mobile app.'}</li>
                      <li><strong>💻 {isRtl ? 'ويندوز وماك:' : 'Windows & macOS:'}</strong> {t('vpnModal.instrWindows') || 'Click Download .conf, import into WireGuard, and activate.'}</li>
                      <li><strong>🐧 {isRtl ? 'لينكس:' : 'Linux:'}</strong> {t('vpnModal.instrLinux') || 'Copy and run the 1-click terminal command above.'}</li>
                    </ul>
                  </div>

                  {/* 7. View Raw Config Collapsible */}
                  <div
                    style={{
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => setShowRawConf(!showRawConf)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'rgba(0,0,0,0.15)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: 'var(--text-muted)',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FileCode size={12} />
                        {t('vpnModal.showConfig') || 'View .conf configuration'}
                      </span>
                      {showRawConf ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showRawConf && (
                      <pre
                        style={{
                          margin: 0,
                          padding: '8px 10px',
                          fontSize: '10px',
                          lineHeight: '1.4',
                          color: 'var(--foreground)',
                          background: 'rgba(0,0,0,0.3)',
                          maxHeight: '130px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {vpnConfig?.confText || '# Loading...'}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
