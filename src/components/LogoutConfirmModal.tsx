import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6 max-w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center text-[#ef4444]">
            <LogOut size={28} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--foreground)] m-0 mb-2">{t('account.signOutConfirmTitle')}</h2>
            <p className="text-[13.5px] text-[var(--text-muted)] m-0 leading-relaxed">{t('account.signOutConfirmDesc')}</p>
          </div>
          <div className="flex gap-2.5 w-full mt-2">
            <button onClick={onClose} disabled={isLoading} className="flex-1 p-2.5 rounded-lg bg-transparent border border-[var(--glass-border)] text-[var(--foreground)] font-semibold cursor-pointer text-[var(--text-base)] hover:bg-[var(--secondary)] transition-colors disabled:opacity-50">
              {t('common.cancel')}
            </button>
            <button onClick={handleSignOut} disabled={isLoading} className="flex-1 p-2.5 rounded-lg bg-[#ef4444] border-none text-white font-semibold cursor-pointer text-[var(--text-base)] hover:opacity-90 transition-opacity disabled:opacity-50">
              {isLoading ? t('common.signingOut') : t('account.signOutBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}