import React, { useState, useEffect, useMemo } from 'react';
import { Printer, X, Ticket, Download, Share2, Loader2, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { type VoucherBatch } from '../../api';

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBatch: VoucherBatch | null;
  defaultWifiName?: string;
  onFetchCodes: (batch: VoucherBatch, filter: string) => Promise<string[]>;
}

export const PrintConfigModal: React.FC<PrintConfigModalProps> = ({
  isOpen,
  onClose,
  selectedBatch,
  defaultWifiName,
  onFetchCodes,
}) => {
  const { t, isRtl } = useLanguage();

  const [printWifiName, setPrintWifiName] = useState<string>('MikMan Wi-Fi');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (isOpen) {
      const initialName =
        defaultWifiName ||
        selectedBatch?.printLabel ||
        selectedBatch?.profile ||
        'MikMan Wi-Fi';
      setPrintWifiName(initialName);
      setToastMessage(null);
    }
  }, [isOpen, defaultWifiName, selectedBatch]);

  if (!isOpen || !selectedBatch) return null;

  const handleDownloadPDF = async (mode: 'download' | 'share' = 'download') => {
    if (!selectedBatch) return;
    setIsGeneratingPdf(true);
    try {
      const filter = (selectedBatch as any).printFilter || 'all';
      const codes = await onFetchCodes(selectedBatch, filter);

      if (codes.length === 0) {
        showToast(t('batch.noVouchersFound'), 'error');
        return;
      }

      const networkName =
        printWifiName.trim() || defaultWifiName || selectedBatch.printLabel || 'Wi-Fi Hotspot';
      const profileName = selectedBatch.profile;

      // Page size A4 is 210 x 297 mm
      const canvasWidth = 1400;
      const canvasHeight = Math.round(canvasWidth * (297 / 210));
      const scale = canvasWidth / 210;

      const cols = 7;
      const rows = 12;
      const marginX = 7 * scale;
      const marginY = 9 * scale;
      const usableW = canvasWidth - marginX * 2;
      const usableH = canvasHeight - marginY * 2;
      const cardW = usableW / cols;
      const cardH = usableH / rows;

      const cardsPerPage = cols * rows;
      const totalPages = Math.ceil(codes.length / cardsPerPage);

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) pdf.addPage();

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const pageCodes = codes.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

        for (let i = 0; i < pageCodes.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = marginX + col * cardW;
          const y = marginY + row * cardH;

          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cardW, cardH);

          // Wi-Fi SSID
          ctx.fillStyle = '#1e3a8a';
          ctx.font = `bold ${Math.round(cardH * 0.16)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(networkName, x + cardW / 2, y + cardH * 0.24);

          // Voucher PIN Code
          ctx.fillStyle = '#0f172a';
          ctx.font = `900 ${Math.round(cardH * 0.28)}px monospace`;
          ctx.fillText(pageCodes[i], x + cardW / 2, y + cardH * 0.52);

          // Profile Name & Details
          ctx.fillStyle = '#475569';
          ctx.font = `bold ${Math.round(cardH * 0.13)}px sans-serif`;
          let displayProfile = profileName;
          if (selectedBatch.formattedPrice) {
            displayProfile = `${profileName} • ${selectedBatch.formattedPrice}`;
          }
          ctx.fillText(displayProfile, x + cardW / 2, y + cardH * 0.78);
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      const fileName = `vouchers-${selectedBatch.profile}-${selectedBatch.batchId || 'batch'}.pdf`;

      if (mode === 'share' && navigator.canShare) {
        const blob = pdf.output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: t('vouchers.title'),
            text: `${selectedBatch.profile} - ${codes.length} ${t('batch.cardsUnit')}`,
            files: [file],
          });
          return;
        }
      }

      pdf.save(fileName);
      showToast(t('batch.downloadStarted'), 'success');
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      showToast(err?.message || t('batch.failedGeneratePdf'), 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const cardCount = useMemo(() => {
    if (!selectedBatch) return 0;
    const filter = (selectedBatch as any).printFilter || 'all';
    if (filter === 'unused') return selectedBatch.unusedCount ?? selectedBatch.originalCount ?? 0;
    if (filter === 'active') return selectedBatch.activeCount ?? 0;
    if (filter === 'expired') return selectedBatch.expiredCount ?? 0;
    return selectedBatch.originalCount || selectedBatch.unusedCount || 0;
  }, [selectedBatch]);

  const pageCount = Math.max(1, Math.ceil(cardCount / 84));

  return (
    <div
      className="voucher-modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`voucher-toast-notification modal-toast-pos ${toastMessage.type}`}>
          {toastMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div
        className="print-modal-content mobile-bottom-sheet-content"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-drag-handle" />
        <div className="batch-detail-header modal-header-clean">
          <div className="drawer-title-group">
            <Printer size={18} className="text-blue" />
            <h3 className="drawer-title">
              {t('batch.printSettings')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="batch-detail-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Print Quantity Summary Banner */}
        <div className="print-count-banner">
          <div className="print-count-label-group">
            <Ticket size={16} />
            <span className="print-count-label">
              {t('batch.cardsToPrint')}
            </span>
          </div>
          <div className="print-count-value">
            {cardCount} {t('batch.cardsUnit')} ({pageCount} {t('batch.a4Pages')})
          </div>
        </div>

        <div className="drawer-field-group">
          <label className="drawer-field-label">
            {t('batch.printedWifiName')}
          </label>
          <input
            type="text"
            value={printWifiName}
            onChange={(e) => setPrintWifiName(e.target.value)}
            placeholder="MikMan Wi-Fi"
            className="drawer-input-field input-pad-horizontal"
          />
        </div>

        {/* Live Voucher Card Preview */}
        <div className="drawer-field-group">
          <label className="drawer-field-label">
            {t('vouchers.liveMock')}
          </label>
          <div className="print-card-preview">
            <div className="print-preview-wifi">
              {printWifiName.trim() || selectedBatch.printLabel || 'Wi-Fi Hotspot'}
            </div>
            <div className="print-preview-pin">
              8837105
            </div>
            <div className="print-preview-profile">
              {selectedBatch.profile}
              {selectedBatch.formattedPrice ? ` • ${selectedBatch.formattedPrice}` : ''}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="print-notice-box">
          {t('batch.printLayoutTip')}
        </div>

        {/* Action Buttons */}
        <div className="print-actions-row">
          <button
            type="button"
            onClick={() => handleDownloadPDF('download')}
            disabled={isGeneratingPdf || cardCount === 0}
            className="print-action-btn download"
          >
            {isGeneratingPdf ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span>{isGeneratingPdf ? t('batch.generatingPdf') : t('batch.downloadPdf')}</span>
          </button>

          {typeof navigator !== 'undefined' && 'canShare' in navigator && (
            <button
              type="button"
              onClick={() => handleDownloadPDF('share')}
              disabled={isGeneratingPdf || cardCount === 0}
              className="print-action-btn share"
            >
              <Share2 size={16} />
              <span>{t('batch.sharePdf')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
