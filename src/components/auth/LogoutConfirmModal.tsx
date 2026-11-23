import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import '../layout/shell.css';

interface LogoutConfirmModalProps {
  onClose: () => void;
  onSigningOut?: () => void;
}

export default function LogoutConfirmModal({ onClose, onSigningOut }: LogoutConfirmModalProps) {
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    onSigningOut?.();
    try {
      await signOut();
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay z-[9999]" onClick={onClose}>
      <div
        className="shell-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shell-modal-icon-danger">
          <LogOut size={28} />
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground m-0 mb-1.5">
            {t('sidebar.confirmSignOut') || 'Sign Out'}
          </h3>
          <p className="text-xs text-muted m-0 leading-relaxed">
            {t('sidebar.confirmSignOutDesc') || 'Are you sure you want to sign out from MikMan?'}
          </p>
        </div>

        <div className="flex gap-2.5 w-full mt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="btn-solid-slate flex-1 py-2.5 rounded-xl text-xs"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="btn-solid-red flex-1 py-2.5 rounded-xl text-xs"
          >
            {isLoading ? (t('common.processing') || 'Signing out...') : (t('sidebar.signOut') || 'Sign Out')}
          </button>
        </div>
      </div>
    </div>
  );
}
