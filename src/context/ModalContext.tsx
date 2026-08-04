import React, { createContext, useContext, useState } from 'react';
import { ShieldCheck, AlertTriangle, HelpCircle, X, RefreshCw } from 'lucide-react';
import { useLanguage } from './LanguageContext';

interface ModalContextType {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'confirm';
    onConfirm?: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setIsSubmitting(false);
    setModal({ isOpen: true, title, message, type: 'confirm', onConfirm });
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleProceed = async () => {
    if (isSubmitting) return;
    if (modal.onConfirm) {
      try {
        setIsSubmitting(true);
        await modal.onConfirm();
      } catch (err) {
        console.error('Modal confirm action error:', err);
      } finally {
        setIsSubmitting(false);
        setModal(prev => ({ ...prev, isOpen: false }));
      }
    } else {
      setModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {modal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }}>
          <div className="glass-card" style={{
            maxWidth: '400px', width: '100%', padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {modal.type === 'success' && <ShieldCheck size={20} color="#22c55e" />}
                {modal.type === 'error' && <AlertTriangle size={20} color="#ef4444" />}
                {modal.type === 'warning' && <AlertTriangle size={20} color="#f59e0b" />}
                {modal.type === 'confirm' && <HelpCircle size={20} color="var(--primary)" />}
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--foreground)' }}>{modal.title}</h4>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isSubmitting ? 'var(--text-muted)' : 'var(--foreground)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  opacity: isSubmitting ? 0.5 : 1
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{modal.message}</p>
            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
              {modal.type === 'confirm' ? (
                <>
                  <button
                    className="btn-secondary"
                    disabled={isSubmitting}
                    style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '10px', minHeight: '40px', opacity: isSubmitting ? 0.5 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                    onClick={handleClose}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="btn-primary"
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: '10px',
                      fontSize: '13px',
                      borderRadius: '10px',
                      minHeight: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: isSubmitting ? 0.7 : 1,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer'
                    }}
                    onClick={handleProceed}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="spin" />
                        <span>{t('common.loading') || 'Processing...'}</span>
                      </>
                    ) : (
                      t('common.proceed')
                    )}
                  </button>
                </>
              ) : (
                <button
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px', fontSize: '13px', borderRadius: '10px', minHeight: '40px' }}
                  onClick={handleClose}
                >
                  {t('common.ok')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}