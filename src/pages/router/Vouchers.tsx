import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import {
  fetchVoucherBatchesAPI,
  fetchVoucherBatchDetailAPI,
  createVouchersAPI,
  fetchVoucherJobStatusAPI,
  deleteVouchersAPI,
  fetchProfilesAPI,
  fetchRouterProfilesWithUserAPI,
  revalidateRouterCache,
  getVoucherCodesAPI,
  type VoucherBatch,
  type VoucherBatchDetail,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import {
  Plus,
  Layers,
  Ticket,
  CheckCircle2,
  Zap,
  Clock,
  HardDrive,
  Calendar,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Filter,
  Printer,
  RefreshCw,
  X,
  Search,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Tag,
  KeyRound,
  FolderOpen,
  AlertCircle,
  ExternalLink,
  FileText,
  Percent,
  Share2,
  Download,
  Loader2,
} from 'lucide-react';

interface Profile {
  id: string;
  name?: string;
  validity?: string;
  limitMB?: number;
  isUnlimited?: boolean;
  price?: number | string;
  revenue?: number | string;
  'rate-limit'?: string;
  'limit-bytes-total'?: string;
  comment?: string;
  'on-login'?: string;
}

// ── Helpers ──

const formatBatchAge = (batchId?: string, comment?: string, createdAt?: string, isRtl = false): string => {
  let ts: number | null = null;

  if (createdAt) {
    const parsed = Date.parse(createdAt);
    if (!isNaN(parsed)) ts = parsed;
  }

  if (!ts) {
    const combined = (batchId || '') + ' ' + (comment || '');
    const matchBatch = combined.match(/(?:batch|b)_(\d{10,13})/i);
    if (matchBatch) {
      const rawNum = parseInt(matchBatch[1], 10);
      ts = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
    }
  }

  if (!ts && comment) {
    const matchTs = comment.match(/\b(\d{10,13})\b/);
    if (matchTs) {
      const rawNum = parseInt(matchTs[1], 10);
      ts = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
    }
  }

  if (!ts && comment) {
    const isoMatch = comment.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const parsed = Date.parse(`${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`);
      if (!isNaN(parsed)) ts = parsed;
    }

    if (!ts) {
      const dmyMatch = comment.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
      if (dmyMatch) {
        const parsed = Date.parse(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
        if (!isNaN(parsed)) ts = parsed;
      }
    }
  }

  if (!ts) return '';

  const diffMs = Date.now() - ts;
  if (diffMs < 0) return '';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return isRtl ? 'الآن' : 'just now';
  if (diffMin < 60) return isRtl ? `منذ ${diffMin} د` : `${diffMin}m ago`;

  const h = Math.floor(diffMin / 60);
  if (h < 24) return isRtl ? `منذ ${h} س` : `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d < 30) return isRtl ? `منذ ${d} يوم` : `${d}d ago`;

  const mo = Math.floor(d / 30);
  if (mo < 12) return isRtl ? `منذ ${mo} شهر` : `${mo}mo ago`;

  const y = Math.floor(d / 365);
  return isRtl ? `منذ ${y} سنة` : `${y}y ago`;
};

const getCleanComment = (comment?: string): string => {
  if (!comment) return '';
  const parts = comment.split(' | ').filter((p) => {
    const u = p.trim().toUpperCase();
    return (
      !u.startsWith('BATCH') &&
      !u.startsWith('PRINT_LABEL') &&
      !u.startsWith('BATCH_ID') &&
      !u.startsWith('DATE') &&
      !u.startsWith('CREATED') &&
      !/^\d{10,13}$/.test(p.trim()) &&
      !/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(p.trim()) &&
      !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(p.trim())
    );
  });
  return parts.join(' | ').trim();
};

const formatBytes = (bytesVal?: string | number): string => {
  if (!bytesVal && bytesVal !== 0) return '0 B';
  const bytes = typeof bytesVal === 'number' ? bytesVal : parseInt(String(bytesVal), 10);
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
};

const getProfileInfoDetails = (pName: string, profilesList: Profile[]) => {
  if (!pName) return { price: null, validity: null, dataLimit: null, rateLimit: null, validityBadge: '', dataBadge: '', statsSummary: '' };

  const target = pName.toString().trim().toLowerCase();
  const p = profilesList.find((prof) => {
    const name = (prof.name || prof.id || (prof as any)['.id'] || '').toString().trim().toLowerCase();
    return name === target;
  });

  let price: string | null = null;
  let validity: string | null = null;
  let dataLimit: string | null = null;
  let rateLimit: string | null = null;

  // 1. Price / Revenue
  if (p) {
    if (p.revenue !== undefined && p.revenue !== null && p.revenue !== '') {
      price = String(p.revenue);
    } else if (p.price !== undefined && p.price !== null && p.price !== '') {
      price = String(p.price);
    }
  }

  // 2. Validity Extraction
  if (p?.validity) {
    const isUnlVal = p.validity === '0d' || p.validity === '0' || p.validity === '0h' || p.validity === '0m' || p.validity === '0s' || p.validity?.toLowerCase() === 'unlimited';
    validity = isUnlVal ? 'Unlimited' : p.validity;
  }

  if (!validity && (p as any)?.['session-timeout']) {
    const timeoutStr = String((p as any)['session-timeout']).trim().toLowerCase();
    const isUnlTimeout = timeoutStr === '00:00:00' || timeoutStr === '0' || timeoutStr === '0s' || timeoutStr === '0d';
    if (isUnlTimeout) {
      validity = 'Unlimited';
    } else {
      const matchTimeout = timeoutStr.match(/^(\d+\s*[dhmwDHMW])/);
      if (matchTimeout) {
        validity = matchTimeout[1];
      }
    }
  }

  const scriptText = ((p?.['on-login'] || (p as any)?.onlogin || p?.comment || '') as string).toLowerCase();

  if (!validity && scriptText) {
    const matchScriptVal = scriptText.match(/(?:validity|rem|time)\s*[:=]?\s*["']?(\d+\s*[dhmw])["']?/i);
    if (matchScriptVal) {
      const valStr = matchScriptVal[1];
      const isUnlScriptVal = valStr.toLowerCase() === '0d' || valStr === '0h' || valStr === '0m' || valStr === '0s' || valStr === '0';
      validity = isUnlScriptVal ? 'Unlimited' : valStr;
    }
  }

  if (!validity) {
    const nameToTest = `${pName} ${p?.name || ''}`;
    const valMatch = nameToTest.match(/\b(\d+\s*[dhmwDHMW])\b/);
    if (valMatch) {
      const matchedVal = valMatch[1];
      const isUnlValName = matchedVal.toLowerCase() === '0d' || matchedVal.toLowerCase() === '0h' || matchedVal.toLowerCase() === '0m';
      validity = isUnlValName ? 'Unlimited' : matchedVal.toUpperCase();
    }
  }

  // 3. Data Limit Extraction
  if (p?.limitMB !== undefined && p?.limitMB !== null) {
    if (p.limitMB === 0) {
      dataLimit = 'Unlimited';
    } else {
      dataLimit = p.limitMB >= 1024 ? `${(p.limitMB / 1024).toFixed(1).replace(/\.0$/, '')} GB` : `${p.limitMB} MB`;
    }
  } else if (p?.['limit-bytes-total'] !== undefined && p?.['limit-bytes-total'] !== null) {
    const b = parseInt(String(p['limit-bytes-total']), 10);
    if (!isNaN(b)) {
      if (b === 0) {
        dataLimit = 'Unlimited';
      } else if (b >= 1073741824) {
        dataLimit = `${(b / 1073741824).toFixed(1).replace(/\.0$/, '')} GB`;
      } else {
        dataLimit = `${(b / 1048576).toFixed(0)} MB`;
      }
    }
  }

  if (!dataLimit && scriptText) {
    const matchScriptData = scriptText.match(/(?:limitmb|limit|data|bytes)\s*[:=]?\s*["']?(\d+(?:\.\d+)?)\s*(mb|gb|m|g)?["']?/i);
    if (matchScriptData) {
      const num = parseFloat(matchScriptData[1]);
      const unit = (matchScriptData[2] || 'm').toUpperCase();
      if (num === 0) {
        dataLimit = 'Unlimited';
      } else if (unit.startsWith('G')) {
        dataLimit = `${num} GB`;
      } else {
        dataLimit = num >= 1024 ? `${(num / 1024).toFixed(1).replace(/\.0$/, '')} GB` : `${num} MB`;
      }
    }
  }

  if (!dataLimit) {
    const nameToTest = `${pName} ${p?.name || ''}`;
    const dataMatch = nameToTest.match(/\b(\d+(?:\.\d+)?)\s*(MB|GB|mb|gb|M|G)\b/i);
    if (dataMatch) {
      const num = parseFloat(dataMatch[1]);
      const unit = dataMatch[2].toUpperCase();
      if (num === 0) {
        dataLimit = 'Unlimited';
      } else if (unit === 'GB' || unit === 'G') {
        dataLimit = `${num} GB`;
      } else {
        dataLimit = num >= 1024 ? `${(num / 1024).toFixed(1).replace(/\.0$/, '')} GB` : `${num} MB`;
      }
    }
  }

  if (!dataLimit && p?.isUnlimited) {
    dataLimit = 'Unlimited';
  }

  // 4. Rate Limit
  if (p?.['rate-limit']) {
    rateLimit = String(p['rate-limit']);
  }

  // 5. Sanitize & Build Badges with Infinity sign '∞'
  const isUnlTime = !validity || validity === 'Unlimited' || validity.toLowerCase() === '0d' || validity === '0' || validity.toLowerCase() === '0h' || validity.toLowerCase() === '0m';
  const validityBadge = isUnlTime ? '∞' : (validity?.toUpperCase() || '∞');

  const isUnlData = !dataLimit || dataLimit === 'Unlimited' || dataLimit.toUpperCase() === '0 MB' || dataLimit.toUpperCase() === '0MB' || dataLimit === '0' || dataLimit === '0 B' || p?.isUnlimited;
  const dataBadge = isUnlData ? '∞' : (dataLimit?.toUpperCase() || '∞');

  const statsSummary = `${validityBadge} · ${dataBadge}`;

  return { price, validity, dataLimit, rateLimit, validityBadge, dataBadge, statsSummary };
};

export default function VouchersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const { showConfirm } = useModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local Controls State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Drawer (Create Batch) State
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState<boolean>(false);
  const [createProfile, setCreateProfile] = useState<string>('');
  const [countInput, setCountInput] = useState<string>('100');
  const [length, setLength] = useState<number>(6);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [jobProgress, setJobProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Batch Detail Modal State
  const [selectedBatchModal, setSelectedBatchModal] = useState<VoucherBatch | null>(null);
  const [detailTab, setDetailTab] = useState<'all' | 'unused' | 'active' | 'expired'>('all');
  const [detailSearch, setDetailSearch] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printWifiName, setPrintWifiName] = useState<string>('MikMan Wi-Fi');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const count = useMemo(() => {
    const parsed = parseInt(countInput, 10);
    if (isNaN(parsed) || parsed < 1) return 1;
    if (parsed > 5000) return 5000;
    return parsed;
  }, [countInput]);

  // Fetch Batches
  const {
    data: batches,
    isLoading: batchesLoading,
    mutate: mutateBatches,
  } = useSWR(
    routerId ? `batch-list-${routerId}` : null,
    () => fetchVoucherBatchesAPI(routerId!),
    { revalidateOnFocus: true, refreshInterval: 15000, dedupingInterval: 3000 }
  );
  const batchList: VoucherBatch[] = Array.isArray(batches) ? batches : [];

  // Fetch Profiles
  const { data: profilesData } = useSWR(
    routerId ? `voucher-profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const profileList: Profile[] = useMemo(() => {
    if (Array.isArray(profilesData)) return profilesData;
    if (profilesData && typeof profilesData === 'object') {
      if (Array.isArray((profilesData as any).profiles)) return (profilesData as any).profiles;
      if (Array.isArray((profilesData as any).data)) return (profilesData as any).data;
    }
    return [];
  }, [profilesData]);

  // Auto select initial profile in drawer
  useEffect(() => {
    if (profileList.length > 0 && !createProfile) {
      setCreateProfile(profileList[0].name || profileList[0].id);
    }
  }, [profileList, createProfile]);

  // Fetch Router Status / Wifi Name for Print default
  const { data: routerProfilesData } = useSWR(
    'router-profiles-with-user',
    fetchRouterProfilesWithUserAPI,
    { revalidateOnFocus: false }
  );

  const activeRouter: any = useMemo(() => {
    if (!routerProfilesData?.profiles || !routerId) return null;
    return routerProfilesData.profiles.find(
      (r: any) => String(r.id) === String(routerId) || r.name === routerId
    );
  }, [routerProfilesData, routerId]);

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

  const handleOpenPrintModal = () => {
    const batchLabel = selectedBatchModal?.printLabel?.trim();
    const isProfileName = batchLabel && (batchLabel === selectedBatchModal?.profile || batchLabel === activeRouter?.name);
    const savedName =
      activeRouter?.cardPrintLabel?.trim() ||
      activeRouter?.hotspotWifiName?.trim() ||
      activeRouter?.wifiName?.trim() ||
      activeRouter?.wifiSsid?.trim() ||
      (!isProfileName ? batchLabel : '') ||
      '';
    if (savedName) {
      setPrintWifiName(savedName);
    }
    setIsPrintModalOpen(true);
  };

  // Handle URL Param Deep-linking for Batch Detail
  const paramProfile = searchParams.get('profile');
  const paramBatchId = searchParams.get('batchId');
  const paramComment = searchParams.get('comment');
  const paramPrintLabel = searchParams.get('printLabel');

  useEffect(() => {
    if (paramProfile && !selectedBatchModal) {
      const found = batchList.find(
        (b) =>
          b.profile === paramProfile &&
          (!paramBatchId || b.batchId === paramBatchId)
      );
      if (found) {
        setSelectedBatchModal(found);
      } else {
        setSelectedBatchModal({
          profile: paramProfile,
          batchId: paramBatchId || undefined,
          comment: paramComment || '',
          printLabel: paramPrintLabel || '',
          originalCount: 0,
          unusedCount: 0,
          activeCount: 0,
          expiredCount: 0,
        });
      }
    }
  }, [paramProfile, paramBatchId, paramComment, paramPrintLabel, batchList, selectedBatchModal]);

  // Fetch Batch Detail Modal Data
  const {
    data: batchDetail,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR(
    routerId && selectedBatchModal?.profile
      ? `batch-detail-${routerId}-${selectedBatchModal.profile}-${selectedBatchModal.batchId || ''}-${selectedBatchModal.comment || ''}`
      : null,
    () =>
      fetchVoucherBatchDetailAPI(
        routerId!,
        selectedBatchModal!.profile,
        selectedBatchModal!.comment,
        selectedBatchModal!.printLabel,
        selectedBatchModal!.batchId
      ),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      dedupingInterval: 60000,
    }
  );

  // Handle Manual Refresh
  const handleManualRefresh = async () => {
    if (!routerId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      revalidateRouterCache(routerId);
      await mutateBatches();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Toast helper
  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Statistics ──
  const stats = useMemo(() => {
    let totalVouchers = 0;
    let totalUnused = 0;
    let totalActive = 0;
    let totalExpired = 0;

    batchList.forEach((b) => {
      totalVouchers += b.originalCount || 0;
      totalUnused += b.unusedCount || 0;
      totalActive += b.activeCount || 0;
      totalExpired += b.expiredCount || 0;
    });

    return {
      totalBatches: batchList.length,
      totalVouchers,
      totalUnused,
      totalActive,
      totalExpired,
    };
  }, [batchList]);

  // Filtered Batches List
  const filteredBatches = useMemo(() => {
    return batchList.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = (b.printLabel || '').toLowerCase().includes(q);
        const matchesComment = (b.comment || '').toLowerCase().includes(q);
        const matchesProfile = (b.profile || '').toLowerCase().includes(q);
        const matchesId = (b.batchId || '').toLowerCase().includes(q);
        if (!matchesLabel && !matchesComment && !matchesProfile && !matchesId) return false;
      }
      return true;
    });
  }, [batchList, searchQuery]);

  // Grouped Batches by Profile
  const groupedProfileBatches = useMemo(() => {
    const map = new Map<string, { profile: string; batches: VoucherBatch[] }>();
    filteredBatches.forEach((b) => {
      const pKey = b.profile || 'Default';
      let group = map.get(pKey);
      if (!group) {
        group = { profile: pKey, batches: [] };
        map.set(pKey, group);
      }
      group.batches.push(b);
    });
    return Array.from(map.values());
  }, [filteredBatches]);

  // Handle Form Submit for Batch Creation in Drawer
  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId || !createProfile) {
      setErrorMsg(t('vouchers.selectProfileFirst') || 'Please select a profile first.');
      return;
    }

    if (count > 5000) {
      setErrorMsg(t('vouchers.maxLimitError') || 'Maximum voucher count limit is 5000 cards per batch.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setJobProgress(null);

    try {
      const res = await createVouchersAPI(
        routerId,
        createProfile,
        count,
        length,
        comment.trim() || undefined
      );

      if (res?.jobId) {
        setSuccessMsg(t('vouchers.pushingToRouter') || (isRtl ? 'جاري كتابة الكروت في الراوتر...' : 'Pushing vouchers to router...'));
        setJobProgress(5);
        let done = false;
        let attempts = 0;
        while (!done && attempts < 120) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          attempts++;
          try {
            const job = await fetchVoucherJobStatusAPI(routerId, res.jobId);
            if (job.progress !== undefined) {
              setJobProgress(job.progress);
            }
            if (job.status === 'completed') {
              done = true;
            } else if (job.status === 'failed') {
              throw new Error(job.error || 'Voucher generation failed on router');
            }
          } catch (pollErr: any) {
            if (attempts > 5) done = true;
          }
        }
      }

      setSuccessMsg(
        t('vouchers.doneGenerated')
          .replace('{count}', String(count))
          .replace('{profile}', createProfile)
      );
      setJobProgress(100);

      revalidateRouterCache(routerId);
      await mutateBatches();

      setTimeout(() => {
        setIsCreateDrawerOpen(false);
        setIsSubmitting(false);
        setJobProgress(null);
        setSuccessMsg(null);

        // Open newly created batch detail modal
        const newBatch: VoucherBatch = {
          profile: createProfile,
          batchId: res?.batchId,
          comment: comment.trim(),
          printLabel: comment.trim() || createProfile,
          originalCount: count,
          unusedCount: count,
          activeCount: 0,
          expiredCount: 0,
        };
        setSelectedBatchModal(newBatch);
      }, 500);
    } catch (err: any) {
      console.error('Failed to generate batch vouchers:', err);
      setErrorMsg(err?.message || t('vouchers.couldNotGenerate'));
      setIsSubmitting(false);
      setJobProgress(null);
    }
  };

  // Handle Delete Voucher Single
  const handleDeleteSingleVoucher = async (code: string) => {
    if (!routerId) return;
    showConfirm(
      t('common.delete') || 'Delete',
      (t('batch.deleteSingleConfirm') || 'Are you sure you want to delete voucher card "{code}"?').replace('{code}', code),
      async () => {
        try {
          await deleteVouchersAPI(routerId, [code]);
          showToast(`Deleted voucher ${code}`, 'success');
          revalidateRouterCache(routerId);
          mutateDetail();
        } catch (err: any) {
          showToast(err?.message || 'Failed to delete voucher', 'error');
        }
      }
    );
  };

  // Handle Delete Entire Batch
  const handleDeleteEntireBatch = async () => {
    if (!routerId || !selectedBatchModal) return;
    showConfirm(
      t('common.delete') || 'Delete Batch',
      t('batch.deleteBatchConfirm') || 'Are you sure you want to delete all vouchers in this batch?',
      async () => {
        try {
          setIsDeletingBatch(true);
          const res = await getVoucherCodesAPI(
            routerId,
            selectedBatchModal.profile,
            selectedBatchModal.comment,
            selectedBatchModal.printLabel,
            'all',
            selectedBatchModal.batchId
          );
          const codes = res?.codes || [];
          if (codes.length === 0) {
            showToast(t('batch.noVouchersInBatch') || 'No vouchers found to delete', 'error');
            return;
          }
          await deleteVouchersAPI(routerId, codes);
          showToast(t('batch.batchDeletedSuccess') || 'Batch deleted successfully', 'success');
          setSelectedBatchModal(null);
          setSearchParams({});
          revalidateRouterCache(routerId);
          mutateBatches();
        } catch (err: any) {
          showToast(err?.message || 'Failed to delete batch', 'error');
        } finally {
          setIsDeletingBatch(false);
        }
      }
    );
  };

  // Copy Code to Clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate PDF Printer Export (Supports Download & Share Modes)
  const handleDownloadPDF = async (mode: 'download' | 'share' = 'download') => {
    if (!routerId || !selectedBatchModal) return;
    setIsGeneratingPdf(true);
    try {
      const res = await getVoucherCodesAPI(
        routerId,
        selectedBatchModal.profile,
        selectedBatchModal.comment,
        selectedBatchModal.printLabel,
        'all',
        selectedBatchModal.batchId
      );
      const codes = res?.codes || [];
      if (codes.length === 0) {
        showToast('No voucher codes found to print', 'error');
        return;
      }

      const activeRouter: any = routerProfilesData?.profiles?.find(
        (r: any) => String(r.id) === String(routerId) || r.name === routerId
      );
      const savedDbName =
        activeRouter?.cardPrintLabel ||
        activeRouter?.hotspotWifiName ||
        activeRouter?.wifiName ||
        activeRouter?.wifiSsid;

      const networkName = printWifiName.trim() || savedDbName || selectedBatchModal.printLabel || 'Wi-Fi Hotspot';
      const profileName = selectedBatchModal.profile;

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
        ctx.fillText(`WiFi: ${networkName} | Profile: ${profileName} | Vouchers: ${codes.length}`, 8.6 * scale, 9.5 * scale);

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
          setIsPrintModalOpen(false);
          showToast('PDF shared successfully!', 'success');
          return;
        }
      }

      doc.save(fileName);
      setIsPrintModalOpen(false);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      showToast('Failed to generate PDF document.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filtering Voucher Details inside Modal
  const modalFilteredVouchers = useMemo(() => {
    if (!batchDetail) return [];
    let list: (VoucherSummary | ActiveVoucher | ExpiredVoucher)[] = [];

    if (detailTab === 'unused') list = batchDetail.unusedVouchers || [];
    else if (detailTab === 'active') list = batchDetail.activeVouchers || [];
    else if (detailTab === 'expired') list = batchDetail.expiredVouchers || [];
    else {
      list = [
        ...(batchDetail.unusedVouchers || []),
        ...(batchDetail.activeVouchers || []),
        ...(batchDetail.expiredVouchers || []),
      ];
    }

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(q) || (v.comment || '').toLowerCase().includes(q));
    }

    return list;
  }, [batchDetail, detailTab, detailSearch]);

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className="responsive-container"
      style={{
        direction: isRtl ? 'rtl' : 'ltr',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '16px',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            [isRtl ? 'left' : 'right']: '24px',
            zIndex: 10000,
            background: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '13px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toastMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ─── 1. Header Bar ─── */}
      <div
        className="responsive-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: '12px',
          marginBottom: '20px',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.4) 100%)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59,130,246,0.3)',
              flexShrink: 0,
            }}
          >
            <Ticket size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--foreground)',
                letterSpacing: '-0.3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {t('vouchers.title') || 'الكروت والدفعات'}
            </h2>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: '12px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {t('vouchers.subtitle') || 'إدارة وتوليد كروت الهوتسبوت'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || batchesLoading}
            title={t('common.refresh') || 'تحديث'}
            style={{
              background: 'var(--card-bg, rgba(0, 0, 0, 0.2))',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--foreground)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRefreshing || batchesLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || batchesLoading ? 'animate-spin' : ''} />
            <span style={{ whiteSpace: 'nowrap' }}>{t('common.refresh') || 'تحديث'}</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setIsCreateDrawerOpen(true);
            }}
            style={{
              background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
            }}
          >
            <Plus size={15} />
            <span style={{ whiteSpace: 'nowrap' }}>{t('batch.createBatch') || 'إنشاء دفعة'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Summary Statistics Cards (4 Cards Grid: 2 cols on mobile) ─── */}
      <div className="stat-summary-grid">
        {/* Total Batches Card */}
        <div className="responsive-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Layers size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, display: 'block' }}>
              {t('batch.totalBatches') || 'إجمالي الدفعات'}
            </span>
            <strong style={{ fontSize: '18px', color: 'var(--foreground)', fontWeight: 800 }}>
              {stats.totalBatches}
            </strong>
          </div>
        </div>

        {/* Total Vouchers Card */}
        <div className="responsive-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(14, 165, 233, 0.12)',
              color: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ticket size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, display: 'block' }}>
              {t('batch.totalVouchers') || 'إجمالي الكروت'}
            </span>
            <strong style={{ fontSize: '18px', color: 'var(--foreground)', fontWeight: 800 }}>
              {stats.totalVouchers}
            </strong>
          </div>
        </div>

        {/* Unused Vouchers Card */}
        <div className="responsive-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, display: 'block' }}>
              {t('batch.unusedVouchers') || 'غير مستخدمة'}
            </span>
            <strong style={{ fontSize: '18px', color: '#22c55e', fontWeight: 800 }}>
              {stats.totalUnused}
            </strong>
          </div>
        </div>

        {/* Active Vouchers Card */}
        <div className="responsive-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, display: 'block' }}>
              {t('batch.activeVouchers') || 'نشطة'}
            </span>
            <strong style={{ fontSize: '18px', color: '#3b82f6', fontWeight: 800 }}>
              {stats.totalActive}
            </strong>
          </div>
        </div>
      </div>

      {/* ─── 3. Search Control Bar ─── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              [isRtl ? 'right' : 'left']: '12px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('batch.searchPlaceholder') || 'البحث باسم الدفعة أو البروفايل...'}
            style={{
              width: '100%',
              background: 'var(--card-bg, rgba(0, 0, 0, 0.2))',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '10px',
              padding: `8px ${isRtl ? '34px' : '12px'} 8px ${isRtl ? '12px' : '34px'}`,
              color: 'var(--foreground)',
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ─── 4. Main Batches List Grouped by Profile ─── */}
      {batchesLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="responsive-card" style={{ height: '72px', opacity: 0.6 }}>
              <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
            </div>
          ))}
        </div>
      ) : filteredBatches.length === 0 ? (
        <div
          className="responsive-card"
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <Ticket size={36} style={{ color: 'var(--text-muted)' }} />
          <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--foreground)' }}>
            {t('batch.noBatchesFound') || 'لا توجد دفعات كروت'}
          </h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('batch.noBatchesDesc') || 'قم بإنشاء دفعتك الأولى لبدء طباعة الكروت وإدارتها.'}
          </p>
          <button
            onClick={() => setIsCreateDrawerOpen(true)}
            style={{
              marginTop: '8px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'var(--primary, #3b82f6)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            + {t('batch.createBatch') || 'إنشاء دفعة كروت'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {groupedProfileBatches.map((pGroup) => {
            const pInfo = getProfileInfoDetails(pGroup.profile, profileList);
            return (
              <div
                key={pGroup.profile}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'var(--card-bg, rgba(255, 255, 255, 0.04))',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
                }}
              >
                {/* Profile Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.06))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderOpen size={16} style={{ color: '#3b82f6' }} />
                    <strong style={{ fontSize: '14px', color: 'var(--foreground)' }}>
                      {pGroup.profile}
                    </strong>
                  </div>

                  {/* Profile Metadata Pills Stack */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Time / Validity Badge */}
                    {pInfo.validityBadge && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '5px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          letterSpacing: '0.3px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Clock size={10} style={{ opacity: 0.8 }} />
                        {pInfo.validityBadge}
                      </span>
                    )}
                    {/* Data Limit Badge */}
                    {pInfo.dataBadge && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '5px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          letterSpacing: '0.3px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <HardDrive size={10} style={{ opacity: 0.8 }} />
                        {pInfo.dataBadge}
                      </span>
                    )}
                    {pInfo.price && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '5px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: '#eab308',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ${pInfo.price}
                      </span>
                    )}
                    {pInfo.rateLimit && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '5px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pInfo.rateLimit}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '5px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pGroup.batches.length} {pGroup.batches.length === 1 ? 'دفعة' : 'دفعات'}
                    </span>
                  </div>
                </div>

                {/* Batch Cards Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {pGroup.batches.map((batch, bIdx) => {
                    const ageStr = formatBatchAge(batch.batchId, batch.comment, batch.createdAt, isRtl);
                    const cleanComm = getCleanComment(batch.comment);

                    return (
                      <div
                        key={batch.batchId || bIdx}
                        className="responsive-card"
                        onClick={() => setSelectedBatchModal(batch)}
                        style={{
                          padding: '14px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                          border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                          borderRadius: '14px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary, #3b82f6)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--glass-border, rgba(255, 255, 255, 0.1))';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        {/* Top Badges Stack & Arrow */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', flex: 1 }}>
                            {/* Total Pill */}
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '5px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--foreground)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {batch.originalCount} {t('batch.totalVouchers') || 'إجمالي'}
                            </span>

                            {/* Unused Pill */}
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '5px',
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#22c55e',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {batch.unusedCount} {t('batch.statusUnused') || 'غير مستخدم'}
                            </span>

                            {/* Active Pill */}
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '5px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#3b82f6',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {batch.activeCount} {t('batch.statusActive') || 'نشط'}
                            </span>

                            {/* Expired Pill */}
                            {batch.expiredCount > 0 && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  color: 'var(--text-muted)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {batch.expiredCount} {t('batch.statusExpired') || 'منتهي'}
                              </span>
                            )}
                          </div>

                          <ChevronIcon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </div>

                        {/* Bottom Metadata (Age + Clean Comment) */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          <span>{ageStr || (isRtl ? 'بدون تاريخ' : 'No date')}</span>
                          {cleanComm && (
                            <>
                              <span>•</span>
                              <span
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: 'var(--foreground)',
                                  fontWeight: 500,
                                }}
                              >
                                {cleanComm}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 5. Slide-Over Drawer: Create Voucher Batch ─── */}
      {isCreateDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: isRtl ? 'flex-start' : 'flex-end',
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => {
            if (!isSubmitting) setIsCreateDrawerOpen(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              height: '100%',
              background: 'var(--card-bg, #0f172a)',
              borderLeft: isRtl ? 'none' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              borderRight: isRtl ? '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))' : 'none',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
              direction: isRtl ? 'rtl' : 'ltr',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
                    {t('vouchers.generateBatchTitle') || 'إنشاء دفعة كروت جديدة'}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {t('vouchers.generateBatchSubtitle') || 'توليد كروت جديدة بكميات'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsCreateDrawerOpen(false)}
                disabled={isSubmitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content Form */}
            <form
              onSubmit={handleGenerateBatch}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {errorMsg && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: '#f87171',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div
                  style={{
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: '#4ade80',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 1. Profile Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('vouchers.profileLabel') || 'البروفايل (باقة الكروت)'}
                </label>

                {/* Profile Select Chips Bar */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto' }}>
                  {profileList.map((p) => {
                    const pName = p.name || p.id;
                    const isSelected = createProfile === pName;
                    const pInfo = getProfileInfoDetails(pName, profileList);
                    const badgeText = (pInfo.statsSummary || p.validity || '').toUpperCase();
                    return (
                      <button
                        key={pName}
                        type="button"
                        onClick={() => setCreateProfile(pName)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: isSelected
                            ? '1px solid var(--primary, #3b82f6)'
                            : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                          background: isSelected
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                          color: isSelected ? '#3b82f6' : 'var(--foreground)',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Layers size={13} />
                        <span>{pName}</span>
                        {pInfo.validityBadge && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                              border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              color: isSelected ? '#60a5fa' : 'var(--foreground)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <Clock size={9} />
                            {pInfo.validityBadge}
                          </span>
                        )}
                        {pInfo.dataBadge && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: isSelected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                              border: isSelected ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              color: isSelected ? '#34d399' : 'var(--foreground)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <HardDrive size={9} />
                            {pInfo.dataBadge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Voucher Quantity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('vouchers.quantityLabel') || 'عدد الكروت المطلوبة'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Ticket
                    size={16}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      [isRtl ? 'right' : 'left']: '12px',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={countInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setCountInput(val);
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                      border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
                      borderRadius: '10px',
                      padding: `10px ${isRtl ? '36px' : '12px'} 10px ${isRtl ? '12px' : '36px'}`,
                      color: 'var(--foreground)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Quantity Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[100, 500, 1000, 2000].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setCountInput(String(q))}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                        background: count === q ? 'var(--primary, #3b82f6)' : 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                        color: count === q ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Code Length */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('vouchers.lengthLabel') || 'طول كود الـ PIN'}
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound
                    size={16}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      [isRtl ? 'right' : 'left']: '12px',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="number"
                    min={3}
                    max={16}
                    value={length}
                    onChange={(e) => setLength(Math.max(3, Math.min(16, parseInt(e.target.value) || 6)))}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                      border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
                      borderRadius: '10px',
                      padding: `10px ${isRtl ? '36px' : '12px'} 10px ${isRtl ? '12px' : '36px'}`,
                      color: 'var(--foreground)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Length Presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[4, 5, 6, 7, 8].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLength(l)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                        background: length === l ? 'var(--primary, #3b82f6)' : 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                        color: length === l ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {l} {t('vouchers.digits') || 'أرقام'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Batch Name / Print Comment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t('vouchers.batchNameLabel') || 'اسم الدفعة / ملاحظة الطباعة (اختياري)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Tag
                    size={16}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      [isRtl ? 'right' : 'left']: '12px',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('vouchers.batchNamePlaceholder') || 'مثال: عروض الصيف، شبكة ضيوف...'}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                      border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.12))',
                      borderRadius: '10px',
                      padding: `10px ${isRtl ? '36px' : '12px'} 10px ${isRtl ? '12px' : '36px'}`,
                      color: 'var(--foreground)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Live Ticket Replica Card Preview */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t('vouchers.printLayoutNotice') || 'شكل الكرت في ورقة الطباعة A4'}
                </span>

                {/* 7x14 Ticket Mockup */}
                <div
                  style={{
                    width: '180px',
                    height: '80px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '1px solid #444444',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#000', textAlign: 'center' }}>
                    {comment.trim() || 'MikMan Wi-Fi'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#000', fontFamily: 'monospace' }}>
                    {'9'.repeat(Math.ceil(length / 2)) + '4'.repeat(Math.floor(length / 2))}
                  </div>
                  <div style={{ fontSize: '10px', color: '#444', textAlign: 'center' }}>
                    {createProfile || 'Profile'}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !createProfile}
                style={{
                  marginTop: 'auto',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '14px',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>
                      {jobProgress !== null ? `${t('vouchers.generating')} ${jobProgress}%` : t('vouchers.generating')}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>{t('vouchers.generateBtn') || 'إنشاء الكروت الآن'}</span>
                  </>
                )}
              </button>

              {jobProgress !== null && (
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    marginTop: '-8px',
                  }}
                >
                  <div
                    style={{
                      width: `${jobProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6 0%, #22c55e 100%)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ─── 6. Batch Detail Modal Overlay ─── */}
      {selectedBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '16px',
          }}
          onClick={() => {
            setSelectedBatchModal(null);
            setSearchParams({});
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              background: 'var(--card-bg, #0f172a)',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              direction: isRtl ? 'rtl' : 'ltr',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Layers size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                    {selectedBatchModal.printLabel || selectedBatchModal.profile}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {t('batch.profileLabel')}: <strong>{selectedBatchModal.profile}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedBatchModal(null);
                  setSearchParams({});
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Action Bar (Print PDF / Delete Batch) */}
            <div
              style={{
                padding: '12px 20px',
                background: 'var(--secondary, rgba(255, 255, 255, 0.04))',
                borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <button
                onClick={handleOpenPrintModal}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Printer size={14} />
                <span>{t('batch.print') || 'طباعة PDF'}</span>
              </button>

              <button
                onClick={handleDeleteEntireBatch}
                disabled={isDeletingBatch}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: isDeletingBatch ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={14} />
                <span>{isDeletingBatch ? 'جاري الحذف...' : t('batch.deleteBatch') || 'حذف الدفعة'}</span>
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div
              style={{
                display: 'flex',
                padding: '10px 20px 0 20px',
                gap: '6px',
                borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
              }}
            >
              {[
                { key: 'all', label: `الكل (${selectedBatchModal.originalCount})` },
                { key: 'unused', label: `غير مستخدمة (${selectedBatchModal.unusedCount})`, color: '#22c55e' },
                { key: 'active', label: `نشطة (${selectedBatchModal.activeCount})`, color: '#3b82f6' },
                { key: 'expired', label: `منتهية (${selectedBatchModal.expiredCount})`, color: '#eab308' },
              ].map((tab) => {
                const isActive = detailTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key as any)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? tab.color || 'var(--foreground)' : 'var(--text-muted)',
                      border: 'none',
                      borderBottom: isActive
                        ? `2px solid ${tab.color || 'var(--primary, #3b82f6)'}`
                        : '2px solid transparent',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input Box */}
            <div style={{ padding: '12px 20px 4px 20px' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    [isRtl ? 'right' : 'left']: '10px',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="البحث في كروت هذه الدفعة..."
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, rgba(30, 41, 59, 0.5))',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                    borderRadius: '8px',
                    padding: `6px ${isRtl ? '30px' : '10px'} 6px ${isRtl ? '10px' : '30px'}`,
                    color: 'var(--foreground)',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Scrollable Vouchers Grid List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px 20px' }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  <span>جاري تحميل كروت الدفعة...</span>
                </div>
              ) : modalFilteredVouchers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  لا توجد كروت مطابقة للفلاتر الحالية.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {modalFilteredVouchers.map((vItem) => {
                    const isCopied = copiedCode === vItem.name;
                    const vAny = vItem as any;
                    const vName = vItem.name || vAny['.id'] || '';

                    // Determine Voucher Status
                    const isAct = Boolean(vAny.timeLeftText || vAny.bytesIn || vAny.address || (batchDetail?.activeVouchers || []).some(av => av.name === vName));
                    const isExp = Boolean(vAny.isExpired || vAny.expireDate || (batchDetail?.expiredVouchers || []).some(ev => ev.name === vName));
                    const vStatus: 'unused' | 'active' | 'expired' = isAct ? 'active' : isExp ? 'expired' : 'unused';

                    // Profile Fallback metadata
                    const vProf = vItem.profile || selectedBatchModal?.profile || '';
                    const pInfo = getProfileInfoDetails(vProf, profileList);

                    // 1. Data Remaining / Limit Calculation
                    const limitBytesNum = Number(vAny.limitBytesTotal ?? vAny['limit-bytes-total'] ?? 0);
                    const bIn = Number(vAny.bytesIn ?? vAny['bytes-in'] ?? 0);
                    const bOut = Number(vAny.bytesOut ?? vAny['bytes-out'] ?? 0);
                    const usedBytes = bIn + bOut;

                    let dataLeftStr: string | null = null;
                    let dataPct: number | null = null;

                    if (vStatus === 'unused') {
                      if (limitBytesNum > 0) {
                        dataLeftStr = formatBytes(limitBytesNum);
                      } else if (pInfo.dataLimit) {
                        dataLeftStr = pInfo.dataLimit;
                      } else {
                        dataLeftStr = t('profiles.unlimited') || 'غير محدود';
                      }
                    } else if (vStatus === 'active') {
                      const rawRemBytes = vAny.remainingBytes ?? vAny['remaining-bytes'];
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
                      if (!dataLeftStr && pInfo.dataLimit) {
                        dataLeftStr = pInfo.dataLimit;
                      } else if (!dataLeftStr) {
                        dataLeftStr = t('profiles.unlimited') || 'غير محدود';
                      }
                    } else {
                      dataLeftStr = '0 MB';
                    }

                    // 2. Time Remaining / Limit Calculation
                    let timeLeftStr: string | null = null;
                    let timePct: number | null = null;

                    if (vStatus === 'unused') {
                      const vLimitUptime = vAny['limit-uptime'] || vAny.limitUptime;
                      if (vLimitUptime) {
                        timeLeftStr = String(vLimitUptime);
                      } else if (pInfo.validity) {
                        timeLeftStr = pInfo.validity;
                      } else {
                        timeLeftStr = '—';
                      }
                    } else if (vStatus === 'active') {
                      timeLeftStr = vAny.timeLeftText || null;
                      const remainingSec = vAny.remainingSeconds != null ? Number(vAny.remainingSeconds) : null;
                      const totalSec = vAny.limitUptimeSeconds != null ? Number(vAny.limitUptimeSeconds) : null;

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
                      if (!timeLeftStr && pInfo.validity) {
                        timeLeftStr = pInfo.validity;
                      }
                    } else {
                      timeLeftStr = '0s';
                    }

                    // 3. Login Date / Activation Date
                    const loginDateStr = vAny['first-login'] || vAny.loginDate || vAny.firstLogin || vAny.startTime || vAny.uptime || null;

                    // 4. Device Name
                    const rawDevName = (vAny.deviceName || vAny.hostName || vAny['host-name'] || '').trim();
                    let cleanDeviceName = '';
                    if (rawDevName) {
                      const lowerDev = rawDevName.toLowerCase();
                      const lowerName = vName.toLowerCase();
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

                    // Uniform Theme Colors for clean look
                    const cardBg = 'var(--card-bg)';
                    const borderColor = 'var(--glass-border)';

                    return (
                      <div
                        key={vAny['.id'] || vName}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: cardBg,
                          border: `1px solid ${borderColor}`,
                          borderRadius: '12px',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          backdropFilter: 'blur(8px)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                        }}
                      >
                        {/* Header: Voucher Code + Copy + Delete + Status Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                            <strong
                              style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                color: 'var(--foreground)',
                                letterSpacing: '0.5px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {vName}
                            </strong>

                            {cleanDeviceName && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: '#3b82f6',
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                  borderRadius: '6px',
                                  padding: '1px 5px',
                                  maxWidth: '90px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={cleanDeviceName}
                              >
                                {cleanDeviceName}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {/* Status Badge */}
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '5px',
                                background:
                                  vStatus === 'active'
                                    ? 'rgba(59, 130, 246, 0.18)'
                                    : vStatus === 'expired'
                                    ? 'rgba(239, 68, 68, 0.18)'
                                    : 'rgba(34, 197, 94, 0.18)',
                                color:
                                  vStatus === 'active'
                                    ? '#3b82f6'
                                    : vStatus === 'expired'
                                    ? '#ef4444'
                                    : '#22c55e',
                                border:
                                  vStatus === 'active'
                                    ? '1px solid rgba(59, 130, 246, 0.3)'
                                    : vStatus === 'expired'
                                    ? '1px solid rgba(239, 68, 68, 0.3)'
                                    : '1px solid rgba(34, 197, 94, 0.3)',
                              }}
                            >
                              {vStatus === 'active'
                                ? t('batch.statusActive') || 'نشط'
                                : vStatus === 'expired'
                                ? t('batch.statusExpired') || 'منتهي'
                                : t('batch.statusUnused') || 'غير مستخدم'}
                            </span>

                            <button
                              onClick={() => handleCopyCode(vName)}
                              title={t('common.copy') || 'نسخ الكود'}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isCopied ? '#22c55e' : 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                              }}
                            >
                              {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Metrics Row: Data & Time Remaining */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {dataLeftStr && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(34, 197, 94, 0.12)',
                                border: '1px solid rgba(34, 197, 94, 0.25)',
                                borderRadius: '6px',
                                padding: '2px 6px',
                                color: '#22c55e',
                                fontWeight: 700,
                                fontSize: '10px',
                              }}
                            >
                              <HardDrive size={11} style={{ flexShrink: 0 }} />
                              <span>{dataLeftStr}</span>
                              {dataPct !== null && (
                                <span style={{ fontSize: '9px', opacity: 0.8 }}>({Math.round(dataPct)}%)</span>
                              )}
                            </div>
                          )}

                          {timeLeftStr && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: '6px',
                                padding: '2px 6px',
                                color: '#3b82f6',
                                fontWeight: 700,
                                fontSize: '10px',
                              }}
                            >
                              <Clock size={11} style={{ flexShrink: 0 }} />
                              <span>{timeLeftStr}</span>
                              {timePct !== null && (
                                <span style={{ fontSize: '9px', opacity: 0.8 }}>({Math.round(timePct)}%)</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Login Date / Activation Footer */}
                        {loginDateStr && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                            }}
                          >
                            <Calendar size={11} style={{ color: 'var(--text-muted)' }} />
                            <span>{t('vouchers.loginDate') || 'تاريخ الدخول'}: </span>
                            <strong style={{ color: 'var(--foreground)', fontWeight: 600 }}>{loginDateStr}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. Print PDF Config Modal ─── */}
      {isPrintModalOpen && selectedBatchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '16px',
          }}
          onClick={() => setIsPrintModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--card-bg, #0f172a)',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              direction: isRtl ? 'rtl' : 'ltr',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={18} style={{ color: '#3b82f6' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
                  إعدادات طباعة الدفعة
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Print Quantity Summary Banner */}
            {(() => {
              const filter = (selectedBatchModal as any).printFilter || 'unused';
              const cardCount = filter === 'all'
                ? (selectedBatchModal.originalCount || 0)
                : (selectedBatchModal.unusedCount ?? selectedBatchModal.originalCount ?? 0);
              const pageCount = Math.ceil(cardCount / 98) || (cardCount > 0 ? 1 : 0);

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#3b82f6',
                  }}
                >
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
              );
            })()}

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
                  background: 'var(--input-bg, rgba(30, 41, 59, 0.5))',
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
              <div
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '2px dashed var(--primary, #3b82f6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
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
                  {printWifiName.trim() || selectedBatchModal.printLabel || 'Wi-Fi Hotspot'}
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
                  {selectedBatchModal.profile}
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
      )}
    </div>
  );
}