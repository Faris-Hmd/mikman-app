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
  deleteRouterProfileAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
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

const TIMEZONES = [
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Caracas', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/New_York',
  'America/Sao_Paulo', 'America/Toronto', 'Asia/Amman', 'Asia/Baghdad', 'Asia/Bahrain',
  'Asia/Beirut', 'Asia/Damascus', 'Asia/Dubai', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Hong_Kong',
  'Asia/Istanbul', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kuwait', 'Asia/Muscat', 'Asia/Qatar',
  'Asia/Riyadh', 'Asia/Singapore', 'Asia/Tokyo', 'Europe/Amsterdam', 'Europe/Berlin',
  'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Europe/Rome', 'UTC',
];

export default function SettingsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showAlert, showConfirm } = useModal();

  // Loading states for actions
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isProvisioningWifi, setIsProvisioningWifi] = useState(false);
  const [isProvisioningServer, setIsProvisioningServer] = useState(false);
  const [isProvisioningFiles, setIsProvisioningFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Router Info Form State
  const [infoForm, setInfoForm] = useState({
    name: '',
    model: 'hap-ax3',
    timezone: 'UTC',
    owners: '',
  });

  // Wi-Fi SSID Form State
  const [wifiSsid, setWifiSsid] = useState('');

  // Hotspot Files Form State
  const [hotspotWifiName, setHotspotWifiName] = useState('');

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
        setInfoForm({
          name: currentConfig.name || routerId,
          model: currentConfig.model || 'hap-ax3',
          timezone: currentConfig.timezone || status?.timezone || 'UTC',
          owners: Array.isArray(currentConfig.owners)
            ? currentConfig.owners.join(', ')
            : currentConfig.owner || '',
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [routerId, status?.timezone]);

  // Populate Wi-Fi SSID and Timezone strictly from router status API (live router settings)
  useEffect(() => {
    if (status?.wifiName) {
      setWifiSsid(status.wifiName);
      setHotspotWifiName(status.wifiName);
    }
    if (status?.timezone) {
      setInfoForm((prev) => ({
        ...prev,
        timezone: status.timezone,
      }));
    }
  }, [status?.wifiName, status?.timezone]);

  // ── Action Handlers ──

  // 1. Save Router Info
  const handleSaveRouterInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    const ownersArray = infoForm.owners
      .split(',')
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
      t('settings.hotspotServerTitle'),
      t('settings.hotspotServerSubtitle') + '?',
      async () => {
        try {
          setIsProvisioningServer(true);
          await provisionHotspotServerAPI(routerId);
          showAlert(t('common.success'), t('settings.hotspotServerSuccess'), 'success');
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
  const handleProvisionHotspotFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    try {
      setIsProvisioningFiles(true);
      await provisionHotspotFilesAPI(routerId, {
        wifiName: hotspotWifiName.trim(),
      });

      showAlert(t('common.success'), t('settings.hotspotFilesSuccess'), 'success');
      mutateStatus();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert(t('common.error'), errMsg, 'error');
    } finally {
      setIsProvisioningFiles(false);
    }
  };

  // 5. Delete Router Profile
  const handleDeleteRouter = () => {
    if (!routerId) return;

    showConfirm(
      t('settings.deleteConfirmTitle'),
      t('settings.deleteConfirmDesc'),
      async () => {
        try {
          setIsDeleting(true);
          await deleteRouterProfileAPI(routerId);
          showAlert(t('dashboard.deleted'), t('dashboard.deleteSuccess'), 'success');
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
    borderRadius: '14px',
    padding: '16px',
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
    gap: '8px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: 'none',
    background: isLoadingState ? 'var(--text-muted)' : 'var(--primary)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: isLoadingState ? 'not-allowed' : 'pointer',
    opacity: isLoadingState ? 0.7 : 1,
    transition: 'all 0.2s ease',
  });

  const isOnline = status?.online || status?.status === 'online';

  return (
    <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Page Header (Single row compact layout) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('settings.title')}
          </h2>
          <p className="hide-sm" style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('settings.subtitle')}
          </p>
        </div>

        <button
          onClick={() => mutateStatus()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={13} className={isStatusLoading ? 'spin' : ''} />
          <span className="hide-sm">{t('dashboard.refreshGateways')}</span>
        </button>
      </div>

      {/* ── System Telemetry & Connection Status Banner ── */}
      <div style={{ ...cardStyle, background: 'var(--card-bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconCircleStyle(isOnline ? '#16a34a20' : '#dc262620', isOnline ? '#16a34a' : '#dc2626')}>
              <Router size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {infoForm.name || routerId}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ID: {routerId}
              </div>
            </div>
          </div>

          <span
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              background: isOnline ? '#16a34a20' : '#dc262620',
              color: isOnline ? '#16a34a' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#16a34a' : '#dc2626' }} />
            {isOnline ? t('common.online') : t('common.offline')}
          </span>
        </div>

        {status && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Clock size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700 }}>{t('header.uptime')}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  {status.uptime_display || status.uptime || 'N/A'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Cpu size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700 }}>{t('header.cpu')}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  {status.cpuLoad_display || (status.cpuLoad != null ? `${status.cpuLoad}%` : 'N/A')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <HardDrive size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700 }}>{t('header.ram')}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  {status.totalMemory != null && status.freeMemory != null
                    ? `${Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024))}MB`
                    : 'N/A'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Activity size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700 }}>{t('header.temp')}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  {status.temperature_display || (status.temperature != null ? `${status.temperature}°C` : 'N/A')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Clock size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700 }}>{t('dashboard.routerTime')}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  {status.routerTime || 'N/A'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Wifi size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700 }}>{t('header.ssid')}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                  {status.wifiName || wifiSsid || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Grid Container for Settings Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── 1. Router Info & Admin Credentials Card ── */}
        <form onSubmit={handleSaveRouterInfo} style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(59, 130, 246, 0.15)', '#3b82f6')}>
              <Router size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {t('settings.routerInfoTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.routerInfoSubtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div>
              <label htmlFor="info-name" style={labelStyle}>
                <Router size={11} /> {t('dashboard.deviceLabelProfileName')}
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
                <Cpu size={11} /> {t('dashboard.hardwareModel')}
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

            <div>
              <label htmlFor="info-timezone" style={labelStyle}>
                <MapPin size={11} /> {t('dashboard.timezone')}
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

            <div>
              <label htmlFor="info-owners" style={labelStyle}>
                <Users size={11} /> {t('dashboard.authorizedOwners')}
              </label>
              <input
                id="info-owners"
                type="text"
                value={infoForm.owners}
                onChange={(e) => setInfoForm((prev) => ({ ...prev, owners: e.target.value }))}
                placeholder="e.g. owner@example.com"
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="submit" disabled={isSavingInfo} style={primaryBtnStyle(isSavingInfo)}>
              <Save size={14} />
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
              <RefreshCw size={14} className={isProvisioningWifi ? 'spin' : ''} />
              <span>{isProvisioningWifi ? t('settings.provisioning') : t('settings.resetWifiBtn')}</span>
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
              <Server size={14} />
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

          <div>
            <label htmlFor="hotspot-wifi-name" style={labelStyle}>
              <Wifi size={11} /> {t('dashboard.ssidWifiName')}
            </label>
            <input
              id="hotspot-wifi-name"
              type="text"
              value={hotspotWifiName}
              onChange={(e) => setHotspotWifiName(e.target.value)}
              placeholder={t('dashboard.placeholderSsid')}
              style={inputStyle}
            />
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
              <UploadCloud size={14} />
              <span>{isProvisioningFiles ? t('settings.sending') : t('settings.sendHotspotFilesBtn')}</span>
            </button>
          </div>
        </form>

        {/* ── 5. Danger Zone Card ── */}
        <div style={{ ...cardStyle, border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
          <div style={sectionHeaderStyle}>
            <div style={iconCircleStyle('rgba(239, 68, 68, 0.15)', '#ef4444')}>
              <ShieldAlert size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>
                {t('settings.dangerZoneTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('settings.dangerZoneSubtitle')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Deleting this router configuration will disassociate it from your cloud account.
            </p>

            <button
              onClick={handleDeleteRouter}
              disabled={isDeleting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: '700',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <Trash2 size={14} />
              <span>{isDeleting ? t('settings.deleting') : t('settings.deleteRouterBtn')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}