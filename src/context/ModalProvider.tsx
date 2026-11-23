import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, HelpCircle, X, RefreshCw } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { ModalContext } from './ModalContext';
import '../components/layout/shell.css';

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
        <div className="modal-overlay z-[9999] flex items-center justify-center p-5">
          <div className="shell-modal-content max-w-[400px] w-full text-left">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2">
                {modal.type === 'success' && <ShieldCheck size={20} color="#22c55e" />}
                {modal.type === 'error' && <AlertTriangle size={20} color="#ef4444" />}
                {modal.type === 'warning' && <AlertTriangle size={20} color="#f59e0b" />}
                {modal.type === 'confirm' && <HelpCircle size={20} color="var(--primary)" />}
                <h4 className="m-0 text-sm font-bold text-foreground">{modal.title}</h4>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="bg-transparent border-none text-muted cursor-pointer p-1"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <p className="m-0 text-xs text-muted leading-relaxed w-full">{modal.message}</p>
            <div className="flex gap-2 w-full mt-1">
              {modal.type === 'confirm' ? (
                <>
                  <button
                    className="btn-solid-slate flex-1 py-2.5 rounded-lg text-xs"
                    disabled={isSubmitting}
                    onClick={handleClose}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="btn-solid-blue flex-1 py-2.5 rounded-lg text-xs"
                    disabled={isSubmitting}
                    onClick={handleProceed}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{t('common.loading') || 'Processing...'}</span>
                      </>
                    ) : (
                      t('common.proceed')
                    )}
                  </button>
                </>
              ) : (
                <button
                  className="btn-solid-blue flex-1 py-2.5 rounded-lg text-xs"
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
