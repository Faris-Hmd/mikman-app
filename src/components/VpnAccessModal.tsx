import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  Shield,
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
  Info,
  Lock,
  Wifi,
  Cpu,
  RefreshCw,
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
  const [copiedIpMap, setCopiedIpMap] = useState<Record<string, boolean>>({});
  const [copiedSshMap, setCopiedSshMap] = useState<Record<string, boolean>>({});

  // Fetch router profiles to construct user-isolated AllowedIPs and router list
  const { data: profilesResponse, isLoading: isLoadingProfiles, mutate: revalidateProfiles } = useSWR(
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

  const handleCopySsh = (ip: string, user: string, id: string) => {
    const cmd = `ssh ${user || 'admin'}@${ip}`;
    navigator.clipboard.writeText(cmd);
    setCopiedSshMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedSshMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const userRouters = vpnConfig?.userRouters || profiles;

  return (
    <div
      className="modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
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
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '18px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.25), rgba(var(--primary-rgb), 0.05))',
                border: '1.5px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: '800',
                  margin: 0,
                  color: 'var(--foreground)',
                  letterSpacing: '-0.3px',
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
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Security Isolation Banner */}
        <div
          style={{
            margin: '12px 20px 0',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Lock size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: 'var(--foreground)', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700, color: '#10b981' }}>
              {t('vpnModal.isolatedBadge') || 'Tenant Isolation Active:'}{' '}
            </span>
            {t('vpnModal.isolatedText') ||
              'This VPN tunnel is strictly routed to your owned routers only. No other user can access your routers.'}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '12px 20px 0',
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
              padding: '10px 12px',
              background: activeTab === 'mobile' ? 'var(--input-bg)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'mobile' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              color: activeTab === 'mobile' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Smartphone size={15} />
            {t('vpnModal.tabMobile') || 'Phone (QR Code)'}
          </button>

          <button
            onClick={() => setActiveTab('pc')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              background: activeTab === 'pc' ? 'var(--input-bg)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'pc' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              color: activeTab === 'pc' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Laptop size={15} />
            {t('vpnModal.tabPc') || 'PC / WinBox (.conf)'}
          </button>

          <button
            onClick={() => setActiveTab('routers')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              background: activeTab === 'routers' ? 'var(--input-bg)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'routers' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              color: activeTab === 'routers' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Router size={15} />
            {t('vpnModal.tabRouters') || 'Accessible Routers'} ({userRouters.length})
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
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t('vpnModal.generating') || 'Generating your secure WireGuard tunnel...'}
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: Mobile (QR Code) */}
              {activeTab === 'mobile' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      background: '#ffffff',
                      padding: '14px',
                      borderRadius: '16px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
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
                          width: '240px',
                          height: '240px',
                          display: 'block',
                          imageRendering: 'crisp-edges',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '240px',
                          height: '240px',
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

                  {/* Steps Card */}
                  <div
                    style={{
                      width: '100%',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: 'var(--foreground)',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>
                      📱 {t('vpnModal.mobileInstructionsTitle') || 'How to connect on iOS & Android:'}
                    </div>
                    <ol style={{ margin: 0, paddingLeft: isRtl ? 0 : '18px', paddingRight: isRtl ? '18px' : 0, lineHeight: 1.6 }}>
                      <li>{t('vpnModal.step1Mobile') || 'Install the official WireGuard app from App Store or Google Play.'}</li>
                      <li>{t('vpnModal.step2Mobile') || 'Open WireGuard, tap the "+" button, and select "Scan from QR code".'}</li>
                      <li>{t('vpnModal.step3Mobile') || 'Scan the QR code above and name the tunnel (e.g. "Mikman VPN").'}</li>
                      <li>{t('vpnModal.step4Mobile') || 'Toggle the VPN ON to access all your routers via WinBox or WebFig!'}</li>
                    </ol>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button
                      onClick={handleCopyConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: copiedConf ? '#16a34a20' : 'var(--card-bg)',
                        border: '1px solid var(--glass-border)',
                        color: copiedConf ? '#16a34a' : 'var(--foreground)',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedConf ? <Check size={14} /> : <Copy size={14} />}
                      {copiedConf ? t('common.copied') || 'Copied!' : t('vpnModal.copyConfig') || 'Copy Config Text'}
                    </button>
                    <button
                      onClick={handleDownloadConf}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--primary)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={14} />
                      {t('vpnModal.downloadConf') || 'Download .conf'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: PC / WinBox (.conf) */}
              {activeTab === 'pc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                        {t('vpnModal.pcConfigTitle') || 'WireGuard Tunnel File'}
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t('vpnModal.pcConfigSubtitle') || 'Import this profile into WireGuard for Windows, macOS, or Linux.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleCopyConf}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          background: copiedConf ? '#16a34a20' : 'var(--input-bg)',
                          border: '1px solid var(--glass-border)',
                          color: copiedConf ? '#16a34a' : 'var(--foreground)',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedConf ? <Check size={13} /> : <Copy size={13} />}
                        {copiedConf ? t('common.copied') || 'Copied!' : t('common.copy') || 'Copy'}
                      </button>
                      <button
                        onClick={handleDownloadConf}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          background: 'var(--primary)',
                          border: 'none',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={13} />
                        {t('vpnModal.download') || 'Download'}
                      </button>
                    </div>
                  </div>

                  {/* Conf Preview Box */}
                  <div
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--glass-bg)',
                        borderBottom: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace' }}>mikman-vpn.conf</span>
                      <span>AllowedIPs: {vpnConfig?.allowedIps || '10.8.0.0/16'}</span>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: '12px 14px',
                        fontSize: '11.5px',
                        lineHeight: '1.5',
                        color: 'var(--foreground)',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      }}
                    >
                      {vpnConfig?.confText || '# Loading configuration...'}
                    </pre>
                  </div>

                  {/* Linux / Ubuntu Instant Setup Command */}
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={14} />
                        🐧 {t('vpnModal.linuxQuickTitle') || 'Linux / Ubuntu Quick Auto-Connect (1-Command):'}
                      </span>
                      <button
                        onClick={async () => {
                          const cmd = 'sudo wg-quick down mikman 2>/dev/null; sudo install -m 600 ~/Downloads/mikman.conf /etc/wireguard/mikman.conf && sudo wg-quick up mikman';
                          await navigator.clipboard.writeText(cmd);
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
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#38bdf8',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {'sudo wg-quick down mikman 2>/dev/null; sudo install -m 600 ~/Downloads/mikman.conf /etc/wireguard/mikman.conf && sudo wg-quick up mikman'}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                      💡 {t('vpnModal.linuxQuickNote') || 'This sets up the VPN to auto-start automatically with zero interaction.'}
                    </p>
                  </div>

                  {/* Windows & Mac Steps Card */}
                  <div
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: 'var(--foreground)',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>
                      🪟 {t('vpnModal.windowsInstructionsTitle') || 'Windows 11 / 10 & macOS Setup:'}
                    </div>
                    <ol style={{ margin: 0, paddingLeft: isRtl ? 0 : '18px', paddingRight: isRtl ? '18px' : 0, lineHeight: 1.6 }}>
                      <li>{t('vpnModal.step1Pc') || 'Download and install WireGuard for Windows / Mac.'}</li>
                      <li>{t('vpnModal.step2Pc') || 'Click "Import tunnel(s) from file" (Ctrl+O) and pick the downloaded mikman.conf file.'}</li>
                      <li>{t('vpnModal.step3Pc') || 'Click "Activate" to establish the connection.'}</li>
                      <li>{t('vpnModal.step4Pc') || 'Open WinBox, paste your router\'s VPN IP (see "Accessible Routers" tab), and log in directly!'}</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* TAB 3: Accessible Routers List */}
              {activeTab === 'routers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {t('vpnModal.routersNotice') ||
                      'Once connected to WireGuard, you can use these VPN IPs directly in WinBox, WebFig, or SSH:'}
                  </div>

                  {userRouters.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 20px',
                        textAlign: 'center',
                        background: 'var(--input-bg)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <Router size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                        {t('vpnModal.noRouters') || 'No Routers Connected Yet'}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        {t('vpnModal.noRoutersDesc') || 'Register a router in Mikman to get its secure VPN IP.'}
                      </p>
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
                            borderRadius: '12px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Router size={16} style={{ color: 'var(--primary)' }} />
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                                {r.name || 'MikroTik Router'}
                              </span>
                              {r.model && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--glass-border)',
                                  }}
                                >
                                  {r.model.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'var(--card-bg)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '4px 8px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '12px',
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
                                  color: isCopied ? '#16a34a' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '2px',
                                }}
                                title="Copy WinBox IP"
                              >
                                {isCopied ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div
                            style={{
                              display: 'flex',
                              gap: '8px',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              paddingTop: '6px',
                              borderTop: '1px dashed var(--glass-border)',
                            }}
                          >
                            <button
                              onClick={() => handleCopyIp(vpnIp, r.id || vpnIp)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: isCopied ? '#16a34a20' : 'var(--card-bg)',
                                border: '1px solid var(--glass-border)',
                                color: isCopied ? '#16a34a' : 'var(--foreground)',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isCopied ? <Check size={11} /> : <Copy size={11} />}
                              {isCopied ? t('common.copied') || 'Copied!' : t('vpnModal.copyWinboxIp') || 'Copy WinBox IP'}
                            </button>

                            {vpnIp && (
                              <a
                                href={`http://${vpnIp}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'var(--card-bg)',
                                  border: '1px solid var(--glass-border)',
                                  color: 'var(--foreground)',
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                }}
                              >
                                <ExternalLink size={11} />
                                {t('vpnModal.openWebFig') || 'Open WebFig'}
                              </a>
                            )}

                            <button
                              onClick={() => handleCopySsh(vpnIp, r.user, r.id || vpnIp)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: isSshCopied ? '#16a34a20' : 'var(--card-bg)',
                                border: '1px solid var(--glass-border)',
                                color: isSshCopied ? '#16a34a' : 'var(--foreground)',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {isSshCopied ? <Check size={11} /> : <Terminal size={11} />}
                              {isSshCopied ? t('common.copied') || 'Copied SSH!' : 'SSH Command'}
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

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Info size={13} />
            <span>{t('vpnModal.splitTunnelTip') || 'Split Tunneling: Only router traffic goes through the VPN.'}</span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--foreground)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('common.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
