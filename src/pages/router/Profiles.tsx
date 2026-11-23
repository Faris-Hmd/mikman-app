import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  Layers,
  Clock,
  HardDrive,
  Plus,
  Shield,
  Pencil,
  DollarSign,
  CheckCircle2,
  Zap,
  Tag,
} from 'lucide-react';
import {
  fetchProfilesAPI,
  deleteProfileAPI,
  createProfileAPI,
  renameProfileAPI,
  revalidateRouterCache,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import { Profile, ProfileWarningData } from '../../components/profiles/types';
import { ProfileDrawer, ProfileSavePayload } from '../../components/profiles/ProfileDrawer';
import { ProfileWarningModal } from '../../components/profiles/ProfileWarningModal';
import './Profiles.css';

export default function ProfilesPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const { showConfirm, showAlert } = useModal();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [warningModalData, setWarningModalData] = useState<ProfileWarningData | null>(null);

  const { data: profiles, isLoading, mutate } = useSWR<Profile[]>(
    routerId ? `router-profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!) as Promise<Profile[]>,
    { revalidateOnFocus: true, keepPreviousData: true }
  );

  const profileList: Profile[] = useMemo(() => {
    if (!Array.isArray(profiles)) return [];
    return profiles.filter((p) => p.name && p.name.toLowerCase() !== 'default');
  }, [profiles]);

  // Telemetry counts
  const totalProfiles = profileList.length;
  const unlimitedCount = profileList.filter((p) => p.isUnlimited || !p.limitMB).length;
  const limitedCount = totalProfiles - unlimitedCount;

  // Drawer handlers
  const handleOpenCreateDrawer = () => {
    setEditingProfile(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (p: Profile) => {
    setEditingProfile(p);
    setIsDrawerOpen(true);
  };

  const handleSaveProfile = async (payload: ProfileSavePayload) => {
    if (!routerId) return;
    if (payload.isEdit && payload.profileId) {
      await renameProfileAPI(
        routerId,
        payload.profileId,
        payload.name,
        undefined,
        payload.price,
        payload.validity,
        payload.limitMB,
        payload.isUnlimited
      );
      setSuccessMsg(t('profiles.profileUpdated'));
    } else {
      await createProfileAPI(
        routerId,
        payload.name,
        payload.validity,
        payload.limitMB,
        payload.isUnlimited,
        undefined,
        payload.price
      );
      setSuccessMsg(t('profiles.profileCreated'));
    }
    revalidateRouterCache(routerId);
    await mutate();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete handler
  const handleDeleteProfile = (p: Profile) => {
    if (p.vouchersCount && p.vouchersCount > 0) {
      setWarningModalData({
        profileName: p.name,
        userCount: p.vouchersCount,
        profileObj: p,
      });
      return;
    }

    const title = t('profiles.deleteConfirmTitle');
    const message = t('profiles.deleteConfirm').replace('{name}', p.name);

    showConfirm(title, message, async () => {
      try {
        await deleteProfileAPI(routerId!, p['.id']);
        showAlert(t('common.success'), t('profiles.profileDeleted'), 'success');
        mutate();
        if (routerId) revalidateRouterCache(routerId);
      } catch (err: any) {
        if (err?.code === 'PROFILE_IN_USE' || err?.userCount || err?.message?.includes('assigned to') || err?.message?.includes('PROFILE_IN_USE')) {
          setWarningModalData({
            profileName: err.profileName || p.name,
            userCount: err.userCount || 1,
            message: err.message,
            profileObj: p,
          });
        } else {
          showAlert(t('common.error'), err?.message || 'Error deleting profile', 'error');
        }
      }
    });
  };

  return (
    <div className="responsive-container" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Page Header ─── */}
      <div className="page-header-card">
        <div className="page-header-left-group">
          <div className="page-header-icon">
            <Layers />
          </div>
          <div className="page-header-titles">
            <h2 className="page-header-title">{t('profiles.title')}</h2>
            <p className="page-header-subtitle">{t('profiles.subtitle')}</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateDrawer}
          className="page-header-btn page-header-btn-primary"
        >
          <Plus size={14} />
          <span>{t('common.add')}</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="profile-success-banner">
          <CheckCircle2 size={14} className="flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Telemetry Summary Cards */}
      <div className="profiles-stats-grid">
        <div className="profile-stat-card">
          <div className="profile-stat-icon">
            <Layers size={14} />
          </div>
          <div className="profile-stat-info">
            <span className="profile-stat-label">{t('profiles.totalProfiles')}</span>
            <strong className="profile-stat-value">{totalProfiles}</strong>
          </div>
        </div>

        <div className="profile-stat-card">
          <div className="profile-stat-icon">
            <Zap size={14} />
          </div>
          <div className="profile-stat-info">
            <span className="profile-stat-label">{t('profiles.unlimited')}</span>
            <strong className="profile-stat-value unlimited">{unlimitedCount}</strong>
          </div>
        </div>

        <div className="profile-stat-card">
          <div className="profile-stat-icon">
            <HardDrive size={14} />
          </div>
          <div className="profile-stat-info">
            <span className="profile-stat-label">{t('profiles.trafficLimit')}</span>
            <strong className="profile-stat-value limited">{limitedCount}</strong>
          </div>
        </div>
      </div>

      {/* Profiles List */}
      {isLoading ? (
        <div className="profiles-list-stack">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="skeleton profile-skeleton-item"
            />
          ))}
        </div>
      ) : profileList.length === 0 ? (
        <div className="profiles-empty-state">
          <Shield size={24} className="profiles-empty-icon" />
          <h4 className="profiles-empty-title">{t('profiles.noProfilesFound')}</h4>
          <p className="profiles-empty-desc">{t('profiles.noProfilesDesc')}</p>
        </div>
      ) : (
        <div className="profiles-list-stack">
          {profileList.map((profile) => {
            const hasPrice = profile.formattedPrice || (profile.price != null && profile.price !== '');
            const displayValidity = profile.validityBadge || (profile.validity ? profile.validity.toUpperCase() : '∞');
            const displayData = profile.dataBadge || (profile.isUnlimited || !profile.limitMB ? '∞' : `${profile.limitMB} MB`);

            return (
              <div
                key={profile['.id'] || profile.name}
                className="profile-card-item"
                onClick={() => handleOpenEditDrawer(profile)}
              >
                {/* Left: Icon, Name & Single-row Badges */}
                <div className="profile-card-left">
                  <div className="profile-card-icon">
                    <Layers size={13} />
                  </div>

                  <strong className="profile-card-name" title={profile.name}>
                    {profile.name}
                  </strong>

                  <div className="profile-badge-row">
                    {/* Price Badge */}
                    <div className="profile-badge-slot-price">
                      {hasPrice && (
                        <span className="profile-meta-badge price">
                          <DollarSign size={9.5} className="flex-shrink-0" />
                          <span>{profile.formattedPrice || profile.price}</span>
                        </span>
                      )}
                    </div>

                    {/* Validity Badge */}
                    <div className="profile-badge-slot-time">
                      <span className="profile-meta-badge time">
                        <Clock size={9.5} className="flex-shrink-0" />
                        <span>{displayValidity}</span>
                      </span>
                    </div>

                    {/* Data Limit Badge */}
                    <div className="profile-badge-slot-data">
                      <span className="profile-meta-badge data">
                        <HardDrive size={9.5} className="flex-shrink-0" />
                        <span>{displayData}</span>
                      </span>
                    </div>

                    {/* Optional Vouchers Count Badge */}
                    {profile.vouchersCount !== undefined && profile.vouchersCount > 0 && (
                      <span className="profile-meta-badge vouchers">
                        <Tag size={9.5} className="flex-shrink-0" />
                        <span>{profile.vouchersCount}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Edit Action */}
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditDrawer(profile);
                  }}
                  title={t('profiles.editProfileTitle')}
                >
                  <Pencil size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Drawer */}
      {routerId && (
        <ProfileDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          editingProfile={editingProfile}
          onSaveProfile={handleSaveProfile}
          onDeleteRequest={handleDeleteProfile}
        />
      )}

      {/* Warning Modal when profile has attached users */}
      <ProfileWarningModal
        data={warningModalData}
        onClose={() => setWarningModalData(null)}
        onEditProfile={(p) => handleOpenEditDrawer(p)}
      />
    </div>
  );
}
