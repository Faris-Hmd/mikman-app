import React, { useState, useEffect } from 'react';
import { Printer, X, Ticket, Download, Share2, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getVoucherCodesAPI, type VoucherBatch } from '../../api';

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBatch: VoucherBatch | null;
  routerId: string;
  activeRouter: any;
  isRtl: boolean;
  showToast: (text: string, type: 'success' | 'error') => void;
}

export const PrintConfigModal: React.FC<PrintConfigModalProps> = ({
  isOpen,
  onClose,
  selectedBatch,
  routerId,
  activeRouter,
  isRtl,
  showToast,
}) => {
  const { t } = useLanguage();

  const [printWifiName, setPrintWifiName] = useState<string>('MikMan Wi-Fi');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  useEffect(() => {
    if (activeRouter) {
      const savedName =
        activeRouter.cardPrintLabel ||
        activeRouter.hotspotWifiName ||
        activeRouter.wifiName ||
        activeRouter.wifiSsid ||
        '';
      if (savedName) {
        setPrintWifiName(savedName);
      }
    }
  }, [activeRouter]);

  if (!isOpen || !selectedBatch) return null;

  const handleDownloadPDF = async (mode: 'download' | 'share' = 'download') => {
    if (!routerId || !selectedBatch) return;
    setIsGeneratingPdf(true);
    try {
      const filter = (selectedBatch as any).printFilter || 'all';

      const res = await getVoucherCodesAPI(
        routerId,
        selectedBatch.profile,
        selectedBatch.comment,
        selectedBatch.printLabel,
        filter,
        selectedBatch.batchId
      );
      const codes = res?.codes || [];

      if (codes.length === 0) {
        showToast('No voucher codes found to print', 'error');
        return;
      }

      const savedDbName =
        activeRouter?.cardPrintLabel ||
        activeRouter?.hotspotWifiName ||
        activeRouter?.wifiName ||
        activeRouter?.wifiSsid;

      const networkName =
        printWifiName.trim() || savedDbName || selectedBatch.printLabel || 'Wi-Fi Hotspot';
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
      const doc = new jsPDF({
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

          // Profile Name Footer
          ctx.fillStyle = '#444444';
          ctx.font = fontProfile;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(profileName, x + cardWidth / 2, y + 15.5 * scale);
        });

        if (pageIdx > 0) {
          doc.addPage();
        }
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const safeWifiName = networkName.replace(/[\s|/\\:*?"<>|]/g, '_');
      const safeProfileName = profileName.replace(/[\s|/\\:*?"<>|]/g, '_');
      const fileName = `${safeWifiName}_${safeProfileName}_${codes.length}_vouchers.pdf`;

      if (mode === 'share' && navigator.share && navigator.canShare) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: 'Voucher Batch PDF',
          });
          onClose();
          showToast('PDF shared successfully!', 'success');
          return;
        }
      }

      doc.save(fileName);
      onClose();
      showToast('PDF downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      showToast('Failed to generate PDF document.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const filter = (selectedBatch as any).printFilter || 'unused';
  const cardCount =
    filter === 'all'
      ? selectedBatch.originalCount || 0
      : selectedBatch.unusedCount ?? selectedBatch.originalCount ?? 0;
  const pageCount = Math.ceil(cardCount / 98) || (cardCount > 0 ? 1 : 0);

  return (
    <div
      className="print-modal-overlay mobile-bottom-sheet-overlay"
      onClick={onClose}
    >
      <div
        className="print-modal-content mobile-bottom-sheet-content"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-drag-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Printer size={18} style={{ color: '#3b82f6' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
              إعدادات طباعة الدفعة
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Print Quantity Summary Banner */}
        <div className="print-count-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ticket size={16} />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>
              {isRtl ? 'عدد الكروت للطباعة:' : 'Cards to print:'}
            </span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--foreground)' }}>
            {cardCount} {isRtl ? 'كرت' : 'cards'} ({pageCount} {isRtl ? 'صفحة A4' : 'A4 pages'})
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
            اسم شبكة الـ Wi-Fi الظاهر على الكروت
          </label>
          <input
            type="text"
            value={printWifiName}
            onChange={(e) => setPrintWifiName(e.target.value)}
            placeholder="MikMan Wi-Fi"
            style={{
              width: '100%',
              background: 'var(--input-bg, rgba(32, 32, 36, 0.75))',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--foreground)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Live Voucher Card Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
            {t('vouchers.liveMock') || 'معاينة كرت الطباعة'}
          </label>
          <div className="print-card-preview">
            <div
              style={{
                width: '100%',
                textAlign: 'center',
                padding: '3px 0',
                background: '#f1f5f9',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#1e293b',
              }}
            >
              {printWifiName.trim() || selectedBatch.printLabel || 'Wi-Fi Hotspot'}
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 900,
                letterSpacing: '2px',
                color: '#0f172a',
                padding: '4px 0',
              }}
            >
              8837105
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
              {selectedBatch.profile}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--secondary, rgba(255, 255, 255, 0.04))',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          سيتم توليد ملف PDF عالي الكثافة يحتوي على 98 كرت في كل صفحة (شبكة 14x7) جاهز للطباعة على ورقة A4.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => handleDownloadPDF('download')}
            disabled={isGeneratingPdf}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '12px',
              border: 'none',
              cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>تحميل PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPDF('share')}
            disabled={isGeneratingPdf}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '12px',
              border: 'none',
              cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            <span>مشاركة PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
