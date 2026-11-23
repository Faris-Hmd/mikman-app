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
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchUserVpnConfigAPI, fetchUserVpnPeersStatusAPI } from '../../api';
import { getRouterVpnIp } from '../../lib/helpers';
import {
  generateUserVpnConfig,
  downloadVpnConfigFile,
  VpnClientConfig,
  getOrCreateUserPrivateKey,
  getPublicKeyFromPrivateKey,
} from '../../lib/wireguardVpn';
import type { RouterConfig } from '../../store';
import './vpn-modal.css';
import '../layout/shell.css';

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

  useEffect(() => {
    if (initialTab === 'phone' || initialTab === 'pc') {
      setActiveSlot(initialTab);
    }
  }, [initialTab, isOpen]);

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

  const { data: profilesResponse, isLoading: isLoadingProfiles } = useSWR(
    isOpen ? 'router-profiles-user' : null,
    fetchRouterProfilesWithUserAPI,
    { revalidateOnFocus: false }
  );

  const profiles: RouterConfig[] = useMemo(() => {
    return profilesResponse?.profiles || [];
  }, [profilesResponse]);

  const handleSaveDeviceName = async () => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email || isSavingName) return;

    const defaultName = activeSlot === 'phone' ? 'Admin Phone' : 'Admin PC';
    const nameToSave = deviceName.trim() || defaultName;

    setIsSavingName(true);
    try {
      localStorage.setItem(`@wg_dev_name_${activeSlot}_${email}`, nameToSave);
      setDeviceName(nameToSave);

      const privKey = getOrCreateUserPrivateKey(email, activeSlot);
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      // Explicitly register and activate the peer on the VPS WireGuard kernel
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

  useEffect(() => {
    if (isOpen) {
      loadPersistentConfig(activeSlot);
    }
  }, [isOpen, currentUserEmail, profiles, activeSlot]);

  const handleDownloadConf = () => {
    if (!vpnConfig?.confText) return;
    const safeName = deviceName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `mikman_${activeSlot}_${safeName}.conf`;
    downloadVpnConfigFile(vpnConfig.confText, filename);
  };

  const handleCopyConf = async () => {
    if (!vpnConfig?.confText) return;
    await navigator.clipboard.writeText(vpnConfig.confText);
    setCopiedConf(true);
    setTimeout(() => setCopiedConf(false), 2000);
  };

  const handleCopyIp = async (ip: string, id: string) => {
    if (!ip) return;
    await navigator.clipboard.writeText(ip);
    setCopiedIpMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setCopiedIpMap((prev) => ({ ...prev, [id]: false })), 2000);
  };

  const handleCopySsh = async (ip: string, user: string = 'admin', id: string) => {
    if (!ip) return;
    const cmd = `ssh ${user}@${ip}`;
    await navigator.clipboard.writeText(cmd);
    setCopiedSshMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setCopiedSshMap((prev) => ({ ...prev, [id]: false })), 2000);
  };

  const linuxQuickCmd = useMemo(() => {
    if (!vpnConfig?.confText) return '';
    const b64 = btoa(vpnConfig.confText);
    return `echo "${b64}" | base64 -d | sudo tee /etc/wireguard/mikman.conf > /dev/null && sudo wg-quick up mikman`;
  }, [vpnConfig]);

  if (!isOpen) return null;

  return (
    <div
      className={`vpn-modal-backdrop ${isRtl ? 'rtl' : 'ltr'}`}
      onClick={onClose}
    >
      <div
        className="vpn-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="vpn-modal-header">
          <div className="vpn-modal-header-left">
            <div className="vpn-modal-logo">
              <WireguardIcon size={19} color="#ef4444" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold m-0 text-foreground">
                {t('vpnModal.title') || 'WireGuard VPN'}
              </h2>
              <p className="text-[11.5px] text-muted m-0 mt-0.5">
                {t('vpnModal.subtitle') || 'Direct access to WinBox & WebFig'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="vpn-modal-close-btn"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="vpn-modal-tabs">
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

        {/* Content */}
        <div className="vpn-modal-content">
          {isGenerating || isLoadingProfiles ? (
            <div className="text-center py-9">
              <div className="spinner mx-auto mb-2.5" />
              <p className="text-xs text-muted m-0">
                {t('vpnModal.generating') || 'Generating WireGuard tunnel...'}
              </p>
            </div>
          ) : (
            <>
              {/* Device Name Bar */}
              <div className="vpn-device-name-bar">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-muted whitespace-nowrap">
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
                    className="vpn-device-name-input"
                  />
                </div>
                <button
                  onClick={handleSaveDeviceName}
                  disabled={isSavingName}
                  title={t('common.save') || 'Save Device Name'}
                  className={`${isNameSaved ? 'btn-solid-green' : 'btn-solid-blue'} px-3 py-1.5 text-[11px] rounded-md`}
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
                <div className="p-6 text-center bg-input rounded-xl border border-dashed border-glass flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center text-primary">
                    {activeSlot === 'phone' ? <Smartphone size={20} /> : <Laptop size={20} />}
                  </div>
                  <div className="max-w-[320px]">
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
                    onClick={handleSaveDeviceName}
                    disabled={isSavingName}
                    className="btn-solid-blue px-4 py-2 text-xs rounded-lg inline-flex items-center gap-1.5"
                  >
                    {isSavingName ? <RefreshCw size={13} className="spinner" /> : <Check size={13} />}
                    <span>{isSavingName ? (t('common.saving') || 'Saving...') : (t('vpnModal.createPeerBtn') || 'Save & Activate Tunnel')}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* QR Code (Phone only) */}
                  {activeSlot === 'phone' && (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="vpn-qr-box">
                        {vpnConfig?.qrDataUrl ? (
                          <img
                            src={vpnConfig.qrDataUrl}
                            alt="WireGuard QR"
                            className="w-[165px] h-[165px] block [image-rendering:crisp-edges]"
                          />
                        ) : (
                          <div className="w-[165px] h-[165px] flex items-center justify-center text-muted text-xs">
                            {t('vpnModal.qrUnavailable') || 'Loading QR...'}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted text-center">
                        📱 {t('vpnModal.mobileTip') || 'Scan with WireGuard on your mobile phone'}
                      </span>
                    </div>
                  )}

                  {/* Primary Actions: Download .conf & Copy Config */}
                  <div className="vpn-actions-strip">
                    <button
                      onClick={handleDownloadConf}
                      className="btn-solid-blue flex-1 py-2 text-xs rounded-lg"
                    >
                      <Download size={14} />
                      <span>{t('vpnModal.downloadConf') || 'Download .conf'}</span>
                    </button>
                    <button
                      onClick={handleCopyConf}
                      className={`${copiedConf ? 'btn-solid-green' : 'btn-solid-slate'} flex-1 py-2 text-xs rounded-lg`}
                    >
                      {copiedConf ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedConf ? (t('common.copied') || 'Copied!') : (t('vpnModal.copyConfig') || 'Copy Config')}</span>
                    </button>
                  </div>

                  {/* PC view: Linux 1-Click Command */}
                  {activeSlot === 'pc' && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sky-400 text-xs flex items-center gap-1.5">
                          <Terminal size={13} />
                          🐧 {t('vpnModal.linuxTitle') || 'Linux (1-Click Command)'}
                        </span>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(linuxQuickCmd);
                            setCopiedLinuxCmd(true);
                            setTimeout(() => setCopiedLinuxCmd(false), 2000);
                          }}
                          className={`${copiedLinuxCmd ? 'btn-solid-green' : 'btn-solid-slate'} px-2 py-1 text-[10.5px] rounded`}
                        >
                          {copiedLinuxCmd ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedLinuxCmd ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}</span>
                        </button>
                      </div>

                      <div className="bg-black/40 border border-white/10 rounded-md p-2 font-mono text-[10px] text-sky-400 overflow-x-auto whitespace-nowrap">
                        {linuxQuickCmd}
                      </div>
                    </div>
                  )}

                  {/* Connected Routers: WebFig & WinBox Access */}
                  <div className="bg-input border border-glass rounded-xl p-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <RouterIcon size={16} color="var(--primary)" />
                        {t('vpnModal.routersTitle') || (isRtl ? 'الوصول المباشر للراوترات (WebFig & WinBox)' : 'Direct Router Access (WebFig & WinBox)')}
                      </span>
                      <span className="text-[11px] font-bold text-muted">
                        {profiles.length} {isRtl ? 'راوتر' : 'routers'}
                      </span>
                    </div>

                    <div className="vpn-routers-table max-h-[260px] overflow-y-auto">
                      {profiles.length === 0 ? (
                        <div className="text-xs text-muted text-center py-4">
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
                              className={`vpn-router-row ${isSelected ? 'border-primary bg-blue-500/10' : ''}`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-foreground truncate">
                                  {r.name || 'MikroTik Router'}
                                </div>
                                <div className="text-[11px] font-mono text-sky-400 mt-0.5">
                                  {vpnIp || 'No VPN IP'}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {vpnIp ? (
                                  <a
                                    href={`http://${vpnIp}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-solid-blue px-3 py-1.5 text-xs rounded-md no-underline inline-flex items-center gap-1"
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
                                    className={`${isIpCopied ? 'btn-solid-green' : 'btn-solid-slate'} px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1`}
                                    title="Copy WinBox IP"
                                  >
                                    {isIpCopied ? <Check size={13} /> : <Copy size={13} />}
                                    <span>{isIpCopied ? (t('vpnModal.copiedIp') || 'Copied!') : (t('vpnModal.copyWinboxIp') || 'WinBox')}</span>
                                  </button>
                                ) : null}

                                {vpnIp ? (
                                  <button
                                    onClick={() => handleCopySsh(vpnIp, r.user, r.id || '')}
                                    className={`${isSshCopied ? 'btn-solid-green' : 'btn-solid-slate'} px-2.5 py-1.5 text-xs rounded-md inline-flex items-center gap-1`}
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

                  {/* Instructions Card */}
                  <div className="bg-input border border-glass rounded-xl p-2.5 text-xs">
                    <div className="font-bold text-foreground mb-1">
                      📖 {t('vpnModal.quickInstructions') || 'Quick Setup Instructions'}
                    </div>
                    <ul className={`m-0 text-muted leading-relaxed text-[11px] ${isRtl ? 'pr-4' : 'pl-4'}`}>
                      <li><strong>📱 {isRtl ? 'الهاتف:' : 'Phone:'}</strong> {t('vpnModal.instrPhone') || 'Scan the QR code above in the WireGuard mobile app.'}</li>
                      <li><strong>💻 {isRtl ? 'ويندوز وماك:' : 'Windows & macOS:'}</strong> {t('vpnModal.instrWindows') || 'Click Download .conf, import into WireGuard, and activate.'}</li>
                      <li><strong>🐧 {isRtl ? 'لينكس:' : 'Linux:'}</strong> {t('vpnModal.instrLinux') || 'Copy and run the 1-click terminal command above.'}</li>
                    </ul>
                  </div>

                  {/* View Raw Config Collapsible */}
                  <div className="border border-glass rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowRawConf(!showRawConf)}
                      className="w-full p-2 bg-black/15 border-none flex items-center justify-between text-muted text-[10.5px] font-semibold cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileCode size={12} />
                        {t('vpnModal.showConfig') || 'View .conf configuration'}
                      </span>
                      {showRawConf ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showRawConf && (
                      <pre className="vpn-raw-code-box m-0 border-t border-glass">
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
