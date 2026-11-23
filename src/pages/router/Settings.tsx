import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
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
  fetchRouterInterfacesAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { useVpnModal } from '../../context/VpnModalContext';
import { RouterHardwareCard } from '../../components/settings/RouterHardwareCard';
import { TerminalScriptModal } from '../../components/settings/TerminalScriptModal';
import { TIMEZONES } from '../../constants/timezones';
import {
  Settings as SettingsIcon,
  RefreshCw,
  Router,
  Wifi,
  Tag,
  Server,
  UploadCloud,
  Terminal,
  ShieldAlert,
  Save,
  Plus,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import './Settings.css';

const HARDWARE_MODELS = [
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

export default function SettingsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { showAlert, showConfirm } = useModal();
  const { user } = useAuth();
  const { openVpnModal } = useVpnModal();
  const currentUserEmail = user?.email ? user.email.toLowerCase().trim() : '';

  const [primaryOwner, setPrimaryOwner] = useState<string>('');

  // Loading states
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isProvisioningWifi, setIsProvisioningWifi] = useState(false);
  const [isProvisioningServer, setIsProvisioningServer] = useState(false);
  const [isProvisioningFiles, setIsProvisioningFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);

  // Forms
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

  const [wifiSsid, setWifiSsid] = useState('');
  const [hotspotWifiName, setHotspotWifiName] = useState('');
  const [cardPrintLabel, setCardPrintLabel] = useState('');


  // SWR queries
  const {
    data: status,
    isLoading: isStatusLoading,
    mutate: mutateStatus,
  } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const { data: profilesData, mutate: mutateProfiles } = useSWR(
    'router-profiles-with-user',
    fetchRouterProfilesWithUserAPI,
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );

  // Sync state from profile & status
  useEffect(() => {
    if (profilesData?.profiles && routerId) {
      const current = profilesData.profiles.find(
        (p: any) => String(p.id) === String(routerId) || p.name === routerId
      );
      if (current) {
        if ((current as any).primary_owner) {
          setPrimaryOwner((current as any).primary_owner.toLowerCase().trim());
        } else if (Array.isArray(current.owners) && current.owners.length > 0) {
          setPrimaryOwner(String(current.owners[0]).toLowerCase().trim());
        }

        const ownersList = Array.isArray(current.owners) && current.owners.length > 0
          ? current.owners
          : current.owner
          ? [current.owner]
          : [''];

        setInfoForm({
          name: current.name || routerId,
          model: current.model || 'hap-ax3',
          timezone: current.timezone || status?.timezone || 'Africa/Khartoum',
          owners: ownersList,
        });

        if (current.wifiName) setWifiSsid(current.wifiName);
        if (current.hotspotWifiName) setHotspotWifiName(current.hotspotWifiName);
        if (current.cardPrintLabel) setCardPrintLabel(current.cardPrintLabel);
      }
    }
  }, [profilesData, routerId, status]);

  const safeOwners = Array.isArray(infoForm.owners) ? infoForm.owners : [''];

  const handleOwnerChange = (index: number, val: string) => {
    setInfoForm((prev) => {
      const updated = [...prev.owners];
      updated[index] = val;
      return { ...prev, owners: updated };
    });
  };

  const handleAddOwner = () => {
    setInfoForm((prev) => ({ ...prev, owners: [...prev.owners, ''] }));
  };

  const handleRemoveOwner = (index: number) => {
    setInfoForm((prev) => {
      const updated = prev.owners.filter((_, i) => i !== index);
      return { ...prev, owners: updated.length > 0 ? updated : [''] };
    });
  };

  // 1. Save Router Info
  const handleSaveRouterInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;

    const ownersArray = safeOwners.map((o) => o.trim()).filter((o) => o.length > 0);

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
      mutateProfiles();
    } catch (err: any) {
      showAlert(t('dashboard.saveFailed'), err?.message || 'Failed to save', 'error');
    } finally {
      setIsSavingInfo(false);
    }
  };

  // 2. Save Wi-Fi SSID
  const handleProvisionWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId) return;
    const trimmed = wifiSsid.trim();
    if (!trimmed) {
      showAlert(t('common.error'), t('dashboard.deviceNameWifiSsidRequired'), 'error');
      return;
    }

    try {
      setIsProvisioningWifi(true);
      await provisionWifiSSIDAPI(routerId, trimmed);
      await updateRouterProfileAPI(routerId, { wifiName: trimmed });
      showAlert(t('common.success'), t('settings.wifiSavedSuccess'), 'success');
      mutateStatus();
      mutateProfiles();
    } catch (err: any) {
      showAlert(t('common.error'), err?.message || 'Failed to update Wi-Fi SSID', 'error');
    } finally {
      setIsProvisioningWifi(false);
    }
  };

  // 3. Save Branding
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
      mutateProfiles();
    } catch (err: any) {
      showAlert(t('common.error'), err?.message || 'Failed to save branding', 'error');
    } finally {
      setIsSavingBranding(false);
    }
  };



  // 5. Separate Hotspot Server
  const handleProvisionHotspotServer = async () => {
    if (!routerId) return;

    showConfirm(
      t('settings.confirmProvisionHotspotServerTitle'),
      t('settings.confirmProvisionHotspotServerDesc'),
      async () => {
        try {
          setIsProvisioningServer(true);
          const res = await provisionHotspotServerAPI(routerId);
          showAlert(t('common.success'), res?.message || t('settings.hotspotServerSuccess'), 'success');
          mutateStatus();
        } catch (err: any) {
          showAlert(t('common.error'), err?.message || 'Failed to provision Hotspot Server', 'error');
        } finally {
          setIsProvisioningServer(false);
        }
      }
    );
  };

  // 6. Send Hotspot Files
  const executeProvisionHotspotFiles = async () => {
    if (!routerId) return;
    const targetBrand = hotspotWifiName.trim() || wifiSsid.trim() || status?.wifiName || 'MikroTik Wi-Fi';

    try {
      setIsProvisioningFiles(true);
      const res = await provisionHotspotFilesAPI(routerId, { wifiName: targetBrand });

      if (res?.jobId) {
        let completed = false;
        let attempts = 0;
        while (!completed && attempts < 60) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;
          try {
            const jobStatus = await fetchHotspotUploadJobStatusAPI(routerId, res.jobId);
            if (jobStatus.status === 'completed') {
              completed = true;
              showAlert(t('common.success'), jobStatus.message || t('settings.hotspotFilesSuccess'), 'success');
              mutateStatus();
            } else if (jobStatus.status === 'failed') {
              completed = true;
              showAlert(t('common.error'), jobStatus.error || 'Failed to upload portal files', 'error');
            }
          } catch {}
        }
      } else {
        showAlert(t('common.success'), res?.message || t('settings.hotspotFilesSuccess'), 'success');
        mutateStatus();
      }
    } catch (err: any) {
      showAlert(t('common.error'), err?.message || 'Failed to upload files', 'error');
    } finally {
      setIsProvisioningFiles(false);
    }
  };

  const handleProvisionHotspotFiles = (e: React.FormEvent) => {
    e.preventDefault();
    const targetBrand = hotspotWifiName.trim() || wifiSsid.trim() || status?.wifiName || 'MikroTik Wi-Fi';
    showConfirm(
      t('settings.confirmSendHotspotFilesTitle'),
      t('settings.confirmSendHotspotFilesDesc').replace('{brandName}', targetBrand),
      executeProvisionHotspotFiles
    );
  };

  // 7. Terminal Provisioning Script
  const handleGenerateProvisionScript = async () => {
    if (!routerId) return;
    try {
      setIsGeneratingScript(true);
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
    } catch (err: any) {
      showAlert(t('dashboard.scriptError'), err?.message || 'Script Error', 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const isPrimaryOwner = !primaryOwner || !currentUserEmail || primaryOwner === currentUserEmail;

  // 8. Delete / Unshare Router
  const handleDeleteRouter = () => {
    if (!routerId) return;
    const title = isPrimaryOwner ? t('settings.deleteConfirmTitle') : t('settings.unshareTitle');
    const desc = isPrimaryOwner ? t('settings.deleteConfirmDesc') : t('settings.unshareConfirmDesc');

    showConfirm(title, desc, async () => {
      try {
        setIsDeleting(true);
        const res = await deleteRouterProfileAPI(routerId);
        showAlert(t('common.success'), res?.message || t('dashboard.deleteSuccess'), 'success');
        navigate('/', { replace: true });
      } catch (err: any) {
        showAlert(t('dashboard.deleteFailed'), err?.message || 'Delete failed', 'error');
      } finally {
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className="settings-page-container" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Page Header ─── */}
      <div className="page-header-card">
        <div className="page-header-left-group">
          <div className="page-header-icon">
            <SettingsIcon />
          </div>
          <div className="page-header-titles">
            <h2 className="page-header-title">{t('settings.title')}</h2>
            <p className="page-header-subtitle">{t('settings.subtitle')}</p>
          </div>
        </div>

        <button
          onClick={() => mutateStatus()}
          className="page-header-btn"
        >
          <RefreshCw size={14} className={isStatusLoading ? 'animate-spin' : ''} />
          <span className="hide-sm-only">{t('common.refresh')}</span>
        </button>
      </div>

      {/* ─── Router Hardware & Live Status ─── */}
      <RouterHardwareCard
        routerStatus={status}
        infoForm={infoForm}
        liveSsid={status?.wifiName || wifiSsid}
        onOpenVpnModal={openVpnModal}
      />

      {/* ─── 1. Router Info & Owners ─── */}
      <form onSubmit={handleSaveRouterInfo} className="settings-card">
        <div className="settings-section-header">
          <div className="settings-section-icon blue">
            <Router size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('settings.routerInfoTitle')}</h3>
            <p className="settings-section-subtitle">{t('settings.routerInfoSubtitle')}</p>
          </div>
        </div>

        <div className="settings-form-grid">
          <div className="settings-form-group">
            <label className="settings-form-label">{t('settings.routerNameLabel')}</label>
            <input
              type="text"
              required
              value={infoForm.name}
              onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
              className="settings-input"
            />
          </div>

          <div className="settings-form-group">
            <label className="settings-form-label">{t('settings.hardwareModelLabel')}</label>
            <div className="settings-input-wrapper">
              <select
                value={infoForm.model}
                onChange={(e) => setInfoForm({ ...infoForm, model: e.target.value })}
                className="settings-select"
              >
                {HARDWARE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="profile-select-chevron" />
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-form-label">{t('settings.timezoneLabel')}</label>
            <div className="settings-input-wrapper">
              <select
                value={infoForm.timezone}
                onChange={(e) => setInfoForm({ ...infoForm, timezone: e.target.value })}
                className="settings-select"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <ChevronDown size={14} className="profile-select-chevron" />
            </div>
          </div>
        </div>

        {/* Owners List */}
        <div className="settings-form-group">
          <label className="settings-form-label">{t('settings.authorizedOwnersLabel')}</label>
          <div className="settings-dns-list">
            {safeOwners.map((owner, idx) => (
              <div key={idx} className="settings-dns-row">
                <input
                  type="email"
                  value={owner}
                  onChange={(e) => handleOwnerChange(idx, e.target.value)}
                  placeholder="owner@example.com"
                  className="settings-input"
                />
                {safeOwners.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOwner(idx)}
                    className="settings-btn-danger settings-dns-remove-btn"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <div>
              <button
                type="button"
                onClick={handleAddOwner}
                className="settings-btn-secondary settings-dns-add-btn"
              >
                <Plus size={13} />
                <span>{t('settings.addOwnerBtn')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="settings-footer-actions-border">
          <button
            type="submit"
            disabled={isSavingInfo}
            className="settings-btn-primary"
          >
            <Save size={14} />
            <span>{isSavingInfo ? t('common.saving') : t('common.save')}</span>
          </button>
        </div>
      </form>

      {/* ─── 2. Wi-Fi SSID ─── */}
      <form onSubmit={handleProvisionWifi} className="settings-card">
        <div className="settings-section-header">
          <div className="settings-section-icon green">
            <Wifi size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('settings.wifiSsidTitle')}</h3>
            <p className="settings-section-subtitle">{t('settings.wifiSsidSubtitle')}</p>
          </div>
        </div>

        <div className="settings-form-group">
          <label className="settings-form-label">{t('settings.wifiSsidLabel')}</label>
          <input
            type="text"
            required
            value={wifiSsid}
            onChange={(e) => setWifiSsid(e.target.value)}
            placeholder="e.g. My-Hotspot-WiFi"
            className="settings-input"
          />
        </div>

        <div className="settings-footer-actions-border">
          <button
            type="submit"
            disabled={isProvisioningWifi}
            className="settings-btn-primary"
          >
            <Wifi size={14} />
            <span>{isProvisioningWifi ? t('settings.provisioning') : t('settings.provisionWifiBtn')}</span>
          </button>
        </div>
      </form>

      {/* ─── 3. Hotspot Branding & Card Labels ─── */}
      <form onSubmit={handleSaveBranding} className="settings-card">
        <div className="settings-section-header">
          <div className="settings-section-icon pink">
            <Tag size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('settings.brandingTitle')}</h3>
            <p className="settings-section-subtitle">{t('settings.brandingSubtitle')}</p>
          </div>
        </div>

        <div className="settings-form-grid">
          <div className="settings-form-group">
            <label className="settings-form-label">{t('settings.hotspotWifiNameLabel')}</label>
            <input
              type="text"
              value={hotspotWifiName}
              onChange={(e) => setHotspotWifiName(e.target.value)}
              placeholder="e.g. Starlink Guest"
              className="settings-input"
            />
          </div>

          <div className="settings-form-group">
            <label className="settings-form-label">{t('settings.cardPrintLabel')}</label>
            <input
              type="text"
              value={cardPrintLabel}
              onChange={(e) => setCardPrintLabel(e.target.value)}
              placeholder="e.g. High Speed Wi-Fi"
              className="settings-input"
            />
          </div>
        </div>

        <div className="settings-footer-actions-border">
          <button
            type="submit"
            disabled={isSavingBranding}
            className="settings-btn-primary"
          >
            <Save size={14} />
            <span>{isSavingBranding ? t('common.saving') : t('common.save')}</span>
          </button>
        </div>
      </form>



      {/* ─── 5. Separate Hotspot Server ─── */}
      <div className="settings-card">
        <div className="settings-section-header">
          <div className="settings-section-icon purple">
            <Server size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('settings.hotspotServerTitle')}</h3>
            <p className="settings-section-subtitle">{t('settings.hotspotServerSubtitle')}</p>
          </div>
        </div>

        <div className="settings-footer-actions">
          <button
            type="button"
            onClick={handleProvisionHotspotServer}
            disabled={isProvisioningServer}
            className="settings-btn-primary"
          >
            <Server size={14} />
            <span>{isProvisioningServer ? t('settings.provisioning') : t('settings.provisionHotspotServerBtn')}</span>
          </button>
        </div>
      </div>

      {/* ─── 6. Hotspot Login Portal Files ─── */}
      <form onSubmit={handleProvisionHotspotFiles} className="settings-card">
        <div className="settings-section-header">
          <div className="settings-section-icon amber">
            <UploadCloud size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('settings.hotspotFilesTitle')}</h3>
            <p className="settings-section-subtitle">{t('settings.hotspotFilesSubtitle')}</p>
          </div>
        </div>

        <div className="settings-footer-actions">
          <button
            type="submit"
            disabled={isProvisioningFiles}
            className="settings-btn-primary"
          >
            <UploadCloud size={14} />
            <span>{isProvisioningFiles ? t('settings.sending') : t('settings.sendHotspotFilesBtn')}</span>
          </button>
        </div>
      </form>

      {/* ─── 7. Terminal Provisioning Script ─── */}
      <div className="settings-card">
        <div className="settings-section-header">
          <div className="settings-section-icon blue">
            <Terminal size={16} />
          </div>
          <div>
            <h3 className="settings-section-title">{t('settings.provisionScriptTitle')}</h3>
            <p className="settings-section-subtitle">{t('settings.provisionScriptSubtitle')}</p>
          </div>
        </div>

        <div className="settings-footer-actions">
          <button
            type="button"
            onClick={handleGenerateProvisionScript}
            disabled={isGeneratingScript}
            className="settings-btn-primary"
          >
            <Terminal size={14} />
            <span>{isGeneratingScript ? t('settings.generatingScript') : t('settings.generateScriptBtn')}</span>
          </button>
        </div>
      </div>

      {/* ─── 8. Danger Zone ─── */}
      <div className="settings-card settings-card-danger">
        <div className="settings-section-header">
          <div className="settings-section-icon red">
            <ShieldAlert size={16} />
          </div>
          <div>
            <h3 className="settings-section-title text-danger">
              {isPrimaryOwner ? t('settings.dangerZoneTitle') : t('settings.unshareTitle')}
            </h3>
            <p className="settings-section-subtitle">
              {isPrimaryOwner ? t('settings.dangerZoneSubtitle') : t('settings.unshareSubtitle')}
            </p>
          </div>
        </div>

        <div className="settings-footer-actions">
          <button
            type="button"
            onClick={handleDeleteRouter}
            disabled={isDeleting}
            className="settings-btn-danger"
          >
            <Trash2 size={14} />
            <span>{isDeleting ? t('settings.deleting') : isPrimaryOwner ? t('settings.deleteRouterBtn') : t('settings.unshareBtn')}</span>
          </button>
        </div>
      </div>

      {/* Terminal Script Modal */}
      <TerminalScriptModal
        script={generatedScript}
        onClose={() => setGeneratedScript(null)}
      />
    </div>
  );
}
