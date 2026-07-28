import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchProfilesAPI, createProfileAPI, renameProfileAPI, deleteProfileAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Layers,
  Clock,
  HardDrive,
  Plus,
  Loader2,
  Tag,
  Shield,
  Trash2,
  Pencil,
  X,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface Profile {
  '.id': string;
  id?: string;
  name: string;
  validity?: string;
  limitMB?: number;
  isUnlimited?: boolean;
  printLabel?: string;
  revenue?: number | string;
  price?: number | string;
}

const parseValidity = (str?: string) => {
  if (!str) {
    return { num: 1, unit: 'd', isUnl: false };
  }
  const s = str.trim().toLowerCase();
  if (s === '0d' || s === '0h' || s === '0m' || s === '0' || s === 'unlimited' || s === 'none') {
    return { num: 0, unit: '', isUnl: true };
  }
  const match = s.match(/^(\d+)\s*([a-zA-Z]+)?$/);
  if (match) {
    const num = parseInt(match[1], 10) || 1;
    if (num === 0) {
      return { num: 0, unit: '', isUnl: true };
    }
    const u = (match[2] || 'd').toLowerCase();
    const unit = ['m', 'h', 'd', 'w'].includes(u) ? u : 'd';
    return { num, unit, isUnl: false };
  }
  return { num: 1, unit: 'd', isUnl: false };
};

export default function ProfilesPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [validityNum, setValidityNum] = useState<number>(1);
  const [validityUnit, setValidityUnit] = useState<string>('d');
  const [isUnlimitedTime, setIsUnlimitedTime] = useState(false);

  const [limitMB, setLimitMB] = useState<number | undefined>(undefined);
  const [isUnlimited, setIsUnlimited] = useState(true);
  const [printLabel, setPrintLabel] = useState('');
  const [revenue, setRevenue] = useState<string | number>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [warningModalData, setWarningModalData] = useState<{ profileName: string; userCount: number; message?: string } | null>(null);

  const { data: profiles, isLoading, mutate } = useSWR(
    routerId ? `router-profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const profileList: Profile[] = useMemo(() => {
    if (!Array.isArray(profiles)) return [];
    return profiles.filter((p) => p.name && p.name.toLowerCase() !== 'default');
  }, [profiles]);

  // Telemetry counts
  const totalProfiles = profileList.length;
  const unlimitedCount = profileList.filter((p) => p.isUnlimited || !p.limitMB).length;
  const limitedCount = totalProfiles - unlimitedCount;

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingProfile(null);
    setName('');
    setValidityNum(1);
    setValidityUnit('d');
    setIsUnlimitedTime(false);
    setLimitMB(undefined);
    setIsUnlimited(true);
    setPrintLabel('');
    setRevenue('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (p: Profile) => {
    setEditingProfile(p);
    setName(p.name || '');
    const { num, unit, isUnl } = parseValidity(p.validity);
    setIsUnlimitedTime(isUnl);
    setValidityNum(isUnl ? 1 : num);
    setValidityUnit(isUnl ? 'd' : unit);
    setLimitMB(p.limitMB);
    setIsUnlimited(p.isUnlimited ?? !p.limitMB);
    setPrintLabel(p.printLabel || '');
    const initialRev = p.revenue != null ? p.revenue : p.price != null ? p.price : '';
    setRevenue(initialRev !== '' ? String(initialRev) : '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Handle Form Submit (Create or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formattedValidity = isUnlimitedTime ? '0d' : `${validityNum || 1}${validityUnit || 'd'}`;
    const apiIsUnlimited = isUnlimitedTime && isUnlimited;

    try {
      if (editingProfile) {
        // Edit Mode
        await renameProfileAPI(
          routerId!,
          editingProfile['.id'],
          name.trim(),
          printLabel.trim() || undefined,
          revenue ? Number(revenue) : undefined,
          formattedValidity,
          isUnlimited ? undefined : Number(limitMB) || undefined,
          apiIsUnlimited
        );
        setSuccessMsg(t('profiles.profileUpdated'));
      } else {
        // Create Mode
        await createProfileAPI(
          routerId!,
          name.trim(),
          formattedValidity,
          isUnlimited ? undefined : Number(limitMB) || undefined,
          apiIsUnlimited,
          printLabel.trim() || undefined,
          revenue ? Number(revenue) : undefined
        );
        setSuccessMsg(t('profiles.profileCreated'));
      }

      setIsModalOpen(false);
      mutate();
    } catch (err: any) {
      setErrorMsg(err?.message || (editingProfile ? t('profiles.couldNotUpdate') : t('profiles.couldNotCreate')));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Profile
  const handleDeleteProfile = async (p: Profile) => {
    const confirmMsg = t('profiles.deleteConfirm').replace('{name}', p.name);
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(p['.id']);
    try {
      await deleteProfileAPI(routerId!, p['.id']);
      mutate();
    } catch (err: any) {
      if (err?.code === 'PROFILE_IN_USE' || err?.userCount || err?.message?.includes('assigned to') || err?.message?.includes('PROFILE_IN_USE')) {
        setWarningModalData({
          profileName: err.profileName || p.name,
          userCount: err.userCount || 1,
          message: err.message
        });
      } else {
        alert(err?.message || 'Error deleting profile');
      }
    } finally {
      setDeletingId(null);
    }
  };

  // Theme compatible styles
  const cardGlassStyle: React.CSSProperties = {
    background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '10px',
    padding: '10px 12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'var(--foreground)',
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px',
  };

  const modalContainerStyle: React.CSSProperties = {
    background: 'var(--card-bg, #1e293b)',
    color: 'var(--foreground)',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    maxWidth: '420px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    boxSizing: 'border-box',
    direction: isRtl ? 'rtl' : 'ltr',
  };

  const inputContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg, rgba(0, 0, 0, 0.2))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
    borderRadius: '8px',
    height: '32px',
    padding: isRtl ? '0 32px 0 10px' : '0 10px 0 32px',
    color: 'var(--foreground)',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--input-bg, rgba(0, 0, 0, 0.2))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
    borderRadius: '8px',
    height: '32px',
    padding: '0 10px',
    color: 'var(--foreground)',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  };

  const embeddedIconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [isRtl ? 'right' : 'left']: '10px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  };

  const validityPresets = [
    { label: t('profiles.unlimitedTime') || 'Unlimited Time', num: 0, unit: '', isUnl: true },
    { label: `1 ${t('profiles.unitHours') || 'Hour'}`, num: 1, unit: 'h', isUnl: false },
    { label: `12 ${t('profiles.unitHours') || 'Hours'}`, num: 12, unit: 'h', isUnl: false },
    { label: `1 ${t('profiles.unitDays') || 'Day'}`, num: 1, unit: 'd', isUnl: false },
    { label: `7 ${t('profiles.unitDays') || 'Days'}`, num: 7, unit: 'd', isUnl: false },
    { label: `30 ${t('profiles.unitDays') || 'Days'}`, num: 30, unit: 'd', isUnl: false },
  ];

  const dataPresets = [
    { label: t('profiles.unlimited'), mb: undefined, isUnl: true },
    { label: '500 MB', mb: 500, isUnl: false },
    { label: '1 GB', mb: 1024, isUnl: false },
    { label: '2 GB', mb: 2048, isUnl: false },
  ];

  return (
    <div
      className="responsive-container"
      style={{
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
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
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.4) 100%)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
            flexShrink: 0
          }}>
            <Layers size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('profiles.title')}
            </h2>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          style={{
            background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={13} />
          <span>{t('profiles.addProfileBtn')}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#4ade80',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Telemetry Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div style={{ ...cardGlassStyle, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              flexShrink: 0,
            }}
          >
            <Layers size={14} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1 }}>
              {t('profiles.totalProfiles')}
            </span>
            <strong className="stat-value" style={{ color: 'var(--foreground)' }}>
              {totalProfiles}
            </strong>
          </div>
        </div>

        <div style={{ ...cardGlassStyle, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e',
              flexShrink: 0,
            }}
          >
            <Zap size={14} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1 }}>
              {t('profiles.unlimited')}
            </span>
            <strong className="stat-value" style={{ color: '#22c55e' }}>
              {unlimitedCount}
            </strong>
          </div>
        </div>

        <div style={{ ...cardGlassStyle, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a855f7',
              flexShrink: 0,
            }}
          >
            <HardDrive size={14} />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', lineHeight: 1 }}>
              {t('profiles.trafficLimit')}
            </span>
            <strong className="stat-value" style={{ color: '#a855f7' }}>
              {limitedCount}
            </strong>
          </div>
        </div>
      </div>

      {/* Profiles Cards Grid */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px',
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...cardGlassStyle,
                display: 'flex',
                flexDirection: 'column',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <div className="skeleton" style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0 }} />
                  <div className="skeleton" style={{ width: '50%', height: '14px' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                  <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--glass-border, rgba(255, 255, 255, 0.08))', margin: '12px 0' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="skeleton" style={{ width: '35%', height: '12px' }} />
                <div className="skeleton" style={{ width: '35%', height: '12px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : profileList.length === 0 ? (
        <div style={{ ...cardGlassStyle, padding: '24px', textAlign: 'center' }}>
          <Shield size={24} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '6px' }} />
          <h4 style={{ margin: '0 0 2px', color: 'var(--foreground)', fontSize: '14px' }}>{t('profiles.noProfilesFound')}</h4>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '11px' }}>{t('profiles.noProfilesDesc')}</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px',
          }}
        >
          {profileList.map((profile) => {
            const isUnlVal = profile.validity === '0d' || profile.validity === '0' || profile.validity === '0h' || profile.validity?.toLowerCase() === 'unlimited';
            const displayValidity = isUnlVal ? t('profiles.unlimitedTime') : (profile.validity || '1d');

            return (
              <div
                key={profile['.id'] || profile.name}
                style={{
                  ...cardGlassStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '14px 16px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Header Row: Icon, Title, Revenue Tag & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3b82f6',
                        flexShrink: 0,
                      }}
                    >
                      <Layers size={17} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <strong style={{ fontSize: '14px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {profile.name}
                        </strong>
                        {(() => {
                          const revVal = profile.revenue ?? profile.price;
                          const numRev = revVal != null && revVal !== '' ? Number(revVal) : NaN;
                          if (!isNaN(numRev) && numRev > 0) {
                            return (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: '1.5px 6px', borderRadius: '5px', flexShrink: 0 }}>
                                ${numRev.toFixed(2)}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleOpenEditModal(profile)}
                      title="Edit Profile"
                      style={{
                        background: 'rgba(255, 255, 255, 0.07)',
                        border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
                        borderRadius: '7px',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--foreground)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      onClick={() => handleDeleteProfile(profile)}
                      disabled={deletingId === profile['.id']}
                      title="Delete Profile"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '7px',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {deletingId === profile['.id'] ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Divider between Card Header & Detail Items */}
                <div style={{ height: '1px', background: 'var(--glass-border, rgba(255, 255, 255, 0.08))', margin: '10px 0' }} />

                {/* Detail Items Row */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(56, 189, 248, 0.08)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <Clock size={12} style={{ color: '#38bdf8' }} />
                    <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{displayValidity}</span>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(168, 85, 247, 0.08)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                    <HardDrive size={12} style={{ color: '#a855f7' }} />
                    <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
                      {profile.isUnlimited || !profile.limitMB ? t('profiles.unlimited') : `${profile.limitMB} MB`}
                    </span>
                  </div>

                  {profile.printLabel && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(234, 179, 8, 0.08)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.15)' }}>
                      <Tag size={12} style={{ color: '#eab308' }} />
                      <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{profile.printLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Profile Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContainerStyle}>
            {/* Modal Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} style={{ color: 'var(--primary, #3b82f6)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>
                  {editingProfile ? t('profiles.editProfileTitle') : t('profiles.createProfileTitle')}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#f87171',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Profile Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('profiles.nameLabel')} *
                </label>
                <div style={inputContainerStyle}>
                  <Layers size={13} style={embeddedIconStyle} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('profiles.namePlaceholder')}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Simplified Validity Picker with Unlimited Option */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('profiles.validityLabel')} *
                </label>
                {/* Presets */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {validityPresets.map((vp) => {
                    const isSelected = vp.isUnl ? isUnlimitedTime : !isUnlimitedTime && validityNum === vp.num && validityUnit === vp.unit;
                    return (
                      <button
                        key={vp.label}
                        type="button"
                        onClick={() => {
                          if (vp.isUnl) {
                            setIsUnlimitedTime(true);
                          } else {
                            setIsUnlimitedTime(false);
                            setValidityNum(vp.num);
                            setValidityUnit(vp.unit);
                          }
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary, #3b82f6)' : 'var(--input-bg, rgba(0, 0, 0, 0.15))',
                          color: isSelected ? '#ffffff' : 'var(--foreground)',
                          border: '1px solid ' + (isSelected ? 'var(--primary, #3b82f6)' : 'var(--glass-border, rgba(255, 255, 255, 0.1))'),
                        }}
                      >
                        {vp.label}
                      </button>
                    );
                  })}
                </div>

                {/* Direct Numeric Input + Unit Select Dropdown (disabled if unlimited) */}
                {!isUnlimitedTime && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ ...inputContainerStyle, flex: 1 }}>
                      <Clock size={13} style={embeddedIconStyle} />
                      <input
                        type="number"
                        min="1"
                        required={!isUnlimitedTime}
                        value={validityNum || ''}
                        onChange={(e) => setValidityNum(e.target.value ? Number(e.target.value) : 1)}
                        style={inputStyle}
                      />
                    </div>
                    <select
                      value={validityUnit}
                      onChange={(e) => setValidityUnit(e.target.value)}
                      style={{ ...selectStyle, minWidth: '90px' }}
                    >
                      <option value="m">{t('profiles.unitMinutes') || 'Minutes'}</option>
                      <option value="h">{t('profiles.unitHours') || 'Hours'}</option>
                      <option value="d">{t('profiles.unitDays') || 'Days'}</option>
                      <option value="w">{t('profiles.unitWeeks') || 'Weeks'}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Data Limit */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('profiles.trafficLimit')}
                </label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {dataPresets.map((dp) => {
                    const isSelected = dp.isUnl ? isUnlimited : !isUnlimited && limitMB === dp.mb;
                    return (
                      <button
                        key={dp.label}
                        type="button"
                        onClick={() => {
                          setIsUnlimited(dp.isUnl);
                          setLimitMB(dp.mb);
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary, #3b82f6)' : 'var(--input-bg, rgba(0, 0, 0, 0.15))',
                          color: isSelected ? '#ffffff' : 'var(--foreground)',
                          border: '1px solid ' + (isSelected ? 'var(--primary, #3b82f6)' : 'var(--glass-border, rgba(255, 255, 255, 0.1))'),
                        }}
                      >
                        {dp.label}
                      </button>
                    );
                  })}
                </div>

                {!isUnlimited && (
                  <div style={inputContainerStyle}>
                    <HardDrive size={13} style={embeddedIconStyle} />
                    <input
                      type="number"
                      min="1"
                      value={limitMB || ''}
                      onChange={(e) => setLimitMB(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder={t('profiles.limitMBPlaceholder')}
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {/* Print Label & Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--foreground)' }}>
                    {t('profiles.printLabelInput')}
                  </label>
                  <div style={inputContainerStyle}>
                    <Tag size={12} style={embeddedIconStyle} />
                    <input
                      type="text"
                      value={printLabel}
                      onChange={(e) => setPrintLabel(e.target.value)}
                      placeholder="e.g. Fast WiFi 1D"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--foreground)' }}>
                    {t('profiles.priceLabel')}
                  </label>
                  <div style={inputContainerStyle}>
                    <DollarSign size={12} style={embeddedIconStyle} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      placeholder="e.g. 5.00"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'var(--input-bg, rgba(0, 0, 0, 0.15))',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: 'var(--foreground)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {t('profiles.cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>{t('profiles.saving')}</span>
                    </>
                  ) : (
                    <span>{editingProfile ? t('profiles.updateBtn') : t('profiles.saveBtn')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile In Use Warning Modal */}
      {warningModalData && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '420px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <AlertCircle size={20} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>
                  {t('profiles.profileInUseTitle')}
                </h3>
              </div>
              <button
                onClick={() => setWarningModalData(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px 14px', color: 'var(--foreground)', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
              {t('profiles.profileInUseDesc')
                .replace('{name}', warningModalData.profileName)
                .replace('{count}', String(warningModalData.userCount))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setWarningModalData(null)}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                }}
              >
                {t('common.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}