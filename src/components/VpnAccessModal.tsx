import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  Smartphone,
  Laptop,
  Router,
  Download,
  Copy,
  Check,
  X,
  ExternalLink,
  Terminal,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';
import WireguardIcon from './WireguardIcon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchRouterProfilesWithUserAPI, fetchUserVpnConfigAPI } from '../api';
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
}

export default function VpnAccessModal({
  isOpen,
  onClose,
  selectedRouterVpnIp,
}: VpnAccessModalProps) {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const currentUserEmail = user?.email || '';

  const [activeTab, setActiveTab] = useState<'mobile' | 'pc' | 'routers'>('mobile');
  const [vpnConfig, setVpnConfig] = useState<VpnClientConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedConf, setCopiedConf] = useState(false);
  const [copiedLinuxCmd, setCopiedLinuxCmd] = useState(false);
  const [showRawConf, setShowRawConf] = useState(false);
  const [copiedIpMap, setCopiedIpMap] = useState<Record<string, boolean>>({});
  const [copiedSshMap, setCopiedSshMap] = useState<Record<string, boolean>>({});

  const [mobileDeviceName, setMobileDeviceName] = useState(() => {
    return localStorage.getItem(`@wg_dev_name_phone_${currentUserEmail}`) || 'Admin Phone';
  });
  const [pcDeviceName, setPcDeviceName] = useState(() => {
    return localStorage.getItem(`@wg_dev_name_pc_${currentUserEmail}`) || 'Admin PC';
  });

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

  const loadConfig = async () => {
    if (!isOpen || activeTab === 'routers') return;
    setIsGenerating(true);
    try {
      const slot = activeTab === 'mobile' ? 'phone' : 'pc';
      const deviceName = activeTab === 'mobile' ? mobileDeviceName : pcDeviceName;
      const privKey = getOrCreateUserPrivateKey(currentUserEmail, slot);
      const pubKey = getPublicKeyFromPrivateKey(privKey);

      // Register peer public key on VPS WireGuard interface via server API with custom metadata
      const serverConfig = await fetchUserVpnConfigAPI(pubKey, deviceName, slot);

      const config = await generateUserVpnConfig(
        currentUserEmail,
        profiles,
        serverConfig?.serverPublicKey,
        serverConfig?.endpointHost,
        serverConfig?.endpointPort,
        slot,
        privKey,
        serverConfig?.clientIp
      );

      setVpnConfig({
        ...config,
        clientIp: serverConfig?.clientIp || config.clientIp,
        allowedIps: serverConfig?.allowedIps || config.allowedIps,
      });
    } catch (err) {
      console.error('Error generating VPN config:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate configuration whenever modal opens, tab changes, or profiles update
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, activeTab, currentUserEmail, profiles]);

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

  const handleCopyIp = (ip: string, id: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIpMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedIpMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleCopySsh = (ip: string, userStr: string, id: string) => {
    const cmd = `ssh ${userStr || 'admin'}@${ip}`;
    navigator.clipboard.writeText(cmd);
    setCopiedSshMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedSshMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const userRouters = vpnConfig?.userRouters || profiles;

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
          maxWidth: '440px',
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

        {/* Clean Single-line Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.15)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <button
            onClick={() => setActiveTab('mobile')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '7px 6px',
              borderRadius: '7px',
              background: activeTab === 'mobile' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: activeTab === 'mobile' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={13} />
            <span>{t('vpnModal.tabMobile') || 'Phone (QR)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('pc')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '7px 6px',
              borderRadius: '7px',
              background: activeTab === 'pc' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: activeTab === 'pc' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Laptop size={13} />
            <span>{t('vpnModal.tabPc') || 'PC'}</span>
          </button>

          <button
            onClick={() => setActiveTab('routers')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '7px 6px',
              borderRadius: '7px',
              background: activeTab === 'routers' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: activeTab === 'routers' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Router size={13} />
            <span>{t('vpnModal.tabRouters') || 'Routers'} ({userRouters.length})</span>
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
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
              {/* TAB 1: Mobile (QR Code) */}
              {activeTab === 'mobile' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  {/* Device Name Metadata Input */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      📱 {t('vpnModal.deviceName') || 'Device Name'}:
                    </span>
                    <input
                      type="text"
                      value={mobileDeviceName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMobileDeviceName(val);
                        localStorage.setItem(`@wg_dev_name_phone_${currentUserEmail}`, val);
                      }}
                      onBlur={() => loadConfig()}
                      placeholder="e.g. My iPhone"
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--foreground)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  {/* Clean QR Display */}
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

                  {/* Clean Tip */}
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      margin: '0',
                      textAlign: 'center',
                      lineHeight: 1.4,
                    }}
                  >
                    {t('vpnModal.mobileTip') || 'Scan this QR code in the WireGuard app to connect instantly.'}
                  </p>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={handleCopyConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: copiedConf ? 'rgba(16, 185, 129, 0.15)' : 'var(--input-bg)',
                        border: '1px solid var(--glass-border)',
                        color: copiedConf ? '#10b981' : 'var(--foreground)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedConf ? <Check size={13} /> : <Copy size={13} />}
                      {copiedConf ? (t('common.copied') || 'Copied!') : (t('vpnModal.copyConfig') || 'Copy Config')}
                    </button>
                    <button
                      onClick={handleDownloadConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--primary)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={13} />
                      {t('vpnModal.downloadConf') || 'Download .conf'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PC / WinBox */}
              {activeTab === 'pc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Device Name Metadata Input */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      💻 {t('vpnModal.deviceName') || 'Device Name'}:
                    </span>
                    <input
                      type="text"
                      value={pcDeviceName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPcDeviceName(val);
                        localStorage.setItem(`@wg_dev_name_pc_${currentUserEmail}`, val);
                      }}
                      onBlur={() => loadConfig()}
                      placeholder="e.g. MacBook Pro"
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--foreground)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  {/* Action Buttons at Top */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleDownloadConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--primary)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={13} />
                      {t('vpnModal.downloadConf') || 'Download .conf'}
                    </button>
                    <button
                      onClick={handleCopyConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: copiedConf ? 'rgba(16, 185, 129, 0.15)' : 'var(--input-bg)',
                        border: '1px solid var(--glass-border)',
                        color: copiedConf ? '#10b981' : 'var(--foreground)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedConf ? <Check size={13} /> : <Copy size={13} />}
                      {copiedConf ? (t('common.copied') || 'Copied!') : (t('vpnModal.copyConfig') || 'Copy Config')}
                    </button>
                  </div>

                  {/* Windows & Mac Short Card */}
                  <div
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '11.5px', marginBottom: '6px' }}>
                      🪟 {t('vpnModal.windowsTitle') || 'Windows & macOS (.conf)'}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: isRtl ? 0 : '16px', paddingRight: isRtl ? '16px' : 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <li>{t('vpnModal.windowsStep1') || 'Import mikman.conf in WireGuard and click Activate.'}</li>
                      <li>{t('vpnModal.windowsStep2') || 'Open WinBox and connect directly via router VPN IP.'}</li>
                    </ul>
                  </div>

                  {/* Linux 1-Command Setup Card */}
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
                          padding: '3px 7px',
                          borderRadius: '5px',
                          background: copiedLinuxCmd ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid var(--glass-border)',
                          color: copiedLinuxCmd ? '#10b981' : 'var(--foreground)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedLinuxCmd ? <Check size={11} /> : <Copy size={11} />}
                        {copiedLinuxCmd ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}
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

                  {/* Optional View Config Collapsible */}
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
                </div>
              )}

              {/* TAB 3: Routers List */}
              {activeTab === 'routers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                    {t('vpnModal.routersNotice') || 'Use these VPN IPs directly in WinBox, WebFig, or SSH:'}
                  </div>

                  {userRouters.length === 0 ? (
                    <div
                      style={{
                        padding: '24px 16px',
                        textAlign: 'center',
                        background: 'var(--input-bg)',
                        borderRadius: '10px',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <Router size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--foreground)' }}>
                        {t('vpnModal.noRouters') || 'No Routers Connected Yet'}
                      </div>
                    </div>
                  ) : (
                    userRouters.map((r) => {
                      const vpnIp = getRouterVpnIp(r);
                      const isSelected = selectedRouterVpnIp && (selectedRouterVpnIp === vpnIp || selectedRouterVpnIp === r.id);
                      const isCopied = copiedIpMap[r.id || vpnIp];
                      const isSshCopied = copiedSshMap[r.id || vpnIp];

                      return (
                        <div
                          key={r.id || vpnIp}
                          style={{
                            background: isSelected ? 'rgba(var(--primary-rgb), 0.08)' : 'var(--input-bg)',
                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--glass-border)',
                            borderRadius: '10px',
                            padding: '9px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '7px',
                          }}
                        >
                          {/* Top: Router Name & Model */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <Router size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: 'var(--foreground)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {r.name || 'MikroTik Router'}
                              </span>
                            </div>

                            {r.model && (
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'var(--card-bg)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--glass-border)',
                                  flexShrink: 0,
                                }}
                              >
                                {r.model.toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Bottom: All Badges Uniformly Aligned to the Left */}
                          <div
                            dir="ltr"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              justifyContent: 'flex-start',
                              flexWrap: 'nowrap',
                            }}
                          >
                            {/* Monospace VPN IP Pill */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '5px',
                                padding: '2px 6px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  color: 'var(--primary)',
                                }}
                              >
                                {vpnIp || '10.8.x.x'}
                              </span>
                              <button
                                onClick={() => handleCopyIp(vpnIp, r.id || vpnIp)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: isCopied ? '#10b981' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '1px',
                                }}
                                title="Copy IP"
                              >
                                {isCopied ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>

                            {/* WebFig Link */}
                            {vpnIp && (
                              <a
                                href={`http://${vpnIp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '3px 7px',
                                  borderRadius: '5px',
                                  background: 'rgba(var(--primary-rgb), 0.12)',
                                  border: '1px solid rgba(var(--primary-rgb), 0.3)',
                                  color: 'var(--primary)',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                }}
                              >
                                <ExternalLink size={9} />
                                WebFig
                              </a>
                            )}

                            {/* SSH Command */}
                            <button
                              onClick={() => handleCopySsh(vpnIp, r.user || 'admin', r.id || vpnIp)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: '3px 7px',
                                borderRadius: '5px',
                                background: isSshCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--card-bg)',
                                border: '1px solid var(--glass-border)',
                                color: isSshCopied ? '#10b981' : 'var(--text-muted)',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="Copy SSH"
                            >
                              <Terminal size={9} />
                              {isSshCopied ? (t('common.copied') || 'Copied!') : 'SSH'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
