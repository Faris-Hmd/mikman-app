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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '380px',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <LogOut size={28} />
        </div>

        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--foreground)', margin: '0 0 8px 0' }}>
            {t('account.signOutConfirmTitle') || t('sidebar.signOut')}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
            {t('account.signOutConfirmDesc') || 'Are you sure you want to sign out?'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--foreground)',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#ef4444',
              border: 'none',
              color: '#ffffff',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? t('common.signingOut') : (t('account.signOutBtn') || t('sidebar.signOutShort'))}
          </button>
        </div>
      </div>
    </div>
  );
}