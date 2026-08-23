import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchSingleRouterStatusAPI,
  fetchRouterProfilesWithUserAPI,
  updateRouterProfileAPI,
  provisionWifiSSIDAPI,
  provisionHotspotServerAPI,
  provisionHotspotFilesAPI,
  fetchHotspotUploadJobStatusAPI,
  deleteRouterProfileAPI,
  generateCloudScriptAPI,
  formatUptimeAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import {
  Router,
  Wifi,
  Server,
  UploadCloud,
  Save,
  Trash2,
  Cpu,
  User,
  Users,
  MapPin,
  RefreshCw,
  Activity,
  HardDrive,
  Clock,
  ShieldAlert,
  Plus,
  Terminal,
  Copy,
  Check,
  Tag,
  Smartphone,
  Settings as SettingsIcon,
} from 'lucide-react';

const HARDWARE_MODELS: { value: string; label: string }[] = [
  { value: 'hap-ax3', label: 'hAP AX³' },
  { value: 'hap-ax2', label: 'hAP AX²' },
  { value: 'hap-ac3', label: 'hAP AC³' },
  { value: 'hap-ac2', label: 'hAP AC²' },
  { value: 'hap-ax-lite', label: 'hAP AX Lite' },
  { value: 'hap-lite', label: 'hAP Lite' },
  { value: 'l009', label: 'L009' },
  { value: 'chr', label: 'CHR (Cloud Hosted Router)' },
  { value: 'other', label: 'Other' },
];

import { TIMEZONES } from '../../constants/timezones';

export default function SettingsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { showAlert, showConfirm } = useModal();
  const { user } = useAuth();
  const currentUserEmail = user?.email ? user.email.toLowerCase().trim() : '';

  const [primaryOwner, setPrimaryOwner] = useState<string>('');

  // Loading states for actions
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isProvisioningWifi, setIsProvisioningWifi] = useState(false);
  const [isProvisioningServer, setIsProvisioningServer] = useState(false);
  const [isProvisioningFiles, setIsProvisioningFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Router Info Form State
  const [infoForm, setInfoForm] = useState<{
    name: string;
    model: string;
    timezone: string;
    owners: string[];
  }>({
    name: '',
    model: 'hap-ax3',
    timezone: 'UTC',
    owners: [''],
  });

  // Wi-Fi SSID Form State
  const [wifiSsid, setWifiSsid] = useState('');

  // Branding & Print Label Form State
  const [hotspotWifiName, setHotspotWifiName] = useState('');
  const [cardPrintLabel, setCardPrintLabel] = useState('');
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const useCustomHotspotName = !!hotspotWifiName.trim();
  const useCustomPrintLabel = !!cardPrintLabel.trim();

  // Provisioning Terminal Script State
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Fetch telemetry status
  const { data: status, isLoading: isStatusLoading, mutate: mutateStatus } = useSWR(
    routerId ? `router-settings-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { revalidateOnFocus: true }
  );

  // Fetch current router profile config
  useEffect(() => {
    if (!routerId) return;
    let isMounted = true;

    fetchRouterProfilesWithUserAPI().then(({ profiles }) => {
      if (!isMounted) return;
      const currentConfig = profiles.find((p) => p.id === routerId);
      if (currentConfig) {
        const pOwner = currentConfig.owner ? currentConfig.owner.toLowerCase().trim() : '';
        setPrimaryOwner(pOwner);

        let ownersList: string[] = [];
        if (Array.isArray(currentConfig.owners) && currentConfig.owners.length > 0) {
          ownersList = currentConfig.owners;
        } else if (currentConfig.owner) {
          ownersList = [currentConfig.owner];
        } else {
          ownersList = [''];
        }

        setInfoForm({
          name: currentConfig.name || routerId,
          model: currentConfig.model || 'hap-ax3',
          timezone: currentConfig.timezone || status?.timezone || 'UTC',
          owners: ownersList,
        });

        const savedHotspot = currentConfig.hotspotWifiName || (currentConfig as any).hotspot_wifi_name || '';
        const savedLabel = currentConfig.cardPrintLabel || (currentConfig as any).card_print_label || '';

        setHotspotWifiName(savedHotspot);
        setCardPrintLabel(savedLabel);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [routerId]);

  // Populate Wi-Fi SSID and Timezone strictly from router status API (live router settings)
  useEffect(() => {
    if (status?.wifiName) {
      setWifiSsid(status.wifiName);
    }
    if (status?.timezone) {
      setInfoForm((prev) => ({
        ...prev,
        timezone: status.timezone,
      }));
    }
  }, [status?.wifiName, status?.timezone]);

  const safeOwners = Array.isArray(infoForm.owners)
    ? infoForm.owners
    : typeof infoForm.owners === 'string'
    ? (infoForm.owners as string).split(',').map((s) => s.trim())
    : [''];

  // Owners list handlers
  const handleOwnerChange = (index: number, value: string) => {
    setInfoForm((prev) => {
      const current = Array.isArray(prev.owners) ? [...prev.owners] : [String(prev.owners || '')];
      current[index] = value;
      return { ...prev, owners: current };
    });
  };

  const handleAddOwner = () => {
    setInfoForm((prev) => {
      const current = Array.isArray(prev.owners) ? [...prev.owners] : [String(prev.owners || '')];
      return { ...prev, owners: [...current, ''] };
    });
  };

  const handleRemoveOwner = (index: number) => {
    setInfoForm((prev) => {
      const current = Array.isArray(prev.owners) ? prev.owners : [String(prev.owners || '')];
      const updated = current.filter((_, i) => i !== index);
      return { ...prev, owners: updated.length > 0 ? updated : [''] };
    });
  };

  // ── Action Handlers ──

  // 1. Save Router Info
  const handleSaveRouterInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    const ownersArray = safeOwners
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    try {
      setIsSavingInfo(true);
      await updateRouterProfileAPI(routerId, {
        name: infoForm.name.trim(),
        model: infoForm.model,
        timezone: infoForm.timezone,
        owners: ownersArray,
      });

      showAlert(t('common.success'), t('settings.infoSavedSuccess'), 'success');
      mutateStatus();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(t('dashboard.saveFailed'), (t('dashboard.saveFailedMsg') || 'Failed to save: {error}').replace('{error}', errMsg), 'error');
    } finally {
      setIsSavingInfo(false);
    }
  };

  // 1b. Save Branding Settings
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    try {
      setIsSavingBranding(true);
      await updateRouterProfileAPI(routerId, {
        useCustomHotspotName: !!hotspotWifiName.trim(),
        hotspotWifiName: hotspotWifiName.trim(),
        useCustomPrintLabel: !!cardPrintLabel.trim(),
        cardPrintLabel: cardPrintLabel.trim(),
      });

      showAlert(t('common.success'), t('settings.infoSavedSuccess'), 'success');
      mutateStatus();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(t('common.error'), errMsg, 'error');
    } finally {
      setIsSavingBranding(false);
    }
  };

  // 2. Reset / Provision Wi-Fi SSID
  const handleProvisionWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    if (!wifiSsid.trim()) {
      showAlert(t('common.error'), t('dashboard.deviceNameWifiSsidRequired'), 'error');
      return;
    }

    try {
      setIsProvisioningWifi(true);
      await provisionWifiSSIDAPI(routerId, wifiSsid.trim());
      showAlert(t('common.success'), t('settings.wifiSavedSuccess'), 'success');
      mutateStatus();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(t('common.error'), errMsg, 'error');
    } finally {
      setIsProvisioningWifi(false);
    }
  };

  // 3. Provision Hotspot Server ("Separate Hotspot Server")
  const handleProvisionHotspotServer = async () => {
    if (!routerId) return;

    showConfirm(
      t('settings.confirmProvisionHotspotServerTitle'),
      t('settings.confirmProvisionHotspotServerDesc'),
      async () => {
        try {
          setIsProvisioningServer(true);
          const res = await provisionHotspotServerAPI(routerId);
          if (res?.success) {
            showAlert(
              t('common.success'),
              res.message || t('settings.hotspotServerSuccess'),
              'success'
            );
          } else {
            showAlert(
              t('common.error'),
              res?.message || 'Failed to provision Hotspot Server.',
              'error'
            );
          }
          mutateStatus();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          showAlert(t('common.error'), errMsg, 'error');
        } finally {
          setIsProvisioningServer(false);
        }
      }
    );
  };

  // 4. Send Hotspot Files
  const executeProvisionHotspotFiles = async () => {
    if (!routerId) return;

    const targetHotspotName = (useCustomHotspotName && hotspotWifiName.trim())
      ? hotspotWifiName.trim()
      : (wifiSsid.trim() || status?.wifiName || 'MikroTik Wi-Fi');

    try {
      setIsProvisioningFiles(true);
      const res = await provisionHotspotFilesAPI(routerId, {
        wifiName: targetHotspotName,
      });

      if (res.jobId) {
        const jobId = res.jobId;
        let completed = false;
        let attempts = 0;
        const maxAttempts = 120; // Up to 4 minutes polling

        while (!completed && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;
          try {
            const jobStatus = await fetchHotspotUploadJobStatusAPI(routerId, jobId);
            if (jobStatus.status === 'completed') {
              completed = true;
              showAlert(t('common.success'), jobStatus.message || t('settings.hotspotFilesSuccess'), 'success');
              mutateStatus();
            } else if (jobStatus.status === 'failed') {
              completed = true;
              showAlert(t('common.error'), jobStatus.error || 'Failed to upload portal files.', 'error');
            }
          } catch (pollErr) {
            console.warn('Error polling hotspot upload job status:', pollErr);
          }
        }

        if (!completed) {
          showAlert(t('common.error'), 'Upload status check timed out.', 'error');
        }
      } else if (res.success) {
        showAlert(t('common.success'), res.message || t('settings.hotspotFilesSuccess'), 'success');
        mutateStatus();
      } else {
        showAlert(t('common.error'), res.message || 'Failed to upload portal files.', 'error');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(t('common.error'), errMsg, 'error');
    } finally {
      setIsProvisioningFiles(false);
    }
  };

  const handleProvisionHotspotFiles = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    const targetHotspotName = (useCustomHotspotName && hotspotWifiName.trim())
      ? hotspotWifiName.trim()
      : (wifiSsid.trim() || status?.wifiName || 'MikroTik Wi-Fi');

    const desc = t('settings.confirmSendHotspotFilesDesc').replace('{brandName}', targetHotspotName);

    showConfirm(
      t('settings.confirmSendHotspotFilesTitle'),
      desc,
      executeProvisionHotspotFiles
    );
  };

  // 5. Generate / Re-generate Terminal Provisioning Script
  const handleGenerateProvisionScript = async () => {
    if (!routerId) return;
    try {
      setIsGeneratingScript(true);
      setCopiedScript(false);
      const res = await generateCloudScriptAPI({
        id: routerId,
        name: infoForm.name.trim() || 'Router',
        model: infoForm.model || 'other',
        wifiName: wifiSsid.trim() || 'MikroTik Wi-Fi',
        user: 'admin',
        owners: safeOwners,
        timezone: infoForm.timezone || 'Africa/Khartoum',
      });
      setGeneratedScript(res.script || '');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(t('dashboard.scriptError') || 'Script Error', errMsg, 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleCopyScript = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const isPrimaryOwner = !primaryOwner || !currentUserEmail || primaryOwner === currentUserEmail;

  // 5. Delete or Unshare Router Profile
  const handleDeleteRouter = () => {
    if (!routerId) return;

    const title = isPrimaryOwner
      ? (t('settings.deleteConfirmTitle') || 'Delete Router')
      : (t('settings.unshareConfirmTitle') || 'Remove Router from My Account');

    const desc = isPrimaryOwner
      ? (t('settings.deleteConfirmDesc') || 'Are you sure you want to delete this router configuration from the cloud?')
      : (t('settings.unshareConfirmDesc') || 'Are you sure you want to remove yourself from this shared router? The primary owner will retain access.');

    showConfirm(
      title,
      desc,
      async () => {
        try {
          setIsDeleting(true);
          const res = await deleteRouterProfileAPI(routerId);
          showAlert(
            t('common.success'),
            res?.message || (isPrimaryOwner ? t('dashboard.deleteSuccess') : 'Removed from shared router successfully'),
            'success'
          );
          navigate('/', { replace: true });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          showAlert(
            t('dashboard.deleteFailed'),
            t('dashboard.deleteFailedMsg').replace('{error}', errMsg),
            'error'
          );
        } finally {
          setIsDeleting(false);
        }
      }
    );
  };

  // ── Form Styles ──
  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid var(--glass-border)',
  };

  const iconCircleStyle = (bgColor: string, color: string): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: bgColor,
    color: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '38px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1.5px solid var(--glass-border)',
    background: 'var(--input-bg)',
    color: 'var(--foreground)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  };

  const primaryBtnStyle = (isLoadingState: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '7px 14px',
    borderRadius: '8px',
    border: 'none',
    background: isLoadingState ? 'var(--text-muted)' : 'var(--primary)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: isLoadingState ? 'not-allowed' : 'pointer',
    opacity: isLoadingState ? 0.7 : 1,
    transition: 'all 0.2s ease',
  });

  const isOnline = status?.online || status?.status === 'online';

  return (
    <div className="responsive-container" style={{ maxWidth: '960px' }}>
      {/* ─── Page Header ─── */}
      <div className="responsive-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.4) 100%)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(99,102,241,0.3)',
            flexShrink: 0
          }}>
            <SettingsIcon size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('settings.title')}
            </h2>
          </div>
        </div>

        <button
          onClick={() => mutateStatus()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '10px',
            border: '1px solid var(--glass-border)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={14} className={isStatusLoading ? 'spin' : ''} />
          <span>{t('dashboard.refreshGateways') || 'Refresh'}</span>
        </button>
      </div>

      {/* ── System Telemetry & Connection Status Banner ── */}
      {/* ── System Telemetry & Connection Status Banner ── */}
      <div style={{
        ...cardStyle,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--card-bg)'
      }}>
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: isOnline ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
              color: isOnline ? '#16a34a' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isOnline ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
              flexShrink: 0
            }}>
              <Router size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.3px' }}>
                {infoForm.name || routerId}
              </div>
              {routerId && !routerId.startsWith('cloud_') && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600, marginTop: '1px' }}>
                  ID: {routerId}
                </div>
              )}
            </div>
          </div>

          <span
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
              background: isOnline ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
              color: isOnline ? '#22c55e' : '#ef4444',
              border: `1px solid ${isOnline ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#ef4444',
              boxShadow: isOnline ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
            }} />
            {isOnline ? t('common.online') : t('common.offline')}
          </span>
        </div>

        {/* Telemetry Micro-Cards Grid */}
        {status && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            {/* Uptime */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('header.uptime')}</div>
                <div style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatUptimeAPI(status.uptime || status.uptime_display) || 'N/A'}
                </div>
              </div>
            </div>

            {/* CPU Load */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Cpu size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('header.cpu')}</div>
                <div style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 700 }}>
                  {status.cpuLoad_display || (status.cpuLoad != null ? `${status.cpuLoad}%` : 'N/A')}
                </div>
              </div>
            </div>

            {/* RAM */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <HardDrive size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('header.ram')}</div>
                <div style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 700 }}>
                  {status.totalMemory != null && status.freeMemory != null
                    ? `${Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024))}MB`
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Temp */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity size={14} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('header.temp')}</div>
                <div style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 700 }}>
                  {status.temperature_display || (status.temperature != null ? `${status.temperature}°C` : 'N/A')}
                </div>
              </div>
            </div>

            {/* SSID */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)',
              gridColumn: 'span 2'
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wifi size={14} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('header.ssid')}</div>
                <div style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {status.wifiName || wifiSsid || 'N/A'}
                </div>
              </div>
            </div>

            {/* Router Time - Full Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              gridColumn: '1 / -1'
            }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={14} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t('dashboard.routerTime')}</div>
                <div style={{ color: 'var(--foreground)', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {status.routerTime || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Grid Container for Settings Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── 1. Router Info & Admin Credentials Card ── */}
        <form onSubmit={handleSaveRouterInfo} style={{
          ...cardStyle,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(59, 130, 246, 0.15)', '#3b82f6')}>
              <Router size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.routerInfoTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.routerInfoSubtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Device Name & Hardware Model */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}>
              <div>
                <label htmlFor="info-name" style={labelStyle}>
                  <Router size={11} style={{ color: '#3b82f6' }} /> {t('dashboard.deviceLabelProfileName')}
                </label>
                <input
                  id="info-name"
                  type="text"
                  value={infoForm.name}
                  onChange={(e) => setInfoForm((prev) => ({ ...prev, name: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label htmlFor="info-model" style={labelStyle}>
                  <Cpu size={11} style={{ color: '#3b82f6' }} /> {t('dashboard.hardwareModel')}
                </label>
                <select
                  id="info-model"
                  value={infoForm.model}
                  onChange={(e) => setInfoForm((prev) => ({ ...prev, model: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {HARDWARE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timezone Configuration */}
            <div>
              <label htmlFor="info-timezone" style={labelStyle}>
                <MapPin size={11} style={{ color: '#3b82f6' }} /> {t('dashboard.timezone')}
              </label>
              <select
                id="info-timezone"
                value={infoForm.timezone}
                onChange={(e) => setInfoForm((prev) => ({ ...prev, timezone: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Authorized Owners Management */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  <Users size={11} style={{ color: '#3b82f6' }} /> {t('dashboard.authorizedOwners')}
                </label>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {safeOwners.length} {safeOwners.length === 1 ? 'Owner' : 'Owners'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isPrimaryOwner ? (
                  <>
                    {safeOwners.map((ownerEmail, index) => (
                      <div key={`owner-setting-${index}`} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div style={{
                          position: 'relative',
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <User size={13} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                          <input
                            type="email"
                            value={ownerEmail}
                            onChange={(e) => handleOwnerChange(index, e.target.value)}
                            placeholder={t('dashboard.placeholderOwners') || 'e.g. owner@example.com'}
                            style={{ ...inputStyle, paddingLeft: '30px' }}
                            required={index === 0}
                          />
                        </div>
                        {safeOwners.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOwner(index)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              flexShrink: 0
                            }}
                            title={t('common.delete') || 'Remove'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddOwner}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        color: '#3b82f6',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginTop: '2px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Plus size={13} />
                      <span>{t('dashboard.addOwner') || 'Add Owner Email'}</span>
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--glass-border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px'
                    }}>
                      {safeOwners.map((ownerEmail, index) => (
                        <span key={`readonly-owner-${index}`} style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: ownerEmail.toLowerCase().trim() === primaryOwner ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          color: ownerEmail.toLowerCase().trim() === primaryOwner ? '#3b82f6' : 'var(--foreground)',
                          border: '1px solid var(--glass-border)',
                        }}>
                          {ownerEmail} {ownerEmail.toLowerCase().trim() === primaryOwner ? '(Primary Owner)' : ''}
                        </span>
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      ℹ️ {t('settings.onlyPrimaryCanEditOwners') || 'Only the primary router owner can modify authorized owners.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={isSavingInfo}
              style={{
                ...primaryBtnStyle(isSavingInfo),
                background: isSavingInfo ? 'var(--text-muted)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: isSavingInfo ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.25)',
              }}
            >
              <Save size={13} />
              <span>{isSavingInfo ? t('settings.saving') : t('settings.saveRouterInfoBtn')}</span>
            </button>
          </div>
        </form>

        {/* ── 2. Wi-Fi SSID Management Card ── */}
        <form onSubmit={handleProvisionWifi} style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(16, 185, 129, 0.15)', '#10b981')}>
              <Wifi size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.wifiSsidTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.wifiSsidSubtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="wifi-ssid-input" style={labelStyle}>
                <Wifi size={11} /> {t('dashboard.ssidWifiName')}
              </label>
              <input
                id="wifi-ssid-input"
                type="text"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder={t('dashboard.placeholderSsid')}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={isProvisioningWifi} style={primaryBtnStyle(isProvisioningWifi)}>
              <RefreshCw size={13} className={isProvisioningWifi ? 'spin' : ''} />
              <span>{isProvisioningWifi ? t('settings.provisioning') : t('settings.resetWifiBtn')}</span>
            </button>
          </div>
        </form>

        {/* ── 2b. Unique Branding & Print Labels Card ── */}
        <form onSubmit={handleSaveBranding} style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(236, 72, 153, 0.15)', '#ec4899')}>
              <Tag size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.brandingTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.brandingSubtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 1. Hotspot Portal Wi-Fi Name Input */}
            <div>
              <label htmlFor="hotspot-portal-name" style={labelStyle}>
                <Wifi size={11} style={{ color: '#ec4899' }} /> {t('settings.hotspotWifiNameLabel')}
              </label>
              <input
                id="hotspot-portal-name"
                type="text"
                value={hotspotWifiName}
                onChange={(e) => setHotspotWifiName(e.target.value)}
                placeholder={t('settings.hotspotWifiNamePlaceholder')}
                style={inputStyle}
              />
            </div>

            {/* 2. Voucher Card Print Label Input */}
            <div>
              <label htmlFor="voucher-card-print-label" style={labelStyle}>
                <Tag size={11} style={{ color: '#ec4899' }} /> {t('settings.cardPrintLabelLabel')}
              </label>
              <input
                id="voucher-card-print-label"
                type="text"
                value={cardPrintLabel}
                onChange={(e) => setCardPrintLabel(e.target.value)}
                placeholder={t('settings.cardPrintLabelPlaceholder')}
                style={inputStyle}
              />
            </div>

            {/* ── Live Hotspot Captive Portal Sign-in Preview ── */}
            <div style={{
              marginTop: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              color: '#0f172a',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                  <Smartphone size={13} />
                  <span>{t('settings.livePortalPreview')}</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#22c55e', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                  Live
                </span>
              </div>

              {/* Phone Frame Rendering hotspot/login.html */}
              <div style={{
                maxWidth: '280px',
                margin: '0 auto',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '24px 20px 20px',
                textAlign: 'center',
                boxShadow: '0 15px 35px -10px rgba(15, 23, 42, 0.1)',
                direction: isRtl ? 'rtl' : 'ltr',
                fontFamily: "'Tajawal', system-ui, sans-serif",
              }}>
                {/* WiFi Brand Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}>
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </div>
                </div>

                {/* Live Wifi Brand Title */}
                <h1 style={{
                  margin: '0 0 4px 0',
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#0f172a',
                  wordBreak: 'break-word',
                }}>
                  {(useCustomHotspotName && hotspotWifiName.trim())
                    ? hotspotWifiName.trim()
                    : (wifiSsid.trim() || status?.wifiName || (isRtl ? 'شبكة الواي فاي' : 'Wi-Fi Network'))}
                </h1>

                <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  {t('settings.enterVoucherCode')}
                </p>

                {/* Form Simulation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    width: '100%',
                    height: '42px',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 500,
                    direction: isRtl ? 'rtl' : 'ltr',
                  }}>
                    {t('settings.enterVoucherCode')}
                  </div>

                  <div style={{
                    width: '100%',
                    height: '42px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  }}>
                    {t('settings.connectToNetwork')}
                  </div>

                  <div style={{
                    background: '#f0f9ff',
                    border: '1px solid #e0f2fe',
                    color: '#0369a1',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: 500,
                    padding: '8px 10px',
                    marginTop: '2px',
                    textAlign: 'center',
                  }}>
                    {t('settings.keepVoucherNotice')}
                  </div>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed #f1f5f9', fontSize: '10px', color: '#94a3b8' }}>
                  <span>{t('settings.devCredits')}</span>
                </div>
              </div>
            </div>

            {/* ── Live Voucher Print Ticket Card Preview ── */}
            <div style={{
              marginTop: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              color: '#0f172a',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#ec4899' }}>
                  <Tag size={13} />
                  <span>{t('settings.liveTicketPreview')}</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#22c55e', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                  Live Card
                </span>
              </div>

              {/* Exact System Printable Voucher Ticket Card Template (matches BatchDetail.tsx PDF generator) */}
              <div style={{
                width: '240px',
                height: '92px',
                margin: '0 auto',
                background: '#ffffff',
                border: '1.5px solid #333333',
                borderRadius: '6px',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                color: '#000000',
                boxSizing: 'border-box',
                direction: isRtl ? 'rtl' : 'ltr',
              }}>
                {/* Header: Wifi Icon + Printed Wifi Name / Print Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', maxWidth: '100%', overflow: 'hidden' }}>
                  <Wifi size={13} style={{ color: '#000000', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#000000', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cardPrintLabel.trim() ? cardPrintLabel.trim() : ((useCustomHotspotName && hotspotWifiName.trim()) ? hotspotWifiName.trim() : (wifiSsid.trim() || status?.wifiName || (isRtl ? 'شبكة الواي فاي' : 'Wi-Fi Network')))}
                  </span>
                </div>

                {/* Center: Voucher PIN Code */}
                <div style={{
                  fontFamily: "'Courier New', monospace, sans-serif",
                  fontSize: '19px',
                  fontWeight: 900,
                  color: '#000000',
                  letterSpacing: '2px',
                  lineHeight: 1,
                  margin: '4px 0',
                }}>
                  84920481
                </div>

                {/* Bottom: Profile Name */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#444444',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  marginBottom: '2px',
                }}>
                  {t('settings.profileNameLabel')}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              type="submit"
              disabled={isSavingBranding}
              style={{
                ...primaryBtnStyle(isSavingBranding),
                background: isSavingBranding ? 'var(--text-muted)' : 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
                boxShadow: isSavingBranding ? 'none' : '0 4px 12px rgba(236, 72, 153, 0.25)',
              }}
            >
              <Save size={13} />
              <span>{isSavingBranding ? t('settings.saving') : t('common.save')}</span>
            </button>
          </div>
        </form>

        {/* ── 3. Hotspot Server Setup Card ("Separate Hotspot Server") ── */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(139, 92, 246, 0.15)', '#8b5cf6')}>
              <Server size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.hotspotServerTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.hotspotServerSubtitle')}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Re-provision and separate the Hotspot server setup on your MikroTik device. This creates/updates the dedicated Hotspot server instance, IP pool, and firewall rules automatically.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleProvisionHotspotServer}
              disabled={isProvisioningServer}
              style={{
                ...primaryBtnStyle(isProvisioningServer),
                background: isProvisioningServer ? 'var(--text-muted)' : '#8b5cf6',
              }}
            >
              <Server size={13} />
              <span>{isProvisioningServer ? t('settings.provisioning') : t('settings.provisionHotspotServerBtn')}</span>
            </button>
          </div>
        </div>

        {/* ── 4. Hotspot Login Portal Files Card ("Send Hotspot Files") ── */}
        <form onSubmit={handleProvisionHotspotFiles} style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(245, 158, 11, 0.15)', '#f59e0b')}>
              <UploadCloud size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.hotspotFilesTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.hotspotFilesSubtitle')}
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--background-secondary, rgba(255,255,255,0.03))',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <Wifi size={14} />
              <span>{t('settings.targetHotspotBrand') || 'Portal Brand Name'}:</span>
            </div>
            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
              {(useCustomHotspotName && hotspotWifiName.trim()) ? hotspotWifiName.trim() : (wifiSsid.trim() || status?.wifiName || 'MikroTik Wi-Fi')}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isProvisioningFiles}
              style={{
                ...primaryBtnStyle(isProvisioningFiles),
                background: isProvisioningFiles ? 'var(--text-muted)' : '#f59e0b',
              }}
            >
              <UploadCloud size={13} />
              <span>{isProvisioningFiles ? t('settings.sending') : t('settings.sendHotspotFilesBtn')}</span>
            </button>
          </div>
        </form>

        {/* ── 5. Provisioning Terminal Script Card ── */}
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(59, 130, 246, 0.15)', '#3b82f6')}>
              <Terminal size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.provisionScriptTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.provisionScriptSubtitle')}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            {t('settings.provisionScriptDesc')}
          </p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleGenerateProvisionScript}
              disabled={isGeneratingScript}
              style={{
                ...primaryBtnStyle(isGeneratingScript),
                background: isGeneratingScript ? 'var(--text-muted)' : '#3b82f6',
              }}
            >
              <RefreshCw size={13} className={isGeneratingScript ? 'spin' : ''} />
              <span>{isGeneratingScript ? t('settings.generatingScript') : t('settings.generateScriptBtn')}</span>
            </button>
          </div>

          {generatedScript && (
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('settings.terminalScript')}
                </span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: copiedScript ? '#10b981' : 'var(--primary)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copiedScript ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedScript ? t('settings.copied') : t('settings.copyScript')}</span>
                </button>
              </div>

              <textarea
                readOnly
                value={generatedScript}
                rows={10}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--surface-dark, #0f172a)',
                  color: '#38bdf8',
                  border: '1px solid var(--border-color)',
                  resize: 'vertical',
                  whiteSpace: 'pre',
                }}
              />
            </div>
          )}
        </div>

        {/* ── 6. Danger Zone / Unshare Card ── */}
        <div style={{ ...cardStyle, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(239, 68, 68, 0.15)', '#ef4444')}>
              <ShieldAlert size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>
                {isPrimaryOwner ? t('settings.dangerZoneTitle') : (t('settings.unshareTitle') || 'Remove Router from My Account')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {isPrimaryOwner ? t('settings.dangerZoneSubtitle') : (t('settings.unshareSubtitle') || 'Disassociate this shared router from your account. The primary owner will retain access.')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {isPrimaryOwner
                ? 'Deleting this router configuration will disassociate it from your cloud account.'
                : 'Removing this router will disassociate it from your account only without deleting it for the primary owner.'}
            </p>

            <button
              onClick={handleDeleteRouter}
              disabled={isDeleting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: '600',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <Trash2 size={13} />
              <span>
                {isDeleting
                  ? t('settings.deleting')
                  : (isPrimaryOwner ? t('settings.deleteRouterBtn') : (t('settings.unshareBtn') || 'Remove from My Account'))}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}