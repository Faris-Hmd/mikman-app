import React from 'react';
import { LogOut } from 'lucide-react';

interface LogoutConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}

export default function LogoutConfirmModal({ onClose, onConfirm, t }: LogoutConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '380px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <LogOut size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--foreground)', margin: '0 0 8px 0' }}>{t('account.signOutConfirmTitle')}</h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>{t('account.signOutConfirmDesc')}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--foreground)', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
              {t('common.cancel')}
            </button>
            <button onClick={onConfirm}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#ef4444', border: 'none', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
              {t('account.signOutBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}