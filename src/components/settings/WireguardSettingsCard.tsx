import React, { useState, useEffect, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Download,
  Copy,
  Check,
  Terminal,
  ChevronDown,
  ChevronUp,
  FileCode,
  RefreshCw,
  Laptop,
  Smartphone,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import WireguardIcon from '../ui/WireguardIcon';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import {
  fetchRouterProfilesWithUserAPI,
  fetchUserVpnConfigAPI,
  fetchUserVpnPeersStatusAPI,
  deleteUserVpnPeerAPI,
} from '../../api';
import {
  generateUserVpnConfig,
  downloadVpnConfigFile,
  VpnClientConfig,
  getOrCreateUserPrivateKey,
  getPublicKeyFromPrivateKey,
} from '../../lib/wireguardVpn';
import type { RouterConfig } from '../../store';
import '../ui/vpn-modal.css';

interface WireguardSettingsCardProps {
  routerId?: string;
  routerVpnIp?: string | null;
  routerName?: string;
}

export const WireguardSettingsCard: React.FC<WireguardSettingsCardProps> = ({
  routerId,
  routerVpnIp,
  routerName,
}) => {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const { showConfirm } = useModal();
  const currentUserEmail = user?.email || '';

  const [activeSlot, setActiveSlot] = useState<'pc' | 'phone'>('pc');
  const [vpnConfig, setVpnConfig] = useState<VpnClientConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedConf, setCopiedConf] = useState(false);
  const [copiedLinuxCmd, setCopiedLinuxCmd] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [copiedSsh, setCopiedSsh] = useState(false);
  const [showLinuxCmd, setShowLinuxCmd] = useState(false);
  const [showRawConf, setShowRawConf] = useState(false);

  const [deviceName, setDeviceName] = useState('Admin PC');
  const [savedDeviceName, setSavedDeviceName] = useState('Admin PC');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isNameSaved, setIsNameSaved] = useState(false);
  const [isDeletingPeer, setIsDeletingPeer] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const normalizedEmail = (currentUserEmail || '').toLowerCase().trim();
  const { data: peersList, mutate: mutatePeersList } = useSWR(
    normalizedEmail ? ['user-vpn-peers-telemetry', normalizedEmail] : null,
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

  const registeredPeer = useMemo(() => {
    if (!Array.isArray(peersList) || !currentPubKey) return null;
    return (
      peersList.find(
        (p: any) =>
          Boolean(p.publicKey && p.publicKey.trim().length > 20) &&
          (p.publicKey.trim() === currentPubKey.trim() || p.deviceType === activeSlot)
      ) || null
    );
  }, [peersList, currentPubKey, activeSlot]);

  const isPeerRegistered = Boolean(registeredPeer);

  const { data: profilesResponse, isLoading: isLoadingProfiles } = useSWR(
    'router-profiles-user',
    fetchRouterProfilesWithUserAPI,
    { revalidateOnFocus: false }
  );

  const profiles: RouterConfig[] = useMemo(() => {
    return profilesResponse?.profiles || [];
  }, [profilesResponse]);

  const loadPersistentConfig = async (slot: 'pc' | 'phone') => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;

    setIsGenerating(true);
    try {
      const defaultName = slot === 'phone' ? 'Admin Phone' : 'Admin PC';
      const savedName =
        localStorage.getItem(`@wg_dev_name_${slot}_${email}`) || defaultName;

      const privKey = getOrCreateUserPrivateKey(email, slot);
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      const serverConfig = await fetchUserVpnConfigAPI(pubKey, savedName, slot, false);

      if (serverConfig && (serverConfig as any).deviceName) {
        const sName = (serverConfig as any).deviceName;
        setDeviceName(sName);
        setSavedDeviceName(sName);
        localStorage.setItem(`@wg_dev_name_${slot}_${email}`, sName);
      } else {
        setSavedDeviceName(savedName);
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

  useEffect(() => {
    loadPersistentConfig(activeSlot);
  }, [activeSlot, currentUserEmail, profiles]);

  const handleSaveDeviceName = async () => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email || isSavingName) return;

    const defaultName = activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC';
    const nameToSave = deviceName.trim() || defaultName;

    setIsSavingName(true);
    setSaveError(null);
    try {
      localStorage.setItem(`@wg_dev_name_${activeSlot}_${email}`, nameToSave);
      setDeviceName(nameToSave);

      const privKey = getOrCreateUserPrivateKey(email, activeSlot);
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      const serverConfig = await fetchUserVpnConfigAPI(pubKey, nameToSave, activeSlot, true);

      const config = await generateUserVpnConfig(
        email,
        profiles,
        serverConfig?.serverPublicKey,
        serverConfig?.endpointHost,
        serverConfig?.endpointPort,
        activeSlot,
        privKey,
        serverConfig?.clientIp,
        serverConfig?.allowedIps
      );

      setVpnConfig({
        ...config,
        clientIp: serverConfig?.clientIp || config.clientIp,
        allowedIps: serverConfig?.allowedIps || config.allowedIps,
      });

      await mutatePeersList();
      mutate(['user-vpn-peers-telemetry', email]);
      mutate('user-vpn-peers-status');

      setSavedDeviceName(nameToSave);
      setIsNameSaved(true);
      setTimeout(() => setIsNameSaved(false), 2000);
    } catch (err: any) {
      console.error('Failed to save device peer:', err);
      setSaveError(err?.message || 'Failed to register WireGuard peer');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDownloadConf = () => {
    if (!vpnConfig?.confText) return;
    const safeName = deviceName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `mikman_${activeSlot}_${safeName}.conf`;
    downloadVpnConfigFile(vpnConfig.confText, filename);
  };

  const handleDeletePeer = () => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    const targetPubKey = (registeredPeer?.publicKey || currentPubKey || '').trim();
    const targetIp = registeredPeer?.clientIp || vpnConfig?.clientIp;
    if (!email || !targetPubKey || isDeletingPeer) return;

    showConfirm(
      t('common.delete') || 'Delete Tunnel',
      isRtl
        ? `هل أنت متأكد من حذف نفق WireGuard (${deviceName})؟`
        : `Are you sure you want to delete the WireGuard tunnel (${deviceName})?`,
      async () => {
        setIsDeletingPeer(true);
        setSaveError(null);
        try {
          await deleteUserVpnPeerAPI(targetPubKey, targetIp);
          await mutatePeersList();
          mutate(['user-vpn-peers-telemetry', email]);
          mutate('user-vpn-peers-status');
        } catch (err: any) {
          setSaveError(err?.message || 'Failed to delete WireGuard peer');
        } finally {
          setIsDeletingPeer(false);
        }
      }
    );
  };

  const handleCopyConf = async () => {
    if (!vpnConfig?.confText) return;
    await navigator.clipboard.writeText(vpnConfig.confText);
    setCopiedConf(true);
    setTimeout(() => setCopiedConf(false), 2000);
  };

  const handleCopyIp = async (ip: string) => {
    if (!ip) return;
    await navigator.clipboard.writeText(ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleCopySsh = async (ip: string) => {
    if (!ip) return;
    await navigator.clipboard.writeText(`ssh admin@${ip}`);
    setCopiedSsh(true);
    setTimeout(() => setCopiedSsh(false), 2000);
  };

  const linuxQuickCmd = useMemo(() => {
    if (!vpnConfig?.confText) return '';
    const b64 = btoa(vpnConfig.confText);
    return `echo "${b64}" | base64 -d | sudo tee /etc/wireguard/mikman.conf > /dev/null && sudo wg-quick up mikman`;
  }, [vpnConfig]);

  return (
    <div className="settings-card" id="wireguard">
      {/* Section Header */}
      <div className="settings-section-header">
        <div className="settings-section-icon red">
          <WireguardIcon size={16} />
        </div>
        <div>
          <h3 className="settings-section-title">{t('vpnModal.title') || 'WireGuard VPN'}</h3>
          <p className="settings-section-subtitle">
            {t('vpnModal.subtitle') || 'Direct WinBox & WebFig access to all your MikroTik routers'}
          </p>
        </div>
      </div>

      {/* Slots Switcher (PC / Phone) */}
      <div className="vpn-modal-tabs rounded-lg mb-3">
        <button
          type="button"
          onClick={() => setActiveSlot('pc')}
          className={`vpn-tab-btn ${activeSlot === 'pc' ? 'active-pc' : ''}`}
        >
          <Laptop size={14} />
          <span>{t('vpnModal.tabPc') || 'PC / WinBox'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSlot('phone')}
          className={`vpn-tab-btn ${activeSlot === 'phone' ? 'active-phone' : ''}`}
        >
          <Smartphone size={14} />
          <span>{t('vpnModal.tabMobile') || 'Phone (QR)'}</span>
        </button>
      </div>

      {isGenerating || isLoadingProfiles ? (
        <div className="text-center py-8">
          <div className="spinner mx-auto mb-2.5" />
          <p className="text-xs text-muted m-0">
            {t('vpnModal.generating') || 'Generating WireGuard tunnel...'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Device Name Configuration */}
          <div className="vpn-device-name-bar">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-muted flex-shrink-0">
                {activeSlot === 'phone' ? <Smartphone size={14} /> : <Laptop size={14} />}
              </span>
              <span className="text-xs font-bold text-muted whitespace-nowrap">
                {t('vpnModal.deviceName') || 'Device Name'}
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
                className="vpn-device-name-input"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {(isPeerRegistered && (deviceName.trim() !== savedDeviceName.trim() || isSavingName || isNameSaved)) && (
                <button
                  type="button"
                  onClick={handleSaveDeviceName}
                  disabled={isSavingName}
                  title={t('common.save') || 'Save Device Name'}
                  className={`${isNameSaved ? 'btn-solid-green' : 'btn-solid-blue'} px-3 py-1.5 text-xs rounded-lg`}
                >
                  {isSavingName ? <RefreshCw size={12} className="spinner" /> : isNameSaved ? <Check size={12} /> : null}
                  <span>
                    {isSavingName
                      ? (t('common.saving') || 'Saving...')
                      : isNameSaved
                        ? (t('common.saved') || 'Saved')
                        : (t('common.save') || 'Save')}
                  </span>
                </button>
              )}
              {isPeerRegistered && (
                <button
                  type="button"
                  onClick={handleDeletePeer}
                  disabled={isDeletingPeer}
                  title={t('common.delete') || 'Delete Tunnel'}
                  className="btn-solid-red px-2.5 py-1.5 text-xs rounded-lg"
                >
                  {isDeletingPeer ? <RefreshCw size={12} className="spinner" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>
          </div>

          {!isPeerRegistered ? (
            <div className="vpn-unregistered-box">
              <div className="vpn-unregistered-icon">
                {activeSlot === 'phone' ? <Smartphone size={20} /> : <Laptop size={20} />}
              </div>
              <div className="max-w-[340px]">
                <div className="text-xs font-bold text-foreground mb-1">
                  {activeSlot === 'phone' ? (t('vpnModal.tabMobile') || 'Admin Phone') : (t('vpnModal.tabPc') || 'Admin PC')}
                </div>
                <p className="m-0 text-xs text-muted leading-relaxed">
                  {isRtl
                    ? 'هذا النفق غير مسجل على السيرفر بعد. اضغط على زر (حفظ وتفعيل) لإنشاء النفق على السيرفر.'
                    : 'This tunnel is not registered on the server yet. Click "Save & Activate" below to create it.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveDeviceName}
                disabled={isSavingName}
                className="btn-solid-blue px-4 py-2 text-xs rounded-lg inline-flex items-center gap-1.5"
              >
                {isSavingName ? <RefreshCw size={13} className="spinner" /> : <Check size={13} />}
                <span>{isSavingName ? (t('common.saving') || 'Saving...') : (t('vpnModal.createPeerBtn') || 'Save & Activate Tunnel')}</span>
              </button>
              {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
            </div>
          ) : (
            <>
              {/* Main Tunnel Panel */}
              <div className={`vpn-tunnel-panel ${activeSlot === 'phone' ? 'with-qr' : ''}`}>
                {activeSlot === 'phone' && (
                  <div className="vpn-qr-col">
                    <div className="vpn-qr-box">
                      {vpnConfig?.qrDataUrl ? (
                        <img
                          src={vpnConfig.qrDataUrl}
                          alt="WireGuard QR"
                          className="w-[152px] h-[152px] block [image-rendering:crisp-edges]"
                        />
                      ) : (
                        <div className="w-[152px] h-[152px] flex items-center justify-center text-muted text-xs">
                          {t('vpnModal.qrUnavailable') || 'Loading QR...'}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-muted text-center">
                      {t('vpnModal.mobileTip') || 'Scan with WireGuard on your mobile phone'}
                    </span>
                  </div>
                )}

                <div className="vpn-tunnel-details">
                  {/* Tunnel & Router IPs */}
                  <div className="vpn-ip-grid">
                    {vpnConfig?.clientIp && (
                      <div className="vpn-ip-tile">
                        <span className="vpn-ip-label">{t('vpnModal.clientIp') || 'Client IP'}</span>
                        <code className="vpn-ip-val" dir="ltr">{vpnConfig.clientIp}</code>
                      </div>
                    )}
                    {routerVpnIp && (
                      <div className="vpn-ip-tile">
                        <span className="vpn-ip-label">{routerName || routerId || 'Router'}</span>
                        <div className="vpn-ip-val-row">
                          <code className="vpn-ip-val" dir="ltr">{routerVpnIp}</code>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyIp(routerVpnIp)}
                              className={`${copiedIp ? 'btn-solid-green' : 'btn-solid-slate'} px-2 py-1 text-[11px] rounded`}
                              title={t('common.copy')}
                            >
                              {copiedIp ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedIp ? (t('common.copied') || 'Copied') : 'IP'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopySsh(routerVpnIp)}
                              className={`${copiedSsh ? 'btn-solid-green' : 'btn-solid-slate'} px-2 py-1 text-[11px] rounded`}
                              title="Copy SSH Command"
                            >
                              {copiedSsh ? <Check size={11} /> : <Terminal size={11} />}
                              <span>{copiedSsh ? (t('common.copied') || 'Copied') : 'SSH'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Primary Action Buttons: Download & Copy */}
                  <div className="vpn-actions-strip">
                    <button
                      type="button"
                      onClick={handleDownloadConf}
                      className="btn-solid-blue flex-1 py-2.5 text-xs rounded-lg"
                    >
                      <Download size={14} />
                      <span>{t('vpnModal.downloadConf') || 'Download .conf'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyConf}
                      className={`${copiedConf ? 'btn-solid-green' : 'btn-solid-slate'} flex-1 py-2.5 text-xs rounded-lg`}
                    >
                      {copiedConf ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedConf ? (t('common.copied') || 'Copied!') : (t('vpnModal.copyConfig') || 'Copy Config')}</span>
                    </button>
                  </div>
                  {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
                </div>
              </div>

              {/* Collapsible Advanced Tools (Linux 1-Click + Raw Config) */}
              <div className="vpn-advanced-stack">
                {activeSlot === 'pc' && (
                  <div className="vpn-collapse-card">
                    <div className="vpn-collapse-row">
                      <button
                        type="button"
                        onClick={() => setShowLinuxCmd(!showLinuxCmd)}
                        className="vpn-collapse-trigger"
                      >
                        <Terminal size={14} />
                        <span>{t('vpnModal.linuxTitle') || 'Linux (1-Click Command)'}</span>
                        {showLinuxCmd ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!linuxQuickCmd) return;
                          await navigator.clipboard.writeText(linuxQuickCmd);
                          setCopiedLinuxCmd(true);
                          setTimeout(() => setCopiedLinuxCmd(false), 2000);
                        }}
                        className={`${copiedLinuxCmd ? 'btn-solid-green' : 'btn-solid-slate'} px-2.5 py-1 text-[11px] rounded-md flex-shrink-0`}
                      >
                        {copiedLinuxCmd ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedLinuxCmd ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}</span>
                      </button>
                    </div>
                    {showLinuxCmd && (
                      <code className="vpn-linux-code">
                        {linuxQuickCmd || 'Loading command...'}
                      </code>
                    )}
                  </div>
                )}

                <div className="vpn-collapse-card">
                  <div className="vpn-collapse-row">
                    <button
                      type="button"
                      onClick={() => setShowRawConf(!showRawConf)}
                      className="vpn-collapse-trigger"
                    >
                      <FileCode size={14} />
                      <span>{t('vpnModal.rawConfig') || 'Raw WireGuard Configuration'}</span>
                      {showRawConf ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                  {showRawConf && vpnConfig?.confText && (
                    <pre className="vpn-raw-pre mt-2 select-all">
                      {vpnConfig.confText}
                    </pre>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
