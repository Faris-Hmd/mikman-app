import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  ShieldCheck,
  Smartphone,
  Laptop,
  Router,
  Download,
  Copy,
  Check,
  X,
  ExternalLink,
  Terminal,
  Lock,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';
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

  // Generate the user-isolated VPN configuration whenever modal opens or profiles update
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    const loadConfig = async () => {
      try {
        const privKey = getOrCreateUserPrivateKey(currentUserEmail);
        const pubKey = getPublicKeyFromPrivateKey(privKey);

        // Register peer public key on VPS WireGuard interface via server API
        const serverConfig = await fetchUserVpnConfigAPI(pubKey);

        const config = await generateUserVpnConfig(
          currentUserEmail,
          profiles,
          serverConfig?.serverPublicKey,
          serverConfig?.endpointHost,
          serverConfig?.endpointPort
        );

        if (isMounted) {
          setVpnConfig({
            ...config,
            clientIp: serverConfig?.clientIp || config.clientIp,
            allowedIps: serverConfig?.allowedIps || config.allowedIps,
          });
        }
      } catch (err) {
        console.error('Error generating VPN config:', err);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
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
          maxWidth: '600px',
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
        {/* Sleek, Compact Header with Integrated Security Pill */}
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
                background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.25), rgba(var(--primary-rgb), 0.05))',
                border: '1.5px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} />
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
                {t('vpnModal.title') || 'WireGuard Admin VPN'}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('vpnModal.subtitle') || 'Direct WinBox & WebFig access to your MikroTik routers'}
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

        {/* Clean Segmented Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 16px',
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
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: activeTab === 'mobile' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: activeTab === 'mobile' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Smartphone size={14} />
            {t('vpnModal.tabMobile') || 'Phone (QR)'}
          </button>

          <button
            onClick={() => setActiveTab('pc')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: activeTab === 'pc' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: activeTab === 'pc' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Laptop size={14} />
            {t('vpnModal.tabPc') || 'PC / WinBox'}
          </button>

          <button
            onClick={() => setActiveTab('routers')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: activeTab === 'routers' ? 'var(--primary)' : 'transparent',
              border: 'none',
              color: activeTab === 'routers' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Router size={14} />
            {t('vpnModal.tabRouters') || 'Routers'} ({userRouters.length})
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {isGenerating || isLoadingProfiles ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--primary)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {t('vpnModal.generating') || 'Generating your secure WireGuard tunnel...'}
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: Mobile (QR Code) */}
              {activeTab === 'mobile' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  {/* QR Card */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '12px',
                      borderRadius: '14px',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {vpnConfig?.qrDataUrl ? (
                      <img
                        src={vpnConfig.qrDataUrl}
                        alt="WireGuard QR Code"
                        style={{
                          width: '200px',
                          height: '200px',
                          display: 'block',
                          imageRendering: 'crisp-edges',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '200px',
                          height: '200px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666',
                        }}
                      >
                        {t('vpnModal.qrUnavailable') || 'QR Code loading...'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '380px' }}>
                    <button
                      onClick={handleCopyConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        background: copiedConf ? 'rgba(16, 185, 129, 0.15)' : 'var(--input-bg)',
                        border: '1px solid var(--glass-border)',
                        color: copiedConf ? '#10b981' : 'var(--foreground)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedConf ? <Check size={13} /> : <Copy size={13} />}
                      {copiedConf ? t('common.copied') || 'Copied!' : t('vpnModal.copyConfig') || 'Copy Config'}
                    </button>
                    <button
                      onClick={handleDownloadConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        background: 'var(--primary)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={13} />
                      {t('vpnModal.downloadConf') || 'Download .conf'}
                    </button>
                  </div>

                  {/* Concise Guide */}
                  <div
                    style={{
                      width: '100%',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--primary)', fontSize: '11.5px' }}>
                      📱 {t('vpnModal.mobileInstructionsTitle') || 'How to connect on iOS & Android:'}
                    </div>
                    <ol style={{ margin: 0, paddingLeft: isRtl ? 0 : '16px', paddingRight: isRtl ? '16px' : 0 }}>
                      <li>{t('vpnModal.step1Mobile') || 'Install official WireGuard from App Store / Google Play.'}</li>
                      <li>{t('vpnModal.step2Mobile') || 'Tap "+" and select "Scan from QR code".'}</li>
                      <li>{t('vpnModal.step4Mobile') || 'Toggle VPN ON to access all your routers directly!'}</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* TAB 2: PC / WinBox */}
              {activeTab === 'pc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Linux / Ubuntu 1-Click Auto-Connect */}
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={14} />
                        🐧 {t('vpnModal.linuxQuickTitle') || 'Linux / Ubuntu (1-Command Auto-Connect):'}
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
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: copiedLinuxCmd ? '#16a34a20' : 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid var(--glass-border)',
                          color: copiedLinuxCmd ? '#22c55e' : 'var(--foreground)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedLinuxCmd ? <Check size={12} /> : <Copy size={12} />}
                        {copiedLinuxCmd ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy Command')}
                      </button>
                    </div>

                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontFamily: 'monospace',
                        fontSize: '10.5px',
                        color: '#38bdf8',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {linuxQuickCmd}
                    </div>
                  </div>

                  {/* Windows / macOS .conf Download & Instructions */}
                  <div
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '12px' }}>
                        🪟 {t('vpnModal.windowsInstructionsTitle') || 'Windows & macOS Setup:'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={handleCopyConf}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: copiedConf ? 'rgba(16, 185, 129, 0.15)' : 'var(--card-bg)',
                            border: '1px solid var(--glass-border)',
                            color: copiedConf ? '#10b981' : 'var(--foreground)',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedConf ? <Check size={12} /> : <Copy size={12} />}
                          {copiedConf ? t('common.copied') || 'Copied!' : t('common.copy') || 'Copy'}
                        </button>
                        <button
                          onClick={handleDownloadConf}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--primary)',
                            border: 'none',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={12} />
                          {t('vpnModal.download') || 'Download'}
                        </button>
                      </div>
                    </div>

                    <ol style={{ margin: 0, paddingLeft: isRtl ? 0 : '16px', paddingRight: isRtl ? '16px' : 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      <li>{t('vpnModal.step1Pc') || 'Install official WireGuard for Windows / Mac.'}</li>
                      <li>{t('vpnModal.step2Pc') || 'Import the downloaded mikman.conf and click "Activate".'}</li>
                      <li>{t('vpnModal.step4Pc') || 'Open WinBox and log in directly using your router\'s VPN IP!'}</li>
                    </ol>
                  </div>

                  {/* Collapsible Raw .conf Config Preview */}
                  <div
                    style={{
                      border: '1px solid var(--glass-border)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => setShowRawConf(!showRawConf)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.2)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileCode size={13} />
                        mikman.conf (AllowedIPs: {vpnConfig?.allowedIps || '10.8.0.0/16'})
                      </span>
                      {showRawConf ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showRawConf && (
                      <pre
                        style={{
                          margin: 0,
                          padding: '10px 12px',
                          fontSize: '11px',
                          lineHeight: '1.4',
                          color: 'var(--foreground)',
                          background: 'rgba(0,0,0,0.35)',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        }}
                      >
                        {vpnConfig?.confText || '# Loading configuration...'}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Accessible Routers List */}
              {activeTab === 'routers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                    {t('vpnModal.routersNotice') ||
                      'Connected WireGuard routers (use these VPN IPs in WinBox, WebFig, or SSH):'}
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
                      <Router size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                        {t('vpnModal.noRouters') || 'No Routers Connected Yet'}
                      </div>
                    </div>
                  ) : (
                    userRouters.map((r) => {
                      const vpnIp = r.vpnIp || (r.wgClientIp ? r.wgClientIp.split('/')[0] : '') || r.ip || '';
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
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <Router size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.name || 'MikroTik Router'}
                                </span>
                                {r.model && (
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'var(--card-bg)',
                                      color: 'var(--text-muted)',
                                      border: '1px solid var(--glass-border)',
                                    }}
                                  >
                                    {r.model.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '6px',
                                padding: '3px 6px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '11px',
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
                                title="Copy WinBox IP"
                              >
                                {isCopied ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                            </div>

                            {vpnIp && (
                              <a
                                href={`http://${vpnIp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(var(--primary-rgb), 0.12)',
                                  border: '1px solid rgba(var(--primary-rgb), 0.3)',
                                  color: 'var(--primary)',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                }}
                              >
                                <ExternalLink size={10} />
                                WebFig
                              </a>
                            )}

                            <button
                              onClick={() => handleCopySsh(vpnIp, r.user || 'admin', r.id || vpnIp)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '4px 7px',
                                borderRadius: '6px',
                                background: isSshCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--card-bg)',
                                border: '1px solid var(--glass-border)',
                                color: isSshCopied ? '#10b981' : 'var(--text-muted)',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="Copy SSH command"
                            >
                              <Terminal size={10} />
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
