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
} from 'lucide-react';
import WireguardIcon from './WireguardIcon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchUserVpnConfigAPI } from '../api';
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
}: VpnAccessModalProps) {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const currentUserEmail = user?.email || '';

  const [vpnConfig, setVpnConfig] = useState<VpnClientConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedConf, setCopiedConf] = useState(false);
  const [copiedLinuxCmd, setCopiedLinuxCmd] = useState(false);
  const [showRawConf, setShowRawConf] = useState(false);

  const [deviceName, setDeviceName] = useState('Admin Device');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isNameSaved, setIsNameSaved] = useState(false);

  // Hydrate device name from localStorage once user email is known
  useEffect(() => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;
    const saved =
      localStorage.getItem(`@wg_dev_name_${email}`) ||
      localStorage.getItem(`@wg_dev_name_client_${email}`) ||
      localStorage.getItem(`@wg_dev_name_pc_${email}`) ||
      localStorage.getItem(`@wg_dev_name_phone_${email}`);
    if (saved) setDeviceName(saved);
  }, [currentUserEmail]);

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

  // Save device name to both localStorage and the VPS server without changing keys or breaking the tunnel
  const handleSaveDeviceName = async () => {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;

    const nameToSave = deviceName.trim() || 'Admin Device';

    setIsSavingName(true);
    try {
      localStorage.setItem(`@wg_dev_name_${email}`, nameToSave);
      localStorage.setItem(`@wg_dev_name_client_${email}`, nameToSave);
      setDeviceName(nameToSave);

      const privKey = getOrCreateUserPrivateKey(email, 'client');
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      // Contact VPS to save the updated name on the peer
      await fetchUserVpnConfigAPI(pubKey, nameToSave, 'device');

      // Mutate peer telemetry list so Landing page updates immediately
      mutate(['user-vpn-peers-telemetry', email]);
      mutate('user-vpn-peers-status');

      setIsNameSaved(true);
      setTimeout(() => setIsNameSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save device name:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  // Load persistent configuration
  const loadPersistentConfig = async () => {
    if (!isOpen) return;
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (!email) return;

    setIsGenerating(true);
    try {
      const savedName =
        localStorage.getItem(`@wg_dev_name_${email}`) ||
        localStorage.getItem(`@wg_dev_name_client_${email}`) ||
        deviceName;

      // Stable deterministic Curve25519 private key
      const privKey = getOrCreateUserPrivateKey(email, 'client');
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      // Ensure peer is registered on VPS WireGuard and fetch assigned IP and server public key
      const serverConfig = await fetchUserVpnConfigAPI(pubKey, savedName, 'device');

      if (serverConfig && (serverConfig as any).deviceName) {
        const sName = (serverConfig as any).deviceName;
        setDeviceName(sName);
        localStorage.setItem(`@wg_dev_name_${email}`, sName);
      }

      const config = await generateUserVpnConfig(
        email,
        profiles,
        serverConfig?.serverPublicKey,
        serverConfig?.endpointHost,
        serverConfig?.endpointPort,
        'client',
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

  // Automatically load the pre-configured persistent peer when modal is open
  useEffect(() => {
    if (isOpen) {
      loadPersistentConfig();
    }
  }, [isOpen, currentUserEmail, profiles]);

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
          maxWidth: '460px',
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
            padding: '12px 16px',
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
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <WireguardIcon size={18} color="#ef4444" />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '14px',
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
                  fontSize: '11px',
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

        {/* Scrollable All-In-One Content */}
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    📱💻 {t('vpnModal.deviceName') || 'Device Name'}:
                  </span>
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDeviceName(val);
                      if (currentUserEmail) {
                        localStorage.setItem(`@wg_dev_name_${currentUserEmail.toLowerCase().trim()}`, val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveDeviceName();
                      }
                    }}
                    onBlur={handleSaveDeviceName}
                    placeholder="Admin Device"
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
                    padding: '5px 10px',
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
                  <span>{isNameSaved ? (t('common.saved') || 'Saved') : (t('common.save') || 'Save')}</span>
                </button>
              </div>

              {/* 2. QR Code (Phone Scanning) */}
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
                        width: '155px',
                        height: '155px',
                        display: 'block',
                        imageRendering: 'crisp-edges',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '155px',
                        height: '155px',
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

              {/* 4. Linux 1-Click Command */}
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

              {/* 5. Instructions Card */}
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

              {/* 6. View Raw Config Collapsible */}
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
        </div>
      </div>
    </div>
  );
}
