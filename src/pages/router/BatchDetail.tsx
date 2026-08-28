import { useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import {
  fetchVoucherBatchDetailAPI,
  deleteVouchersAPI,
  enableVouchersAPI,
  formatLoginDateDisplay,
  sortByLoginDate,
  searchVouchersAPI,
  getVoucherCodesAPI,
  getAllVouchersByStatusAPI,
  fetchRouterProfilesAPI,
  fetchRouterProfilesWithUserAPI,
  fetchProfilesAPI,
  fetchSingleRouterStatusAPI,
  updateRouterProfileAPI,
  revalidateRouterCache,
  type VoucherBatchDetail,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
  type VoucherSearchResult,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import {
  Trash2,
  Search,
  Printer,
  Share2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Layers,
  CheckCircle2,
  Zap,
  Clock,
  HardDrive,
  Wifi,
  Tag,
  MessageSquare,
  RefreshCw,
  Calendar,
  RotateCcw,
} from 'lucide-react';

type StatusFilter = 'all' | 'unused' | 'active' | 'expired';

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
};

const getVoucherName = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.name || v['.id'] || '';
};

const parseBatchDate = (comment: string | null | undefined): Date | null => {
  if (!comment) return null;
  const clean = comment.split(' | ')[0].trim();
  const dateRegex = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:\s+(\d{2}):(\d{2}))?/;
  const match = clean.match(dateRegex);
  if (!match) {
    if (/\d{4}/.test(clean)) {
      const ts = Date.parse(clean);
      if (!isNaN(ts)) return new Date(ts);
    }
    return null;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hour = match[4] ? parseInt(match[4], 10) : 0;
  const minute = match[5] ? parseInt(match[5], 10) : 0;
  const date = new Date(year, month, day, hour, minute);
  if (isNaN(date.getTime())) return null;
  return date;
};

const formatBatchTime = (comment: string | null | undefined): string => {
  if (!comment) return 'Legacy Vouchers';
  if (comment.startsWith('profile:')) {
    return comment.replace('profile:', '');
  }
  const namePart = comment.split(' | ').find(p => p.startsWith('NAME:'));
  if (namePart) {
    return namePart.replace('NAME:', '');
  }
  const dateObj = parseBatchDate(comment);
  if (!dateObj) {
    return comment.split(' | ')[0];
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export default function BatchDetailPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();
  const { showConfirm } = useModal();

  const profile = searchParams.get('profile') || '';
  const comment = searchParams.get('comment') || undefined;
  const printLabel = searchParams.get('printLabel') || undefined;
  const batchId = searchParams.get('batchId') || undefined;

  // Router profile info & live status for Wi-Fi SSID
  const { data: routerProfilesData } = useSWR('router-profiles-with-user', fetchRouterProfilesWithUserAPI);
  const { data: routerStatus } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 30000, revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  // Hotspot User Profiles data for validity & limit fallbacks
  const { data: hotspotProfilesData } = useSWR(
    routerId ? `profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!)
  );

  const profileList = Array.isArray(hotspotProfilesData)
    ? (hotspotProfilesData as any[])
    : Array.isArray((hotspotProfilesData as any)?.profiles)
    ? ((hotspotProfilesData as any).profiles as any[])
    : [];

  const getProfileStatsForBatch = (pName: string) => {
    const found = profileList.find((p: any) => (p.name || p.id) === pName);
    let validity = '';
    const scriptText = String(found?.['on-login'] || (found as any)?.onlogin || '');
    if (scriptText) {
      const addDaysMatch = scriptText.match(/:local addDays (\d+);/i);
      const addHoursMatch = scriptText.match(/:local addHours ([\d:]+);/i);
      if (addDaysMatch && addHoursMatch) {
        const d = parseInt(addDaysMatch[1], 10);
        const hParts = addHoursMatch[1].split(':');
        const h = parseInt(hParts[0], 10);
        const m = parseInt(hParts[1], 10);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        validity = parts.length > 0 ? parts.join(' ') : 'UNLIMITED';
      } else if (scriptText.includes('exp=unlimited') || (!scriptText.includes('kill_') && scriptText.length > 0)) {
        validity = 'UNLIMITED';
      }
    }
    if (!validity && found?.validity) {
      validity = found.validity;
    }

    let dataLimit = found?.limitMB 
      ? (found.limitMB >= 500 
          ? `${(found.limitMB % 1024 === 0 || found.limitMB === 512 ? found.limitMB / 1024 : found.limitMB / 1000).toFixed(1).replace(/\.0$/, '')} GB` 
          : `${found.limitMB} MB`) 
      : (found?.['limit-bytes-total'] ? formatBytes(found['limit-bytes-total']) : '');
    if (!validity && pName) {
      const valMatch = pName.match(/\b(\d+)\s*([dhms]|days?|hours?)\b/i);
      if (valMatch) validity = `${valMatch[1]}${valMatch[2][0].toLowerCase()}`;
    }
    if (!dataLimit && pName) {
      const dataMatch = pName.match(/\b(\d+(?:\.\d+)?)\s*(MB|GB|mb|gb|M|G)\b/i);
      if (dataMatch) {
        const num = parseFloat(dataMatch[1]);
        const unit = dataMatch[2].toUpperCase();
        dataLimit = (unit === 'GB' || unit === 'G') ? `${num} GB` : `${num} MB`;
      }
    }
    return { validity: validity.toUpperCase(), dataLimit: dataLimit.toUpperCase() };
  };

  const routersList = Array.isArray(routerProfilesData)
    ? routerProfilesData
    : Array.isArray((routerProfilesData as any)?.profiles)
    ? (routerProfilesData as any).profiles
    : [];

  const activeRouter = routersList.find(
    (r: any) => r.id === routerId || r.name === routerId || String(r.id) === String(routerId)
  );

  const cardPrintLabelFromRouter =
    activeRouter?.cardPrintLabel?.trim() ||
    (activeRouter as any)?.card_print_label?.trim() ||
    '';

  const hotspotWifiNameFromRouter =
    activeRouter?.hotspotWifiName?.trim() ||
    (activeRouter as any)?.hotspot_wifi_name?.trim() ||
    '';

  const useCustomPrintLabelFromRouter =
    activeRouter?.useCustomPrintLabel ??
    (activeRouter as any)?.use_custom_print_label ??
    false;

  const [wifiInput, setWifiInput] = useState<string | null>(null);

  // Detail state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VoucherSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAllModal, setShowAllModal] = useState<'unused' | 'active' | 'expired' | null>(null);
  const [allVouchers, setAllVouchers] = useState<(VoucherSummary | ActiveVoucher | ExpiredVoucher)[] | null>(null);
  const [allVouchersLoading, setAllVouchersLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Info modal
  const [infoVoucher, setInfoVoucher] = useState<ActiveVoucher | ExpiredVoucher | VoucherSummary | VoucherSearchResult | null>(null);
  const [infoStatus, setInfoStatus] = useState<'unused' | 'active' | 'expired'>('unused');

  // Print/export state
  const [printCodes, setPrintCodes] = useState<string[] | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPrintConfirmModal, setShowPrintConfirmModal] = useState(false);
  const [printDate, setPrintDate] = useState('');
  const [printableVouchers, setPrintableVouchers] = useState<any[]>([]);

  // Selection for deletion
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);
  const [deleteBatchLoading, setDeleteBatchLoading] = useState(false);
  const [isEnablingVouchers, setIsEnablingVouchers] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch batch detail with 15s auto-refresh
  const { data: batchDetail, isLoading: detailLoading, mutate: mutateDetail } = useSWR(
    routerId && profile
      ? `batch-detail-${routerId}-${profile}-${batchId || comment || 'none'}`
      : null,
    () => fetchVoucherBatchDetailAPI(routerId!, profile, comment, printLabel, batchId),
    { revalidateOnFocus: true, refreshInterval: 15000, dedupingInterval: 2000, keepPreviousData: true }
  );

  const handleManualRefresh = async () => {
    if (!routerId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      revalidateRouterCache(routerId);
      await mutateDetail();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const routerSavedSSID =
    activeRouter?.wifiName ||
    (activeRouter as any)?.wifi_name ||
    routerStatus?.wifiName ||
    'MikroTik Wi-Fi';

  const defaultWifiName =
    cardPrintLabelFromRouter ||
    hotspotWifiNameFromRouter ||
    routerSavedSSID;

  const wifiName = (wifiInput !== null && wifiInput.trim() !== '') ? wifiInput.trim() : defaultWifiName;

  // ── Helpers ──

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshDetail = () => {
    if (routerId) {
      revalidateRouterCache(routerId);
      mutateDetail();
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toLocaleString();
    } catch {
      return d;
    }
  };

  const formatBytes = (bytes: number | string | null | undefined) => {
    if (bytes == null || bytes === '') return '—';
    const num = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
    if (isNaN(num) || num <= 0) return '—';
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)} GB`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} MB`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)} KB`;
    return `${num} B`;
  };

  // ── Delete ──

  const handleDeleteSelected = async () => {
    if (!routerId || selectedCodes.size === 0) return;
    try {
      setDeleteLoading(true);
      await deleteVouchersAPI(routerId, Array.from(selectedCodes));
      setSelectedCodes(new Set());
      showToast(`Deleted ${selectedCodes.size} vouchers.`, 'success');
      refreshDetail();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete vouchers.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSingle = async (code: string) => {
    if (!routerId) return;
    try {
      await deleteVouchersAPI(routerId, [code]);
      showToast(`Deleted voucher "${code}".`, 'success');
      refreshDetail();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete voucher.', 'error');
    }
  };

  const confirmDeleteSingle = (code: string, onSuccess?: () => void) => {
    showConfirm(
      t('common.delete') || 'Delete',
      (t('batch.deleteSingleConfirm') || 'Are you sure you want to delete voucher card "{code}"?').replace('{code}', code),
      async () => {
        await handleDeleteSingle(code);
        if (onSuccess) onSuccess();
      }
    );
  };

  const confirmDeleteSelected = () => {
    if (selectedCodes.size === 0) return;
    showConfirm(
      t('common.delete') || 'Delete',
      (t('batch.deleteSelectedConfirm') || 'Are you sure you want to delete {count} selected vouchers?').replace('{count}', String(selectedCodes.size)),
      async () => {
        await handleDeleteSelected();
      }
    );
  };

  const handleDeleteBatch = async () => {
    if (!routerId || !profile) return;
    try {
      setDeleteBatchLoading(true);
      const res = await getVoucherCodesAPI(
        routerId,
        profile,
        comment || undefined,
        printLabel || undefined,
        'all',
        batchId || undefined
      );
      const codes = res?.codes || [];
      if (codes.length === 0) {
        showToast(t('batch.noVouchersInBatch'), 'error');
        return;
      }
      await deleteVouchersAPI(routerId, codes);
      revalidateRouterCache(routerId);
      showToast(t('batch.batchDeletedSuccess'), 'success');
      setShowDeleteBatchModal(false);
      navigate(`/${routerId}/batch`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete batch.', 'error');
    } finally {
      setDeleteBatchLoading(false);
    }
  };

  const handleEnableVouchers = async (names: string[]) => {
    if (!routerId || !names || names.length === 0) return;
    try {
      setIsEnablingVouchers(true);
      const res = await enableVouchersAPI(routerId, names);
      showToast(`تم إعادة تفعيل ${res.enabledCount || names.length} كرت بنجاح!`, 'success');
      revalidateRouterCache(routerId);
      mutateDetail();
    } catch (err: any) {
      console.error('Failed to enable vouchers:', err);
      showToast(err.message || 'فشل تفعيل الكروت.', 'error');
    } finally {
      setIsEnablingVouchers(false);
    }
  };

  const toggleCodeSelection = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAllInView = (codes: string[]) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const allSelected = codes.every((c) => next.has(c));
      if (allSelected) {
        codes.forEach((c) => next.delete(c));
      } else {
        codes.forEach((c) => next.add(c));
      }
      return next;
    });
  };

  // ── Search ──

  const handleSearch = useCallback(async () => {
    if (!routerId || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setSearchLoading(true);
      const result = await searchVouchersAPI(
        routerId,
        searchQuery.trim(),
        profile,
        comment,
        printLabel,
        batchId
      );
      setSearchResults(result.results);
    } catch (err: any) {
      showToast(err?.message || 'Search failed.', 'error');
    } finally {
      setSearchLoading(false);
    }
  }, [routerId, searchQuery, profile, comment, printLabel, batchId]);

  // ── Print / Export (MK-Voucher-Web Template) ──

  const handlePrintVouchers = async (mode: 'print' | 'share' = 'print') => {
    if (!routerId) return;
    const originalTitle = document.title;
    try {
      setPrintLoading(true);

      let vouchersToPrint: any[] = [];
      if (batchDetail?.unusedVouchers && batchDetail.unusedVouchers.length > 0) {
        vouchersToPrint = batchDetail.unusedVouchers;
      }

      if (vouchersToPrint.length === 0 || (batchDetail && batchDetail.unusedCount > vouchersToPrint.length)) {
        const result = await getAllVouchersByStatusAPI(
          routerId,
          profile,
          'unused',
          comment,
          printLabel,
          batchId
        );
        if (result.vouchers && result.vouchers.length > 0) {
          vouchersToPrint = result.vouchers;
        }
      }

      if (vouchersToPrint.length === 0) {
        showToast('No unused vouchers available to print.', 'error');
        return;
      }

      if (vouchersToPrint.length > 5000) {
        vouchersToPrint = vouchersToPrint.slice(0, 5000);
        showToast(t('batch.printLimitNotice') || 'Print limit capped at 5000 cards maximum.', 'error');
      }

      setPrintableVouchers(vouchersToPrint);

      // Save printed Wi-Fi name persistently to router config so it shows on Settings page
      if (wifiInput && wifiInput.trim() !== '') {
        try {
          await updateRouterProfileAPI(routerId, {
            useCustomPrintLabel: true,
            cardPrintLabel: wifiInput.trim(),
          });
          revalidateRouterCache(routerId);
        } catch (e) {
          console.error('Failed to auto-save printed wifi name config:', e);
        }
      }

      const label = profile;
      const batchName = comment ? formatBatchTime(comment) : profile;
      const count = vouchersToPrint.length;

      const now = new Date();
      const formattedDate = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      setPrintDate(formattedDate);

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

      const pages = chunkArray(vouchersToPrint, itemsPerPage);

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
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

        ctx.font = fontHeader;
        ctx.fillStyle = '#505050';
        ctx.textBaseline = 'top';

        ctx.textAlign = 'left';
        ctx.fillText(`WiFi: ${wifiName} | Profile: ${label} | Vouchers: ${count}`, 8.6 * scale, 9.5 * scale);

        ctx.textAlign = 'right';
        ctx.fillText(`Batch: ${batchName} | Printed: ${formattedDate}`, (210 - 8.6) * scale, 9.5 * scale);

        ctx.strokeStyle = '#d5d5d5';
        ctx.lineWidth = 0.2 * scale;
        ctx.beginPath();
        ctx.moveTo(8.6 * scale, 12.5 * scale);
        ctx.lineTo((210 - 8.6) * scale, 12.5 * scale);
        ctx.stroke();

        pageVouchers.forEach((v, index) => {
          const name = getVoucherName(v);
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

          ctx.font = fontWifiName;
          const textWidth = ctx.measureText(wifiName).width;
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
          ctx.fillText(wifiName, textX, y + 4.2 * scale);

          ctx.fillStyle = '#000000';
          ctx.font = fontVoucherCode;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, x + cardWidth / 2, y + 10.5 * scale);

          ctx.fillStyle = '#444444';
          ctx.font = fontProfile;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + cardWidth / 2, y + 15.5 * scale);
        });

        if (pageIdx > 0) {
          doc.addPage();
        }
        const imgData = canvas.toDataURL('image/jpeg', 0.60);
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const pdfBlob = doc.output('blob');
      const safeWifiName = wifiName.replace(/[\s|/\\:*?"<>|]/g, '_');
      const safeLabel = label.replace(/[\s|/\\:*?"<>|]/g, '_');
      const cleanFileName = `${safeWifiName}_${safeLabel}_${count}_vouchers.pdf`;

      if (mode === 'share') {
        const file = new File([pdfBlob], cleanFileName, { type: 'application/pdf' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Vouchers - ${wifiName} - ${count} Vouchers - ${label}`,
            text: `Vouchers PDF for WiFi: ${wifiName} | Count: ${count} | Profile: ${label}`,
          });
        } else {
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = cleanFileName;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Downloaded PDF file for sharing.', 'success');
        }
      } else {
        // Direct Print Mode
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        printIframe.src = pdfUrl;
        document.body.appendChild(printIframe);

        printIframe.onload = () => {
          setTimeout(() => {
            try {
              printIframe.contentWindow?.focus();
              printIframe.contentWindow?.print();
            } catch (pErr) {
              window.open(pdfUrl, '_blank');
            }
            setTimeout(() => {
              if (printIframe.parentNode) document.body.removeChild(printIframe);
              URL.revokeObjectURL(pdfUrl);
            }, 2000);
          }, 300);
        };
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      document.title = `${wifiName} - ${profile} - Vouchers`;
      const restoreTitle = () => {
        document.title = originalTitle;
        window.removeEventListener('afterprint', restoreTitle);
      };
      window.addEventListener('afterprint', restoreTitle);
      setTimeout(() => {
        window.print();
      }, 150);
      setTimeout(restoreTitle, 5000);
    } finally {
      setPrintLoading(false);
    }
  };

  const handleShowAll = async (status: 'unused' | 'active' | 'expired') => {
    if (!routerId) return;
    try {
      setAllVouchersLoading(true);
      setShowAllModal(status);
      const result = await getAllVouchersByStatusAPI(
        routerId,
        profile,
        status,
        comment,
        printLabel,
        batchId
      );
      setAllVouchers(result.vouchers);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load vouchers.', 'error');
    } finally {
      setAllVouchersLoading(false);
    }
  };

  const copyPrintCodes = () => {
    if (!printCodes) return;
    navigator.clipboard.writeText(printCodes.join('\n'));
    showToast(`Copied ${printCodes.length} codes!`, 'success');
  };

  const copySingleCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const backToList = () => {
    navigate(`/${routerId}/batch`);
  };

  // ── Styles ──

  const cardGlassStyle: React.CSSProperties = {
    background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '10px',
    padding: '8px 10px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  };
  const cardStyle = cardGlassStyle;

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '10px',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px',
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    background: 'transparent',
    color: 'var(--foreground)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  // ── Pie / Donut Chart ──

  const COLORS = {
    unused: '#22c55e',
    active: '#3b82f6',
    expired: '#94a3b8',
  };

  const renderDonutChart = (unused: number, active: number, expired: number) => {
    const total = unused + active + expired;
    if (total === 0) return null;

    const segments = [
      { value: unused, color: COLORS.unused, label: 'Unused' },
      { value: active, color: COLORS.active, label: 'Active' },
      { value: expired, color: COLORS.expired, label: 'Expired' },
    ].filter((s) => s.value > 0);

    const size = 130;
    const strokeWidth = 28;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    let dashOffset = 0;

    const arcs = segments.map((seg) => {
      const pct = seg.value / total;
      const dashLength = pct * circumference;
      const offset = dashOffset;
      dashOffset -= dashLength;

      return { ...seg, pct, dashLength, offset };
    });

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease' }}
            />
          ))}
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '20px', fontWeight: 800, fill: 'var(--foreground)' }}
          >
            {total}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {segments.map((seg) => {
            const pct = Math.round((seg.value / total) * 100);
            return (
              <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '3px',
                    backgroundColor: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', minWidth: '50px' }}>
                  {seg.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {seg.value}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>
                  ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: Voucher Card ──

  const renderVoucherCard = (
    voucher: VoucherSummary | ActiveVoucher | ExpiredVoucher,
    status: 'unused' | 'active' | 'expired'
  ) => {
    const name = voucher.name || (voucher as any)['.id'] || '';
    const active = voucher as ActiveVoucher;

    // Profile Fallback metadata
    const vProfileName = (voucher as any).profile || profile || '';
    const pStats = getProfileStatsForBatch(vProfileName);

    // Bytes / Data limit & remaining
    const limitBytesNum = Number(((voucher as any).limitBytesTotal ?? (voucher as any)['limit-bytes-total']) || 0);
    const bIn = Number(((voucher as any).bytesIn ?? (voucher as any)['bytes-in']) || 0);
    const bOut = Number(((voucher as any).bytesOut ?? (voucher as any)['bytes-out']) || 0);
    const usedBytes = bIn + bOut;

    let dataLeftStr: string | null = null;
    let dataPct: number | null = null;

    if (status === 'unused') {
      dataLeftStr = null;
    } else {
      // Active or Expired
      const rawRemBytes = (voucher as any).remainingBytes ?? (voucher as any)['remaining-bytes'];
      if (rawRemBytes != null && rawRemBytes !== '') {
        const num = Number(rawRemBytes);
        if (!isNaN(num)) dataLeftStr = formatBytes(num);
        if (limitBytesNum > 0 && !isNaN(num)) {
          dataPct = Math.min(100, Math.max(0, (num / limitBytesNum) * 100));
        }
      }
      if (!dataLeftStr && limitBytesNum > 0) {
        const rem = Math.max(0, limitBytesNum - usedBytes);
        dataLeftStr = formatBytes(rem);
        dataPct = Math.min(100, Math.max(0, (rem / limitBytesNum) * 100));
      }
      if (!dataLeftStr && status === 'expired') {
        dataLeftStr = '0 MB';
      }
    }

    // Time / Uptime limit & remaining
    let timeLeftStr: string | null = null;
    let timePct: number | null = null;

    if (status === 'unused') {
      timeLeftStr = null;
    } else if (status === 'active') {
      timeLeftStr = active.timeLeftText || null;
      const remainingSec = (voucher as any).remainingSeconds != null ? Number((voucher as any).remainingSeconds) : null;
      const totalSec = (voucher as any).limitUptimeSeconds != null ? Number((voucher as any).limitUptimeSeconds) : null;

      if (!timeLeftStr && remainingSec != null) {
        if (!isNaN(remainingSec) && remainingSec >= 0) {
          const hrs = Math.floor(remainingSec / 3600);
          const mins = Math.floor((remainingSec % 3600) / 60);
          timeLeftStr = `${hrs}h ${mins}m`;
        }
      }
      if (remainingSec != null && totalSec != null && totalSec > 0) {
        timePct = Math.min(100, Math.max(0, (remainingSec / totalSec) * 100));
      }
    } else {
      // Expired
      timeLeftStr = '0s';
    }

    const rawDevName = (active.deviceName || (voucher as any).hostName || (voucher as any)['host-name'] || '').trim();
    let cleanDeviceName = '';
    if (rawDevName) {
      const lowerDev = rawDevName.toLowerCase();
      const lowerName = name.toLowerCase();
      if (
        lowerDev !== lowerName &&
        !lowerDev.includes('#metadata:') &&
        !lowerDev.includes('batch_') &&
        !lowerDev.includes('login:') &&
        !lowerDev.includes('exp:') &&
        lowerDev !== 'active client' &&
        lowerDev !== 'unnamed client'
      ) {
        cleanDeviceName = rawDevName;
      }
    }

    let loginDateStr: string | null = null;
    let loginDateFull: string | null = null;
    let loginDateRelative: string | null = null;
    if (status === 'active' || status === 'expired') {
      const rawComment = String((voucher as any).comment || (voucher as any).remarks || '');
      if (rawComment.includes('login:')) {
        const match = rawComment.match(/login:\s*([^\s,;]+(?:\s+[^\s,;]+)?)/i);
        if (match && match[1]) {
          loginDateStr = match[1];
        }
      }
      if (!loginDateStr) {
        loginDateStr = (voucher as any)['first-login'] || (voucher as any).loginDate || (voucher as any).firstLogin || (voucher as any).startTime || (voucher as any)['start-time'] || (active as any).loginTime || (active as any).startTime || null;
      }
      if (loginDateStr) {
        const { displayDate, fullDate, relativeSince } = formatLoginDateDisplay(loginDateStr);
        loginDateStr = displayDate;
        loginDateFull = fullDate;
        loginDateRelative = relativeSince;
      }
    }

    const cardBg =
      status === 'active'
        ? 'rgba(59, 130, 246, 0.08)'
        : status === 'expired'
        ? 'rgba(239, 68, 68, 0.08)'
        : 'var(--card-bg, rgba(15, 23, 42, 0.55))';

    const borderColor =
      status === 'active'
        ? 'rgba(59, 130, 246, 0.3)'
        : status === 'expired'
        ? 'rgba(239, 68, 68, 0.3)'
        : 'var(--glass-border, rgba(255, 255, 255, 0.12))';

    const hasMetadataPills = Boolean(timeLeftStr || dataLeftStr || loginDateStr || cleanDeviceName);

    return (
      <div
        key={name}
        style={{
          boxSizing: 'border-box',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
          background: cardBg,
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Main Row: Status, PIN, Copy button & Details action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {/* Status Pill Badge */}
            {(() => {
              const vDisabled = (voucher as any).isDisabled === true || (voucher as any).disabled === true || (voucher as any).disabled === 'true';
              const hasRemData = (() => {
                const lb = Number(((voucher as any).limitBytesTotal ?? (voucher as any)['limit-bytes-total']) || 0);
                const bi = Number(((voucher as any).bytesIn ?? (voucher as any)['bytes-in']) || 0);
                const bo = Number(((voucher as any).bytesOut ?? (voucher as any)['bytes-out']) || 0);
                const rb = (voucher as any).remainingBytes;
                if (rb != null && Number(rb) > 0) return true;
                if (lb > 0 && (lb - bi - bo) > 0) return true;
                return false;
              })();
              // If disabled but has remaining data, show as active (disabled), not expired
              const effectiveStatus = (status === 'expired' && vDisabled && hasRemData) ? 'active' : status;
              const statusColor = effectiveStatus === 'active' ? '#3b82f6' : effectiveStatus === 'expired' ? '#ef4444' : '#22c55e';
              const statusLabel = effectiveStatus === 'active'
                ? t('batch.statusActive') || 'نشط'
                : effectiveStatus === 'expired'
                ? t('batch.statusExpired') || 'منتهي'
                : t('batch.statusUnused') || 'غير مستخدم';
              return (
                <>
                  <span
                    className="item-badge"
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '0 6px',
                      borderRadius: '5px',
                      height: '20px',
                      minWidth: '65px',
                      justifyContent: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: statusColor,
                      border: '1px solid var(--glass-border)',
                      flexShrink: 0,
                    }}
                  >
                    {statusLabel}
                  </span>
                  {vDisabled && (
                    <span
                      className="item-badge"
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '0 5px',
                        borderRadius: '5px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(249, 115, 22, 0.12)',
                        color: '#f97316',
                        border: '1px solid rgba(249, 115, 22, 0.25)',
                        flexShrink: 0,
                      }}
                    >
                      Disabled
                    </span>
                  )}
                </>
              );
            })()}

            {/* PIN / Code */}
            <strong style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--foreground)', letterSpacing: '0.5px', flexShrink: 0 }}>
              {name}
            </strong>

            {/* Copy Button */}
            <button
              onClick={() => copySingleCode(name)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: copiedCode === name ? '#22c55e' : 'var(--text-muted)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              title={t('common.copy') || 'نسخ'}
            >
              {copiedCode === name ? <Check size={13} /> : <Copy size={13} />}
            </button>

            {/* Re-enable Button for Expired Voucher */}
            {status === 'expired' && (
              <button
                onClick={() => handleEnableVouchers([name])}
                disabled={isEnablingVouchers}
                title="تفعيل الكرت"
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  borderRadius: '5px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: isEnablingVouchers ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={11} />
                <span>تفعيل</span>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => {
              setInfoVoucher(voucher as any);
              setInfoStatus(status);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              cursor: 'pointer',
              padding: '4px 6px',
              color: 'var(--foreground)',
              borderRadius: '6px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={t('common.details') || 'التفاصيل'}
          >
            <Info size={14} />
          </button>
        </div>

        {/* Second Row: Single-line Metadata Pills for active / expired vouchers */}
        {hasMetadataPills && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              maxWidth: '100%',
              scrollbarWidth: 'none',
            }}
          >
            {/* Time Pill */}
            {timeLeftStr && (
              <span
                className="item-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '0 5px',
                  borderRadius: '5px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  color: '#38bdf8',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                <Clock size={10} style={{ flexShrink: 0 }} />
                <span>{timeLeftStr}</span>
                {timePct !== null && (
                  <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 600 }}>({Math.round(timePct)}%)</span>
                )}
              </span>
            )}

            {/* Data Pill */}
            {dataLeftStr && (
              <span
                className="item-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '0 5px',
                  borderRadius: '5px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  color: '#c084fc',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                <HardDrive size={10} style={{ flexShrink: 0 }} />
                <span>{dataLeftStr}</span>
                {dataPct !== null && (
                  <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 600 }}>({Math.round(dataPct)}%)</span>
                )}
              </span>
            )}

            {/* Login Date Badge */}
            {loginDateStr && (
              <span
                className="item-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '0 5px',
                  borderRadius: '5px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#f59e0b',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={loginDateFull ? `Login Date: ${loginDateFull}` : (t('vouchers.loginDate') || 'تاريخ الدخول')}
              >
                <Calendar size={10} style={{ flexShrink: 0 }} />
                <span>
                  {loginDateRelative || loginDateStr}
                </span>
              </span>
            )}

            {/* Device Name */}
            {cleanDeviceName && (
              <span
                className="item-badge"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#3b82f6',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '5px',
                  padding: '0 5px',
                  height: '20px',
                  maxWidth: '90px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={cleanDeviceName}
              >
                <Wifi size={10} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cleanDeviceName}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render: Voucher Info Modal ──

  // ── Render: Voucher Info Modal ──

  const renderInfoModal = () => {
    if (!infoVoucher) return null;

    const name = (infoVoucher as any).name || (infoVoucher as any)['.id'] || '';

    // Synchronize with latest data from batchDetail or searchResults if available
    let resolvedVoucher: any = { ...infoVoucher };
    let resolvedStatus: 'active' | 'expired' | 'unused' = infoStatus || 'unused';

    if (searchResults) {
      const sr = searchResults.find((x) => x.name === name || (x as any)['.id'] === name);
      if (sr) {
        resolvedVoucher = { ...resolvedVoucher, ...sr };
        resolvedStatus = sr.isExpired ? 'expired' : sr.isInUse ? 'active' : 'unused';
      }
    }

    if (batchDetail) {
      const act = batchDetail.activeVouchers?.find((x) => x.name === name || (x as any)['.id'] === name);
      if (act) {
        resolvedVoucher = { ...resolvedVoucher, ...act };
        resolvedStatus = 'active';
      } else {
        const exp = batchDetail.expiredVouchers?.find((x) => x.name === name || (x as any)['.id'] === name);
        if (exp) {
          resolvedVoucher = { ...resolvedVoucher, ...exp };
          resolvedStatus = 'expired';
        } else {
          const uns = batchDetail.unusedVouchers?.find((x) => x.name === name || (x as any)['.id'] === name);
          if (uns) {
            resolvedVoucher = { ...resolvedVoucher, ...uns };
            resolvedStatus = 'unused';
          }
        }
      }
    }

    const v = resolvedVoucher;
    const isOnline = v.isOnline === true;
    const isInUse = v.isInUse === true || resolvedStatus === 'active' || isOnline || v.loginDate || v.startDate;
    const isExpired = v.isExpired === true || resolvedStatus === 'expired';

    let statusDisplay = 'Unused';
    let statusColor = 'var(--success)';

    if (isExpired) {
      statusDisplay = 'Expired';
      statusColor = 'var(--text-muted)';
    } else if (isOnline) {
      statusDisplay = 'Active (Online)';
      statusColor = 'var(--accent)';
    } else if (isInUse) {
      statusDisplay = 'Active (Logged Out)';
      statusColor = '#f59e0b';
    }

    const rows: { label: string; value: React.ReactNode }[] = [
      { label: 'Code', value: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{name}</span> },
      { label: 'Status', value: <span style={{ fontWeight: 700, color: statusColor }}>{statusDisplay}</span> },
      { label: 'Profile', value: v.profile || profile || '—' },
    ];

    if (v.comment || comment) {
      rows.push({ label: 'Comment', value: v.comment || comment });
    }

    // Dates & Times
    const startDate = v.startDate;
    const startTime = v.startTime;
    const loginDate = v.loginDate || v.firstLogin || v.loginTime;
    const logoutDate = v.logoutDate || v.lastLogout || v.logoutTime;
    const expDate = v.expDate || v.expirationDate || v.expiredAt;

    if (startDate) rows.push({ label: 'Start Date', value: formatDate(startDate) });
    if (startTime) rows.push({ label: 'Start Time', value: startTime });
    if (loginDate) rows.push({ label: 'Login Date', value: formatDate(loginDate) });
    if (logoutDate) rows.push({ label: 'Logout Date', value: formatDate(logoutDate) });
    if (expDate) rows.push({ label: 'Expiry Date', value: formatDate(expDate) });

    // Time Left & Duration
    if (v.timeLeftText) {
      rows.push({ label: 'Time Left', value: v.timeLeftText });
    }

    if (v.remainingSeconds != null) {
      const remSec = Number(v.remainingSeconds);
      if (!isNaN(remSec) && remSec >= 0) {
        const hrs = Math.floor(remSec / 3600);
        const mins = Math.floor((remSec % 3600) / 60);
        const secs = remSec % 60;
        rows.push({ label: 'Remaining Time', value: `${hrs}h ${mins}m ${secs}s` });
      }
    }

    const limitBytes = v.limitBytesTotal ?? v['limit-bytes-total'];
    if (limitBytes != null && limitBytes !== '' && Number(limitBytes) > 0) {
      rows.push({ label: 'Data Limit', value: formatBytes(limitBytes) });
    }

    const remBytes = v.remainingBytes ?? v['remaining-bytes'];
    if (remBytes != null && remBytes !== '') {
      rows.push({ label: 'Remaining Data', value: formatBytes(remBytes) });
    }

    // Network / Device Details
    const device = v.deviceName || v.hostName;
    const ip = v.ipAddress || v.ip || v.address;
    const mac = v.mac || v.macAddress;
    const uptime = v.uptime || v.connUptime;
    const bytesIn = v.bytesIn ?? v['bytes-in'];
    const bytesOut = v.bytesOut ?? v['bytes-out'];
    const sessionId = v.sessionId ?? v['session-id'];

    if (device) rows.push({ label: 'Device', value: device });
    if (ip) rows.push({ label: 'IP Address', value: ip });
    if (mac) rows.push({ label: 'MAC Address', value: mac });
    if (uptime) rows.push({ label: 'Uptime', value: uptime });
    if (bytesIn != null && bytesIn !== '') rows.push({ label: 'Bytes In (Upload)', value: typeof bytesIn === 'number' ? formatBytes(bytesIn) : formatBytes(parseFloat(bytesIn)) !== '—' ? formatBytes(parseFloat(bytesIn)) : bytesIn });
    if (bytesOut != null && bytesOut !== '') rows.push({ label: 'Bytes Out (Download)', value: typeof bytesOut === 'number' ? formatBytes(bytesOut) : formatBytes(parseFloat(bytesOut)) !== '—' ? formatBytes(parseFloat(bytesOut)) : bytesOut });
    if (sessionId) rows.push({ label: 'Session ID', value: sessionId });

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={() => setInfoVoucher(null)}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            width: '90%',
            maxWidth: '440px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: statusColor }}>●</span>
              {name}
            </h3>
            <button
              onClick={() => setInfoVoucher(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '8px 4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', width: '1%' }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '8px 4px', fontSize: '13px', color: 'var(--foreground)', textAlign: 'right', wordBreak: 'break-all' }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => { copySingleCode(name); }} style={{ ...btnSecondary, flex: 1 }}>
              <Copy size={14} /> Copy Code
            </button>
            <button
              onClick={() => { setInfoVoucher(null); }}
              style={{ ...btnPrimary, flex: 1 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Print Confirmation Modal ──

  const renderPrintConfirmModal = () => {
    if (!showPrintConfirmModal) return null;

    const countToPrint = batchDetail?.unusedCount ?? (batchDetail?.unusedVouchers?.length || 0);

    const rows: { label: string; value: React.ReactNode }[] = [
      {
        label: t('batch.printedWifiName'),
        value: (
          <input
            type="text"
            value={wifiInput !== null ? wifiInput : defaultWifiName}
            onChange={(e) => setWifiInput(e.target.value)}
            placeholder={defaultWifiName}
            style={{
              width: '100%',
              maxWidth: '200px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1.5px solid var(--primary)',
              background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
              color: 'var(--foreground)',
              fontSize: '12px',
              fontWeight: 700,
              textAlign: isRtl ? 'left' : 'right',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ),
      },
      { label: t('batch.profileName'), value: profile },
      { label: t('batch.batchInfoComment'), value: comment || '—' },
      { label: t('batch.createdAt') || (isRtl ? 'تاريخ الإنشاء' : 'Created At'), value: batchDetail?.createdAt ? formatDate(batchDetail.createdAt) : formatBatchTime(comment) },
      { label: t('batch.unusedVouchersToPrint'), value: <span style={{ fontWeight: 800, color: 'var(--success)' }}>{countToPrint}</span> },
      { label: t('batch.totalBatchSize'), value: batchDetail?.originalCount ?? '—' },
    ];

    return (
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
        onClick={() => setShowPrintConfirmModal(false)}
      >
        <div
          style={{
            ...cardStyle,
            width: '100%',
            maxWidth: '440px',
            background: 'var(--card-bg)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(var(--primary-rgb), 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Printer size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                  {t('batch.printConfirmTitle')}
                </h3>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('batch.printConfirmDesc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPrintConfirmModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Details Table */}
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                    <td style={{ padding: '8px 0', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', width: '50%', textAlign: isRtl ? 'right' : 'left' }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '8px 0', fontSize: '13px', color: 'var(--foreground)', textAlign: isRtl ? 'left' : 'right' }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowPrintConfirmModal(false)}
              style={{ ...btnSecondary, padding: '10px 14px', fontSize: '13px', justifyContent: 'center' }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                setShowPrintConfirmModal(false);
                await handlePrintVouchers('print');
              }}
              disabled={printLoading}
              style={{
                ...btnPrimary,
                flex: 1,
                padding: '10px 14px',
                fontSize: '13px',
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Printer size={16} />
              <span>{printLoading ? '...' : (t('batch.directPrint') || 'Print Directly')}</span>
            </button>
            <button
              onClick={async () => {
                setShowPrintConfirmModal(false);
                await handlePrintVouchers('share');
              }}
              disabled={printLoading}
              style={{
                ...btnPrimary,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                flex: 1,
                padding: '10px 14px',
                fontSize: '13px',
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Share2 size={16} />
              <span>{printLoading ? '...' : (t('batch.directShare') || 'Share PDF')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeleteBatchModal = () => {
    if (!showDeleteBatchModal) return null;

    const totalVouchersCount = batchDetail?.originalCount ?? 0;

    return (
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
        onClick={() => !deleteBatchLoading && setShowDeleteBatchModal(false)}
      >
        <div
          style={{
            ...cardStyle,
            width: '100%',
            maxWidth: '440px',
            background: 'var(--card-bg)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              flexShrink: 0,
            }}>
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                {t('batch.deleteBatchConfirmTitle')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {profile} {comment ? `(${comment})` : ''}
              </p>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: 'var(--foreground)', lineHeight: 1.5 }}>
            {t('batch.deleteBatchConfirmDesc').replace('{count}', String(totalVouchersCount))}
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={() => setShowDeleteBatchModal(false)}
              disabled={deleteBatchLoading}
              style={btnSecondary}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDeleteBatch}
              disabled={deleteBatchLoading}
              style={{
                ...btnPrimary,
                background: '#ef4444',
                borderColor: '#ef4444',
              }}
            >
              <Trash2 size={15} />
              <span>{deleteBatchLoading ? t('batch.deletingBatch') : t('batch.deleteBatch')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Detail View ──

  const renderDetailView = () => {
    const detail: VoucherBatchDetail | undefined = batchDetail;
    const isEmpty = detail
      ? detail.unusedCount + detail.activeCount + detail.expiredCount === 0
      : true;

    const unusedVouchers = detail?.unusedVouchers || [];
    const activeVouchers = sortByLoginDate(detail?.activeVouchers || []);
    const expiredVouchers = sortByLoginDate(detail?.expiredVouchers || []);

    const getVisibleVouchers = () => {
      if (searchResults) return { search: searchResults };
      if (statusFilter === 'unused') return { unused: unusedVouchers };
      if (statusFilter === 'active') return { active: activeVouchers };
      if (statusFilter === 'expired') return { expired: expiredVouchers };
      return { unused: unusedVouchers, active: activeVouchers, expired: expiredVouchers };
    };

    const visible = getVisibleVouchers();
    const hasSearch = !!searchResults;

    return (
      <div
        className="responsive-container"
        style={{
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        {/* Page Header Card */}
        <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <button
            onClick={backToList}
            className="page-header-btn"
            style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
            title={t('batch.backToBatches')}
          >
            {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <div
            className="page-header-icon"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.4) 100%)',
              color: '#6366f1',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            <Printer size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="page-header-title">
              {profile}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span className="hide-sm-only" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 5px',
                borderRadius: '5px',
                fontSize: '10px',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                <Wifi size={10} />
                {wifiName}
              </span>
              {(detail?.createdAt || comment) && (
                <span className="hide-sm-only" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 5px',
                  borderRadius: '5px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  <Clock size={10} />
                  {detail?.createdAt ? formatDate(detail.createdAt) : formatBatchTime(comment)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions: Refresh, Print & Delete Batch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || detailLoading}
            title={t('common.refresh') || 'تحديث'}
            className="page-header-btn"
          >
            <RefreshCw size={14} className={isRefreshing || detailLoading ? 'animate-spin' : ''} />
            <span className="hide-sm-only">{t('common.refresh') || 'تحديث'}</span>
          </button>

            <button
              onClick={() => {
                if (wifiInput === null) setWifiInput(defaultWifiName);
                setShowPrintConfirmModal(true);
              }}
              disabled={printLoading}
              style={{
                background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: printLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <Printer size={14} />
              <span>{printLoading ? '...' : t('batch.printBtn')}</span>
            </button>

            <button
              onClick={() => setShowDeleteBatchModal(true)}
              disabled={deleteBatchLoading || printLoading}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: (deleteBatchLoading || printLoading) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              title={t('batch.deleteBatch')}
            >
              <Trash2 size={14} />
              <span>{t('common.delete') || 'حذف'}</span>
            </button>
          </div>
        </div>

        {/* Summary Statistics Cards Grid */}
        {detail && (
          <div className="batch-stat-grid">
            {/* TOTAL Card */}
            <div
              className="batch-stat-card"
              onClick={() => setStatusFilter('all')}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                border: statusFilter === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--glass-border)',
                background: statusFilter === 'all' ? 'rgba(255, 255, 255, 0.12)' : cardStyle.background,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                className="batch-stat-card-icon"
                style={{
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}
              >
                <Layers size={13} />
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="batch-stat-card-label" style={{ fontSize: '10px', color: statusFilter === 'all' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('batch.totalVouchers')}
                </span>
                <strong className="batch-stat-card-val" style={{ fontSize: '13px', color: statusFilter === 'all' ? 'var(--primary)' : 'var(--foreground)' }}>
                  {detail.originalCount}
                </strong>
              </div>
            </div>

            {/* UNUSED Card */}
            <div
              className="batch-stat-card"
              onClick={() => setStatusFilter(statusFilter === 'unused' ? 'all' : 'unused')}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                border: statusFilter === 'unused' ? '1.5px solid #22c55e' : '1px solid var(--glass-border)',
                background: statusFilter === 'unused' ? 'rgba(255, 255, 255, 0.12)' : cardStyle.background,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                className="batch-stat-card-icon"
                style={{
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22c55e',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={13} />
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="batch-stat-card-label" style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('batch.unusedVouchers')}
                </span>
                <strong className="batch-stat-card-val" style={{ fontSize: '13px', color: '#22c55e' }}>
                  {detail.unusedCount}
                </strong>
              </div>
            </div>

            {/* ACTIVE Card */}
            <div
              className="batch-stat-card"
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                border: statusFilter === 'active' ? '1.5px solid #3b82f6' : '1px solid var(--glass-border)',
                background: statusFilter === 'active' ? 'rgba(255, 255, 255, 0.12)' : cardStyle.background,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                className="batch-stat-card-icon"
                style={{
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6',
                  flexShrink: 0,
                }}
              >
                <Zap size={13} />
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="batch-stat-card-label" style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('batch.activeVouchers')}
                </span>
                <strong className="batch-stat-card-val" style={{ fontSize: '13px', color: '#3b82f6' }}>
                  {detail.activeCount}
                </strong>
              </div>
            </div>

            {/* EXPIRED Card */}
            <div
              className="batch-stat-card"
              onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                border: statusFilter === 'expired' ? '1.5px solid #ef4444' : '1px solid var(--glass-border)',
                background: statusFilter === 'expired' ? 'rgba(255, 255, 255, 0.12)' : cardStyle.background,
                transition: 'all 0.15s ease',
              }}
            >
              <div
                className="batch-stat-card-icon"
                style={{
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <Clock size={13} />
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="batch-stat-card-label" style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t('batch.expiredVouchers')}
                </span>
                <strong className="batch-stat-card-val" style={{ fontSize: '13px', color: '#ef4444' }}>
                  {detail.expiredCount}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar & Search Toolbar Card */}
        <div
          className="responsive-card"
          style={{
            ...cardStyle,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {detail && detail.originalCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span>{t('batch.distribution') || 'التوزيع'}</span>
                <span style={{ fontSize: '10px' }}>
                  {Math.round((detail.unusedCount / detail.originalCount) * 100)}% {t('batch.statusUnused') || 'Unused'} • {Math.round((detail.activeCount / detail.originalCount) * 100)}% {t('batch.statusActive') || 'Active'} • {Math.round((detail.expiredCount / detail.originalCount) * 100)}% {t('batch.statusExpired') || 'Expired'}
                </span>
              </div>
              <div
                style={{
                  height: '6px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  width: '100%',
                }}
              >
                <div style={{ width: `${(detail.unusedCount / detail.originalCount) * 100}%`, background: '#22c55e', height: '100%' }} title={`Unused: ${detail.unusedCount}`} />
                <div style={{ width: `${(detail.activeCount / detail.originalCount) * 100}%`, background: '#3b82f6', height: '100%' }} title={`Active: ${detail.activeCount}`} />
                <div style={{ width: `${(detail.expiredCount / detail.originalCount) * 100}%`, background: 'rgba(255, 255, 255, 0.25)', height: '100%' }} title={`Expired: ${detail.expiredCount}`} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: isRtl ? 'auto' : '12px',
                  right: isRtl ? '12px' : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value) setSearchResults(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('batch.searchVouchersPlaceholder')}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: isRtl ? '8px 34px 8px 12px' : '8px 12px 8px 34px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            {searchQuery.trim() && (
              <button
                onClick={handleSearch}
                style={{ ...btnPrimary, padding: '8px 14px', borderRadius: '10px', fontSize: '12px' }}
                disabled={searchLoading}
              >
                {searchLoading ? '...' : t('common.search')}
              </button>
            )}

            {searchResults && (
              <button
                onClick={() => {
                  setSearchResults(null);
                  setSearchQuery('');
                }}
                style={{ ...btnSecondary, padding: '8px 12px', borderRadius: '10px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {detailLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div className="skeleton" style={{ width: '70%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '40%', height: '10px' }} />
                </div>
                <div className="skeleton" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : isEmpty && !hasSearch ? (
          <p style={{ color: 'var(--text-muted)' }}>{t('batch.noVouchersInBatch') || 'لا توجد كروت في هذه الدفعة.'}</p>
        ) : hasSearch ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {searchResults!.length} {t('common.results') || 'نتيجة'}
            </p>
            {searchResults!.map((v) =>
              renderVoucherCard(
                v,
                v.isExpired ? 'expired' : v.isInUse ? 'active' : 'unused'
              )
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visible.unused && visible.unused.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t('batch.unusedVouchers') || 'الكروت غير المستخدمة'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      ({detail?.unusedCount || visible.unused.length})
                    </span>
                  </div>
                  {(statusFilter === 'unused' || visible.unused.length > 5) && (
                    <button
                      onClick={() => handleShowAll('unused')}
                      style={{ ...btnSecondary, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      {t('batch.showAll') || 'عرض الكل'} {visible.unused.length > 5 ? `(${visible.unused.length})` : ''}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {visible.unused.slice(0, 5).map((v) => renderVoucherCard(v, 'unused'))}
                </div>
              </div>
            )}

            {visible.active && visible.active.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t('batch.activeVouchers') || 'الكروت النشطة'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      ({detail?.activeCount || visible.active.length})
                    </span>
                  </div>
                  {statusFilter === 'active' && (
                    <button
                      onClick={() => handleShowAll('active')}
                      style={{ ...btnSecondary, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      {t('batch.showAll') || 'عرض الكل'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {visible.active.slice(0, 50).map((v) => renderVoucherCard(v, 'active'))}
                </div>
              </div>
            )}

            {visible.expired && visible.expired.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t('batch.expiredVouchers') || 'الكروت المنتهية'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      ({detail?.expiredCount || visible.expired.length})
                    </span>
                  </div>
                  {statusFilter === 'expired' && (
                    <button
                      onClick={() => handleShowAll('expired')}
                      style={{ ...btnSecondary, fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}
                    >
                      {t('batch.showAll') || 'عرض الكل'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {visible.expired.slice(0, 50).map((v) => renderVoucherCard(v, 'expired'))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render: Show All Modal ──

  const renderShowAllModal = () => {
    if (!showAllModal) return null;

    const statusLabel =
      showAllModal === 'unused'
        ? t('batch.statusUnused')
        : showAllModal === 'active'
        ? t('batch.statusActive')
        : t('batch.statusExpired');
    const statusColor =
      showAllModal === 'unused' ? 'var(--success)' : showAllModal === 'active' ? 'var(--accent)' : 'var(--text-muted)';

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
        onClick={() => { setShowAllModal(null); setAllVouchers(null); }}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: statusColor }}>{statusLabel} ({t('batch.totalVouchers')})</h3>
            <button
              onClick={() => { setShowAllModal(null); setAllVouchers(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allVouchersLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
            ) : allVouchers && allVouchers.length > 0 ? (
              allVouchers.map((v) => {
                const name = v.name || (v as any)['.id'] || '';
                return (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'rgba(var(--primary-rgb), 0.04)',
                      borderRadius: '10px',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', flex: 1 }}>{name}</span>
                    <button
                      onClick={() => copySingleCode(name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: copiedCode === name ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {copiedCode === name ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        setInfoVoucher(v as any);
                        setInfoStatus(showAllModal);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)',
                      }}
                      title="View details"
                    >
                      <Info size={14} />
                    </button>
                    <button
                      onClick={() => {
                        confirmDeleteSingle(name, () => {
                          setAllVouchers((prev) => prev?.filter((x) => (x.name || (x as any)['.id']) !== name) || null);
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No {showAllModal} vouchers found.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Print Modal ──

  const renderPrintModal = () => {
    if (!showPrintModal || !printCodes) return null;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={() => { setShowPrintModal(false); setPrintCodes(null); }}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Print / Export Codes</h3>
            <button
              onClick={() => { setShowPrintModal(false); setPrintCodes(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
            {printCodes.length} voucher codes ready for printing.
          </p>

          <div
            className="custom-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'rgba(var(--primary-rgb), 0.05)',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--foreground)',
              maxHeight: '300px',
              marginBottom: '12px',
            }}
          >
            {printCodes.join('\n')}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyPrintCodes} style={{ ...btnPrimary, flex: 1 }}>
              <Copy size={16} />
              Copy All
            </button>
            <button
              onClick={() => { setShowPrintModal(false); setPrintCodes(null); }}
              style={{ ...btnSecondary, flex: 1 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Redirect if missing params ──

  if (!profile) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: 'var(--text-muted)' }}>
          Invalid batch link.{' '}
          <button onClick={backToList} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            Go back to batches
          </button>
        </p>
      </div>
    );
  }

  // ── Main Render ──

  const printStyles = `
  @page {
    size: A4;
    margin: 0 !important;
  }
  @media print {
    .no-print,
    header,
    .app-header,
    .mobile-telemetry-bar,
    aside,
    nav,
    footer,
    button,
    input,
    select,
    textarea,
    .modal-overlay,
    .layout-content-wrapper > header,
    .desktop-sidebar-wrapper,
    .mobile-nav {
      display: none !important;
      height: 0 !important;
      width: 0 !important;
      opacity: 0 !important;
      visibility: hidden !important;
      overflow: hidden !important;
    }
    
    html, body {
      width: 210mm !important;
      height: 297mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      overflow: visible !important;
    }
    
    .layout-container,
    .layout-content-wrapper,
    .layout-main,
    .layout-page-inner,
    .layout-page-content {
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      position: static !important;
      transform: none !important;
      overflow: visible !important;
    }
    
    .print-container { 
      display: block !important; 
      width: 210mm !important; 
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      z-index: 99999 !important;
    }
    
    .a4-page {
      width: 210mm !important;
      height: 296mm !important;
      page-break-after: always !important;
      break-after: page !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 4mm 4mm !important;
      box-sizing: border-box !important;
      background: white !important;
      overflow: hidden !important;
    }

    .print-page-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      width: 100% !important;
      height: 6mm !important;
      border-bottom: 1px dashed #555 !important;
      margin-bottom: 1.5mm !important;
      padding-bottom: 0.5mm !important;
      box-sizing: border-box !important;
    }

    .print-header-left, .print-header-right {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
      color: #333 !important;
      font-size: 8.5px !important;
      line-height: 1 !important;
    }

    .print-header-left {
      font-weight: 700 !important;
    }

    .print-header-right {
      font-weight: 600 !important;
    }

    .vouchers-grid {
      display: grid !important;
      grid-template-columns: repeat(7, 1fr) !important;
      grid-template-rows: repeat(14, 1fr) !important;
      row-gap: 0.8mm !important;
      column-gap: 1.2mm !important;
      height: calc(100% - 8mm) !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    
    .print-voucher { 
      border: 1px solid #555 !important; 
      border-radius: 5px !important;
      padding: 2px !important; 
      text-align: center !important; 
      background-color: #fff !important;
      color: #000 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: space-around !important;
      height: 100% !important;
      box-sizing: border-box !important;
    }
    
    .voucher-wifi, .voucher-code, .voucher-profile {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
    }
    
    .voucher-wifi {
      font-size: 9px !important;
      font-weight: 700 !important;
      color: #000 !important;
      line-height: 1.1 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      width: 100% !important;
      margin: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 2px !important;
      direction: rtl !important;
    }
    
    .voucher-wifi-icon {
      width: 8.5px !important;
      height: 8.5px !important;
      stroke: #000 !important;
    }
    
    .voucher-code {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
      font-size: 14px !important;
      font-weight: 800 !important;
      letter-spacing: 0.1px !important;
      color: #000 !important;
      line-height: 1.1 !important;
      padding: 0 !important;
      margin: 0 !important;
      direction: ltr !important;
    }
    
    .voucher-profile {
      font-size: 9px !important;
      color: #000 !important;
      font-weight: 600 !important;
      line-height: 1.1 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      width: 100% !important;
      margin: 0 !important;
      direction: rtl !important;
    }
  }
  `;

  const vouchersToPrintList = printableVouchers.length > 0 ? printableVouchers : (batchDetail?.unusedVouchers || []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="no-print">
        {/* Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 300,
              padding: '12px 20px',
              borderRadius: '10px',
              background: toast.type === 'success' ? 'var(--success)' : '#ef4444',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}
          >
            {toast.message}
          </div>
        )}

        {/* Info Modal */}
        {renderInfoModal()}

        {/* Show All Modal */}
        {renderShowAllModal()}

        {/* Print Confirmation Modal */}
        {renderPrintConfirmModal()}

        {/* Delete Batch Confirmation Modal */}
        {renderDeleteBatchModal()}

        {/* Print Modal */}
        {renderPrintModal()}

        {/* Content */}
        {renderDetailView()}
      </div>

      {/* Print Container for window.print() */}
      <div className="print-container" style={{ display: 'none' }}>
        {chunkArray(vouchersToPrintList, 98).map((pageVouchers: any[], pageIdx: number) => {
          const batchName = comment ? formatBatchTime(comment) : profile;
          const totalUnused = vouchersToPrintList.length;
          return (
            <div key={pageIdx} className="a4-page">
              <div className="print-page-header">
                <span className="print-header-left">
                  Print Header: {wifiName} | Profile: {profile} | Batch: {batchName}
                </span>
                <span className="print-header-right">
                  Total Vouchers: {totalUnused} | Printed: {printDate}
                </span>
              </div>
              <div className="vouchers-grid">
                {pageVouchers.map((u: any) => {
                  const name = getVoucherName(u);
                  return (
                    <div key={name} className="print-voucher">
                      <div className="voucher-wifi">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="8.5"
                          height="8.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="voucher-wifi-icon"
                        >
                          <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                          <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                          <line x1="12" y1="20" x2="12.01" y2="20"></line>
                        </svg>
                        <span>{wifiName}</span>
                      </div>
                      <div className="voucher-code">{name}</div>
                      <div className="voucher-profile">{profile}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}