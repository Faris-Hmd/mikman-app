import React, { createContext, useContext, useState } from 'react';
import { ShieldCheck, AlertTriangle, HelpCircle, Trash2, X, RefreshCw } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import '../components/layout/shell.css';

export interface ConfirmOptions {
  confirmLabel?: string;
  variant?: 'primary' | 'danger';
}

export interface ModalContextType {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'warning') => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: ConfirmOptions
  ) => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const { t, isRtl } = useLanguage();
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'confirm';
    variant?: 'primary' | 'danger';
    confirmLabel?: string;
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

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: ConfirmOptions
  ) => {
    setIsSubmitting(false);
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      variant: options?.variant || 'primary',
      confirmLabel: options?.confirmLabel,
      onConfirm,
    });
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

  const badgeType = modal.type === 'confirm' && modal.variant === 'danger' ? 'danger' : modal.type;

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {modal.isOpen && (
        <div
          className="app-modal-overlay"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={handleClose}
        >
          <div
            className="app-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-modal-header">
              <div className="app-modal-title-group">
                <div className={`app-modal-icon-badge ${badgeType}`}>
                  {modal.type === 'success' && <ShieldCheck size={18} />}
                  {modal.type === 'error' && <AlertTriangle size={18} />}
                  {modal.type === 'warning' && <AlertTriangle size={18} />}
                  {modal.type === 'confirm' && modal.variant === 'danger' && <Trash2 size={18} />}
                  {modal.type === 'confirm' && modal.variant !== 'danger' && <HelpCircle size={18} />}
                </div>
                <h4 className="app-modal-title">{modal.title}</h4>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="app-modal-close-btn"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <p className="app-modal-message">{modal.message}</p>

            <div className="app-modal-actions">
              {modal.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    className="btn-solid-slate app-modal-btn"
                    disabled={isSubmitting}
                    onClick={handleClose}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className={`${modal.variant === 'danger' ? 'btn-solid-red' : 'btn-solid-blue'} app-modal-btn`}
                    disabled={isSubmitting}
                    onClick={handleProceed}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{t('common.loading') || 'Processing...'}</span>
                      </>
                    ) : (
                      modal.confirmLabel || t('common.proceed')
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-solid-blue app-modal-btn"
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
