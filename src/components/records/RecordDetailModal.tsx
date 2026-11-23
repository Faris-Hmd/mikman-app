import React from 'react';
import { X, FileText, List, Code, Info, Tag, Copy, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export interface AuditRecord {
  id: string;
  routerId?: string;
  action: string;
  operator?: string;
  details?: string | any;
  timestamp?: string;
}

export interface ParsedChip {
  key: string;
  label: string;
  value: string;
  color?: string;
}

export interface ParsedLog {
  rawJson: string;
  summaryText: string;
  chips: ParsedChip[];
  parsedObject: Record<string, any> | null;
  isParsed: boolean;
}

interface RecordDetailModalProps {
  record: AuditRecord;
  parsedLog: ParsedLog;
  onClose: () => void;
  onCopy: (text: string, fieldName: string) => void;
  copiedField: string | null;
  showRawJson: boolean;
  setShowRawJson: (show: boolean) => void;
  formatDate: (iso: string | undefined) => string;
  getActionBadgeStyle: (action: string) => { bg: string; color: string; border: string; icon: React.ReactNode; type: string };
}

export default function RecordDetailModal({
  record,
  parsedLog,
  onClose,
  onCopy,
  copiedField,
  showRawJson,
  setShowRawJson,
  formatDate,
  getActionBadgeStyle
}: RecordDetailModalProps) {
  const { t } = useLanguage();
  const badge = getActionBadgeStyle(record.action);

  return (
    <div className="records-modal-backdrop" onClick={onClose}>
      <div className="records-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="records-modal-header">
          <div className="records-modal-title-group">
            <div
              className={`records-modal-action-icon ${badge.type}`}
            >
              <FileText size={18} />
            </div>
            <div>
              <h3 className="m-0 text-sm font-extrabold text-foreground">
                {t('records.recordDetails')}
              </h3>
              <span className="text-[11px] text-muted">
                ID: {record.id}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="records-modal-close-btn" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* View Mode Toggle: Structured vs Raw JSON */}
        <div className="records-view-toggle">
          <button
            onClick={() => setShowRawJson(false)}
            className={`records-view-btn ${!showRawJson ? 'active' : ''}`}
          >
            <List size={13} />
            <span>{t('records.viewStructured') || 'Structured View'}</span>
          </button>
          <button
            onClick={() => setShowRawJson(true)}
            className={`records-view-btn ${showRawJson ? 'active' : ''}`}
          >
            <Code size={13} />
            <span>{t('records.viewRawJson') || 'Raw JSON'}</span>
          </button>
        </div>

        {/* Metadata Rows */}
        <div className="records-meta-group">
          <div className="records-meta-row">
            <span className="text-muted font-semibold">{t('records.action')}</span>
            <span className={`font-extrabold ${badge.type === 'delete' ? 'text-red-500' : badge.type === 'create' ? 'text-emerald-500' : badge.type === 'bypass' ? 'text-purple-500' : 'text-blue-500'}`}>
              {record.action}
            </span>
          </div>

          <div className="records-meta-row">
            <span className="text-muted font-semibold">{t('records.operator')}</span>
            <span className="font-bold text-foreground">
              {record.operator || 'System'}
            </span>
          </div>

          <div className="records-meta-row">
            <span className="text-muted font-semibold">{t('records.timestamp')}</span>
            <span className="font-semibold text-foreground">
              {formatDate(record.timestamp)}
            </span>
          </div>
        </div>

        {/* Structured Parameters Panel */}
        {!showRawJson ? (
          <div className="records-details-panel">
            {/* Summary Banner */}
            <div
              className={`records-banner-summary ${badge.type}`}
            >
              <Info size={15} className="flex-shrink-0" />
              <span>{parsedLog.summaryText}</span>
            </div>

            {/* Parsed Chips / Parameters Grid */}
            {parsedLog.chips.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-muted font-semibold text-[11px]">
                  {t('records.parsedKeys')}
                </span>
                <div className="records-chips-grid">
                  {parsedLog.chips.map((chip) => (
                    <div key={chip.key} className="records-chip-card">
                      <span className="records-chip-label">{chip.label}</span>
                      <span className="records-chip-value">
                        {chip.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Array of Pins / Vouchers preview if available */}
            {parsedLog.parsedObject?.pins && Array.isArray(parsedLog.parsedObject.pins) && (
              <div className="records-pins-container">
                <div className="flex items-center gap-1.5 text-[11px] text-muted font-semibold">
                  <Tag size={12} />
                  <span>{t('records.keyPins')} ({parsedLog.parsedObject.pins.length})</span>
                </div>
                <div className="records-pins-scroll">
                  {parsedLog.parsedObject.pins.map((pin: string, idx: number) => (
                    <span key={idx} className="records-pin-badge">
                      {pin}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Raw JSON Panel */
          <div className="flex flex-col gap-1.5">
            <span className="text-muted font-semibold text-[11px]">
              {t('records.rawJson')}
            </span>
            <div className="records-raw-box">
              {parsedLog.rawJson}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="records-modal-actions">
          <button
            onClick={() => onCopy(record.id, 'id')}
            className="records-btn-solid records-btn-slate"
          >
            {copiedField === 'id' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copiedField === 'id' ? t('records.copied') : t('records.copyId')}</span>
          </button>

          <button
            onClick={onClose}
            className="records-btn-solid records-btn-blue"
          >
            {t('records.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
