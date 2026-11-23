import React from 'react';
import { AlertCircle, X, Pencil } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Profile, ProfileWarningData } from './types';

interface ProfileWarningModalProps {
  data: ProfileWarningData | null;
  onClose: () => void;
  onEditProfile?: (profile: Profile) => void;
}

export const ProfileWarningModal: React.FC<ProfileWarningModalProps> = ({
  data,
  onClose,
  onEditProfile,
}) => {
  const { t, isRtl } = useLanguage();

  if (!data) return null;

  return (
    <div
      className="profile-warning-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="profile-warning-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-warning-header">
          <div className="profile-warning-title-group">
            <AlertCircle size={20} />
            <h3 className="profile-warning-title">
              {t('profiles.profileInUseTitle')}
            </h3>
          </div>
          <button
            type="button"
            className="profile-drawer-close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="profile-warning-body">
          {t('profiles.profileInUseDesc')
            .replace('{name}', data.profileName)
            .replace('{count}', String(data.userCount))}
        </div>

        <div className="profile-warning-actions">
          <button
            type="button"
            className="profile-btn profile-btn-secondary"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
          {data.profileObj && onEditProfile && (
            <button
              type="button"
              className="profile-btn profile-btn-primary"
              onClick={() => {
                const p = data.profileObj!;
                onClose();
                onEditProfile(p);
              }}
            >
              <Pencil size={14} />
              <span>{t('profiles.editProfileTitle')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
