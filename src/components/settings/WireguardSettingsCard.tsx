import React, { useState, useEffect, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import {
  Download,
  Copy,
  Check,
  Terminal,
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
  resetUserPrivateKey,
} from '../../lib/wireguardVpn';
import type { RouterConfig } from '../../store';
import '../ui/vpn-modal.css';

interface WireguardSettingsCardProps {
  routerId?: string;
  routerVpnIp?: string | null;
}

export const WireguardSettingsCard: React.FC<WireguardSettingsCardProps> = ({
  routerVpnIp,
}) => {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const { showConfirm } = useModal();
  const currentUserEmail = user?.email || '';

  const [activeSlot, setActiveSlot] = useState<'pc' | 'phone'>('pc');
  const [slotConfigs, setSlotConfigs] = useState<Partial<Record<'pc' | 'phone', VpnClientConfig>>>({});
  const [keyVersion, setKeyVersion] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const vpnConfig = slotConfigs[activeSlot] || null;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [deviceName, setDeviceName] = useState('Admin PC');
  const [savedDeviceName, setSavedDeviceName] = useState('Admin PC');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isNameSaved, setIsNameSaved] = useState(false);
  const [isDeletingPeer, setIsDeletingPeer] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const triggerCopy = async (id: string, value?: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  useEffect(() => {
    const email = currentUserEmail.toLowerCase().trim();
    if (!email) return;
    const defaultName = activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC';
    const saved =
      localStorage.getItem(`@wg_dev_name_${activeSlot}_${email}`) ||
      localStorage.getItem(`@wg_dev_name_${email}`) ||
      defaultName;
    setDeviceName(saved);
  }, [currentUserEmail, activeSlot]);

  const normalizedEmail = currentUserEmail.toLowerCase().trim();

  const {
    data: peersList,
    isValidating: isValidatingPeers,
    mutate: mutatePeersList,
  } = useSWR(
    normalizedEmail ? ['user-vpn-peers-telemetry', normalizedEmail] : null,
    async () => {
      try {
        return await fetchUserVpnPeersStatusAPI();
      } catch {
        return [];
      }
    },
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const currentPrivKey = useMemo(() => {
    if (!currentUserEmail) return '';
    return getOrCreateUserPrivateKey(currentUserEmail, activeSlot);
  }, [currentUserEmail, activeSlot, keyVersion]);

  const currentPubKey = useMemo(() => {
    if (!currentPrivKey) return '';
    return getPublicKeyFromPrivateKey(currentPrivKey);
  }, [currentPrivKey]);

  const registeredPeer = useMemo(() => {
    if (!Array.isArray(peersList) || !currentPubKey) return null;
    return (
      peersList.find(
        (p) =>
          Boolean(p.publicKey && p.publicKey.trim().length > 20) &&
          (p.publicKey.trim() === currentPubKey.trim() || p.deviceType === activeSlot)
      ) || null
    );
  }, [peersList, currentPubKey, activeSlot]);

  const isPeerRegistered = Boolean(registeredPeer);

  const { data: profilesResponse, isLoading: isLoadingProfiles } = useSWR(
    'router-profiles',
    fetchRouterProfilesWithUserAPI,
    { revalidateOnFocus: false }
  );

  const profiles: RouterConfig[] = useMemo(() => {
    return profilesResponse?.profiles || [];
  }, [profilesResponse]);

  const loadPersistentConfig = async (slot: 'pc' | 'phone', forceSpinner = false) => {
    const email = currentUserEmail.toLowerCase().trim();
    if (!email) return;

    const hasCached = Boolean(slotConfigs[slot]);
    if (!hasCached || forceSpinner) {
      setIsGenerating(true);
    }
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
        serverConfig?.allowedIps,
        slot === 'phone'
      );

      setSlotConfigs((prev) => ({
        ...prev,
        [slot]: {
          ...config,
          clientIp: serverConfig?.clientIp || config.clientIp,
          allowedIps: serverConfig?.allowedIps || config.allowedIps,
        },
      }));
    } catch (err) {
      console.error('Error loading persistent VPN config:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    loadPersistentConfig(activeSlot);
  }, [activeSlot, currentUserEmail, keyVersion]);

  const handleSaveDeviceName = async () => {
    const email = currentUserEmail.toLowerCase().trim();
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
      if (!serverConfig?.success) {
        throw new Error('Failed to register WireGuard peer on server');
      }

      const config = await generateUserVpnConfig(
        email,
        profiles,
        serverConfig?.serverPublicKey,
        serverConfig?.endpointHost,
        serverConfig?.endpointPort,
        activeSlot,
        privKey,
        serverConfig?.clientIp,
        serverConfig?.allowedIps,
        activeSlot === 'phone'
      );

      setSlotConfigs((prev) => ({
        ...prev,
        [activeSlot]: {
          ...config,
          clientIp: serverConfig?.clientIp || config.clientIp,
          allowedIps: serverConfig?.allowedIps || config.allowedIps,
        },
      }));

      await mutatePeersList();
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
    const email = currentUserEmail.toLowerCase().trim();
    const targetPubKey = (registeredPeer?.publicKey || currentPubKey || '').trim();
    const targetIp = registeredPeer?.clientIp || vpnConfig?.clientIp;
    if (!email || !targetPubKey || isDeletingPeer) return;

    showConfirm(
      t('vpnModal.deleteTunnel') || 'Delete Tunnel',
      isRtl
        ? `هل أنت متأكد من حذف نفق WireGuard (${deviceName})؟`
        : `Are you sure you want to delete the WireGuard tunnel (${deviceName})?`,
      async () => {
        setIsDeletingPeer(true);
        setSaveError(null);
        try {
          await deleteUserVpnPeerAPI(targetPubKey, targetIp);
          // Rotate local keypair so the deleted device's .conf / QR can never reconnect if slot is re-registered
          resetUserPrivateKey(email, activeSlot);
          setSlotConfigs((prev) => {
            const next = { ...prev };
            delete next[activeSlot];
            return next;
          });
          setKeyVersion((v) => v + 1);
          await mutatePeersList();
          mutate('user-vpn-peers-status');
        } catch (err: any) {
          setSaveError(err?.message || 'Failed to delete WireGuard peer');
        } finally {
          setIsDeletingPeer(false);
        }
      }
    );
  };

  const linuxQuickCmd = useMemo(() => {
    if (!vpnConfig?.confText) return '';
    const b64 = btoa(vpnConfig.confText);
    return `sudo wg-quick down mikman 2>/dev/null; echo "${b64}" | base64 -d | sudo tee /etc/wireguard/mikman.conf > /dev/null && sudo wg-quick up mikman`;
  }, [vpnConfig]);

  const handshakeLabel = registeredPeer?.lastHandshakeHuman || (t('vpnModal.never') || 'Never');
  const peerIsOnline = Boolean(registeredPeer?.isOnline);
  const nameChanged = deviceName.trim() !== savedDeviceName.trim();

  return (
    <div className="settings-card" id="wireguard">
      {/* Section Header */}
      <div className="wg-header-row">
        <div className="wg-header-left">
          <div className="settings-section-icon red">
            <WireguardIcon size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('vpnModal.title') || 'WireGuard VPN'}</h3>
            <p className="settings-section-subtitle">
              {t('vpnModal.subtitle') || 'Direct access to WinBox, WebFig & SSH'}
            </p>
          </div>
        </div>

        <div className="wg-header-actions">
          {isPeerRegistered && (
            <button
              type="button"
              onClick={handleDeletePeer}
              disabled={isDeletingPeer}
              title={t('vpnModal.deleteTunnel') || 'Delete Tunnel'}
              className="btn-solid-red wg-header-btn"
            >
              {isDeletingPeer ? <RefreshCw size={13} className="spinner" /> : <Trash2 size={13} />}
              <span className="hide-sm-only">{t('common.delete') || 'Delete'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              mutatePeersList();
              loadPersistentConfig(activeSlot);
            }}
            disabled={isValidatingPeers || isGenerating}
            className="btn-solid-slate wg-header-btn"
            title={t('common.refresh') || 'Refresh'}
          >
            <RefreshCw size={13} className={isValidatingPeers ? 'spinner' : ''} />
            <span className="hide-sm-only">{t('common.refresh') || 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Client Device Slot Switcher */}
      <div className="wg-slot-tabs">
        <button
          type="button"
          onClick={() => setActiveSlot('pc')}
          className={`wg-slot-btn ${activeSlot === 'pc' ? 'active-pc' : ''}`}
        >
          <Laptop size={15} />
          <span>{t('vpnModal.tabPc') || 'PC / WinBox'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSlot('phone')}
          className={`wg-slot-btn ${activeSlot === 'phone' ? 'active-phone' : ''}`}
        >
          <Smartphone size={15} />
          <span>{t('vpnModal.tabMobile') || 'Phone (QR)'}</span>
        </button>
      </div>

      {(isGenerating && !vpnConfig) || (isLoadingProfiles && !vpnConfig) ? (
        <div className="wg-loading-box">
          <RefreshCw size={20} className="spinner" />
          <span>{t('vpnModal.generating') || 'Generating WireGuard tunnel...'}</span>
        </div>
      ) : (
        <>
          {/* Device Name (Top) */}
          <div className="wg-device-row">
            <div className="wg-device-input-group">
              <span className="wg-device-label">
                {activeSlot === 'phone' ? <Smartphone size={14} /> : <Laptop size={14} />}
                <span>{t('vpnModal.deviceName') || 'Device Name'}</span>
              </span>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeviceName(val);
                  if (currentUserEmail) {
                    localStorage.setItem(
                      `@wg_dev_name_${activeSlot}_${currentUserEmail.toLowerCase().trim()}`,
                      val
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveDeviceName();
                  }
                }}
                placeholder={activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC'}
                className="wg-device-input"
              />
            </div>

            {isPeerRegistered && (nameChanged || isSavingName || isNameSaved) && (
              <button
                type="button"
                onClick={handleSaveDeviceName}
                disabled={isSavingName}
                className={`${isNameSaved ? 'btn-solid-green' : 'btn-solid-blue'} wg-action-btn`}
              >
                {isSavingName ? (
                  <RefreshCw size={13} className="spinner" />
                ) : isNameSaved ? (
                  <Check size={13} />
                ) : null}
                <span>
                  {isSavingName
                    ? t('common.saving') || 'Saving...'
                    : isNameSaved
                      ? t('common.saved') || 'Saved'
                      : t('common.save') || 'Save'}
                </span>
              </button>
            )}
          </div>

          {!isPeerRegistered ? (
            <div className="wg-unregistered-panel">
              <div className="wg-unregistered-text">
                <p className="wg-unregistered-title">
                  {t('vpnModal.notRegistered') || 'Not registered on server'}
                </p>
                <p className="wg-unregistered-desc">
                  {t('vpnModal.createPeerDesc') ||
                    'Register this device to access your connected routers securely via WireGuard VPN.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveDeviceName}
                disabled={isSavingName}
                className="btn-solid-blue wg-action-btn"
              >
                {isSavingName ? <RefreshCw size={14} className="spinner" /> : <Check size={14} />}
                <span>
                  {isSavingName
                    ? t('common.saving') || 'Saving...'
                    : t('vpnModal.createPeerBtn') || 'Register & Generate Tunnel'}
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Live Peer Status */}
              <div className="wg-status-grid">
                <div className="wg-stat-cell">
                  <span className="wg-info-label">{t('vpnModal.peerStatus') || 'Peer Status'}</span>
                  <div className="wg-info-value">
                    <span className={`wg-status-dot ${peerIsOnline ? 'online' : 'offline'}`} />
                    <span className={`wg-status-text ${peerIsOnline ? 'online' : 'offline'}`}>
                      {peerIsOnline ? (t('vpnModal.online') || 'Online') : (t('vpnModal.offline') || 'Offline')}
                    </span>
                  </div>
                </div>

                <div className="wg-stat-cell">
                  <span className="wg-info-label">{t('vpnModal.lastHandshake') || 'Last Handshake'}</span>
                  <div className="wg-info-value">{handshakeLabel}</div>
                </div>
              </div>

              {/* Router VPN IP Quick Access */}
              {routerVpnIp && (
                <div className="wg-router-ip-bar">
                  <div className="wg-router-ip-meta">
                    <span className="wg-info-label">{t('vpnModal.routerVpnIp') || 'Router VPN IP'}</span>
                    <code className="wg-info-mono" dir="ltr">
                      {routerVpnIp}
                    </code>
                  </div>
                  <div className="wg-inline-actions">
                    <button
                      type="button"
                      onClick={() => triggerCopy('router-ip', routerVpnIp)}
                      className={`${copiedKey === 'router-ip' ? 'btn-solid-green' : 'btn-solid-slate'} wg-mini-btn`}
                    >
                      {copiedKey === 'router-ip' ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedKey === 'router-ip' ? (t('common.copied') || 'Copied') : 'IP'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerCopy('router-ssh', `ssh admin@${routerVpnIp}`)}
                      className={`${copiedKey === 'router-ssh' ? 'btn-solid-green' : 'btn-solid-slate'} wg-mini-btn`}
                    >
                      {copiedKey === 'router-ssh' ? <Check size={11} /> : <Terminal size={11} />}
                      <span>{copiedKey === 'router-ssh' ? (t('common.copied') || 'Copied') : 'SSH'}</span>
                    </button>
                    <a
                      href={`http://${routerVpnIp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-solid-blue wg-mini-btn"
                    >
                      <ExternalLink size={11} />
                      <span>WebFig</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Direct Download (Windows/macOS) + Linux 1-Click Copy + Phone QR */}
              <div className={`wg-config-layout ${activeSlot === 'phone' ? 'has-qr' : ''}`}>
                {activeSlot === 'phone' && (
                  <div className="wg-qr-col">
                    <div className="wg-qr-box">
                      {vpnConfig?.qrDataUrl ? (
                        <img src={vpnConfig.qrDataUrl} alt="WireGuard QR" className="wg-qr-img" />
                      ) : (
                        <div className="wg-qr-placeholder">
                          {t('vpnModal.qrUnavailable') || 'Loading QR...'}
                        </div>
                      )}
                    </div>
                    <span className="wg-qr-caption">
                      {t('vpnModal.mobileTip') || 'Scan this QR code in the WireGuard app to connect instantly.'}
                    </span>
                  </div>
                )}

                <div className={`wg-primary-actions ${activeSlot === 'phone' ? 'single' : ''}`}>
                  <button
                    type="button"
                    onClick={handleDownloadConf}
                    className="btn-solid-blue wg-primary-btn"
                  >
                    <Download size={14} />
                    <span>{t('vpnModal.downloadConf') || 'Download .conf'}</span>
                  </button>

                  {activeSlot === 'pc' && (
                    <button
                      type="button"
                      onClick={() => triggerCopy('linux-cmd', linuxQuickCmd)}
                      className={`${copiedKey === 'linux-cmd' ? 'btn-solid-green' : 'btn-solid-slate'} wg-primary-btn`}
                    >
                      {copiedKey === 'linux-cmd' ? <Check size={14} /> : <Terminal size={14} />}
                      <span>
                        {copiedKey === 'linux-cmd'
                          ? t('common.copied') || 'Copied!'
                          : t('vpnModal.linuxTitle') || 'Linux (1-Click Auto-Connect)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {saveError && <p className="wg-error-text">{saveError}</p>}
        </>
      )}
    </div>
  );
};
