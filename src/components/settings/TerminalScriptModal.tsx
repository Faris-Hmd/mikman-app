import React, { useState } from 'react';
import { Terminal, X, Copy, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface TerminalScriptModalProps {
  script: string | null;
  onClose: () => void;
}

export const TerminalScriptModal: React.FC<TerminalScriptModalProps> = ({
  script,
  onClose,
}) => {
  const { t, isRtl } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!script) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="aps-modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="aps-modal-card settings-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aps-modal-header">
          <div className="aps-modal-header-left">
            <div className="aps-modal-icon">
              <Terminal size={16} />
            </div>
            <div>
              <h3 className="aps-modal-title">
                {t('settings.setupScriptTitle')}
              </h3>
              <p className="aps-modal-subtitle">
                {t('settings.setupScriptNotice')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="aps-modal-close-btn"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        <div className="aps-modal-body">
          <pre className="settings-script-pre">
            {script}
          </pre>

          <div className="settings-modal-actions">
            <button
              type="button"
              className="settings-btn-secondary"
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="settings-btn-primary"
              onClick={handleCopy}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? t('common.copied') : t('settings.copyScriptFinish')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
