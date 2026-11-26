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
      const canvasHeight = Math.round(canvasWidth * (297 / 210)); // 1980
      const scale = canvasWidth / 210;

      const cols = 7;
      const rows = 14;
      const cardWidth = 26.5 * scale;
      const cardHeight = 18.5 * scale;
      const colGap = 1.2 * scale;
      const rowGap = 0.8 * scale;
      const startX = 8.6 * scale;
      const startY = 16 * scale;
      const itemsPerPage = cols * rows;

      const fontHeader = `${Math.round(2.8 * scale)}px "Cairo", system-ui, -apple-system, sans-serif`;
      const fontWifiName = `bold ${Math.round(2.37 * scale)}px "Cairo", system-ui, -apple-system, sans-serif`;
      const fontVoucherCode = `bold ${Math.round(3.73 * scale)}px "Cairo", system-ui, -apple-system, sans-serif`;
      const fontProfile = `bold ${Math.round(2.37 * scale)}px "Cairo", system-ui, -apple-system, sans-serif`;

      const pages: string[][] = [];
      for (let i = 0; i < codes.length; i += itemsPerPage) {
        pages.push(codes.slice(i, i + itemsPerPage));
      }

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const now = new Date();
      const formattedDate = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const pageVouchers = pages[pageIdx];

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Header metadata bar
        ctx.font = fontHeader;
        ctx.fillStyle = '#505050';
        ctx.textBaseline = 'top';

        ctx.textAlign = 'left';
        ctx.fillText(
          `WiFi: ${networkName} | Profile: ${profileName} | Vouchers: ${codes.length}`,
          8.6 * scale,
          9.5 * scale
        );

        ctx.textAlign = 'right';
        ctx.fillText(`Printed: ${formattedDate}`, (210 - 8.6) * scale, 9.5 * scale);

        ctx.strokeStyle = '#d5d5d5';
        ctx.lineWidth = 0.2 * scale;
        ctx.beginPath();
        ctx.moveTo(8.6 * scale, 12.5 * scale);
        ctx.lineTo((210 - 8.6) * scale, 12.5 * scale);
        ctx.stroke();

        pageVouchers.forEach((codeStr, index) => {
          const colIndex = index % cols;
          const rowIndex = Math.floor(index / cols);

          const x = startX + colIndex * (cardWidth + colGap);
          const y = startY + rowIndex * (cardHeight + rowGap);

          ctx.strokeStyle = '#444444';
          ctx.lineWidth = 0.25 * scale;
          ctx.beginPath();
          const rx = 1 * scale;
          if (ctx.roundRect) {
            ctx.roundRect(x, y, cardWidth, cardHeight, rx);
          } else {
            ctx.rect(x, y, cardWidth, cardHeight);
          }
          ctx.stroke();

          // WiFi Icon & Name Header
          ctx.font = fontWifiName;
          const textWidth = ctx.measureText(networkName).width;
          const iconWidth = 2.5 * scale;
          const totalWidth = iconWidth + textWidth;
          const wifiStartX = x + (cardWidth - totalWidth) / 2;
          const iconCX = wifiStartX + 0.8 * scale;
          const textX = wifiStartX + 2.5 * scale;

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(iconCX, y + 4.2 * scale, 0.3 * scale, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 0.22 * scale;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(iconCX - 0.6 * scale, y + 3.6 * scale);
          ctx.quadraticCurveTo(iconCX, y + 3.1 * scale, iconCX + 0.6 * scale, y + 3.6 * scale);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(iconCX - 1.1 * scale, y + 3.1 * scale);
          ctx.quadraticCurveTo(iconCX, y + 2.4 * scale, iconCX + 1.1 * scale, y + 3.1 * scale);
          ctx.stroke();

          ctx.fillStyle = '#000000';
          ctx.font = fontWifiName;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(networkName, textX, y + 4.2 * scale);

          // Voucher Code PIN
          ctx.fillStyle = '#000000';
          ctx.font = fontVoucherCode;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(codeStr, x + cardWidth / 2, y + 10.5 * scale);

          // Profile Name Footer (no cost/price label)
          ctx.fillStyle = '#444444';
          ctx.font = fontProfile;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(profileName, x + cardWidth / 2, y + 15.5 * scale);
        });

        if (pageIdx > 0) {
          pdf.addPage();
        }
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const safeWifiName = networkName.replace(/[\s|/\\:*?"<>|]/g, '_');
      const safeProfileName = profileName.replace(/[\s|/\\:*?"<>|]/g, '_');
      const fileName = `${safeWifiName}_${safeProfileName}_${codes.length}_vouchers.pdf`;

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

  const pageCount = Math.ceil(cardCount / 98) || (cardCount > 0 ? 1 : 0);

  return (
    <div
      className="print-modal-overlay voucher-modal-overlay"
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
