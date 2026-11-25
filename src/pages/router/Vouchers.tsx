import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchVoucherBatchesAPI,
  fetchProfilesAPI,
  fetchRouterProfilesWithUserAPI,
  fetchVoucherBatchDetailAPI,
  createVouchersAPI,
  fetchVoucherJobStatusAPI,
  getVoucherCodesAPI,
  deleteVouchersAPI,
  revalidateRouterCache,
  type VoucherBatch,
  type VoucherBatchDetail,
} from '../../api';
import { type Profile } from '../../components/profiles/types';
import { useLanguage } from '../../context/LanguageContext';
import {
  Plus,
  Layers,
  Ticket,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Search,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import './Vouchers.css';
import { formatRelativeAge } from '../../components/vouchers/voucherHelpers';
import { CreateBatchDrawer, type CreateBatchPayload } from '../../components/vouchers/CreateBatchDrawer';
import { BatchDetailModal } from '../../components/vouchers/BatchDetailModal';
import { BatchRing } from '../../components/vouchers/BatchRing';

export type IdentifiedVoucherBatch = VoucherBatch & { _uid?: string };

export default function VouchersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local Controls State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals & Drawer State
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState<boolean>(false);
  const [selectedBatchModal, setSelectedBatchModal] = useState<IdentifiedVoucherBatch | null>(null);

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
  const batchList: IdentifiedVoucherBatch[] = useMemo(() => {
    if (!Array.isArray(batches)) return [];
    return batches.map((b, idx) => ({
      ...b,
      _uid: b.batchId || `${b.profile}_${b.createdAt || ''}_${b.comment || ''}_${b.originalCount}_${idx}`,
    }));
  }, [batches]);

  // Fetch Profiles for creating vouchers & filtering
  const { data: profilesRaw } = useSWR<Profile[]>(
    routerId ? `voucher-profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!) as Promise<Profile[]>,
    { revalidateOnFocus: true, keepPreviousData: true }
  );

  const profileList: Profile[] = useMemo(() => {
    if (Array.isArray(profilesRaw)) return profilesRaw;
    if (profilesRaw && typeof profilesRaw === 'object') {
      if (Array.isArray((profilesRaw as any).profiles)) return (profilesRaw as any).profiles;
      if (Array.isArray((profilesRaw as any).data)) return (profilesRaw as any).data;
    }
    return [];
  }, [profilesRaw]);

  // Fetch Router Profiles for print branding / Wi-Fi name
  const { data: routerProfilesResponse } = useSWR(
    'router-profiles-with-user',
    fetchRouterProfilesWithUserAPI,
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );

  const activeRouter = useMemo(() => {
    if (!routerProfilesResponse?.profiles || !routerId) return null;
    return routerProfilesResponse.profiles.find(
      (r: any) => String(r.id) === String(routerId) || r.name === routerId
    );
  }, [routerProfilesResponse, routerId]);

  const defaultWifiName = useMemo(() => {
    return (
      activeRouter?.cardPrintLabel ||
      activeRouter?.hotspotWifiName ||
      activeRouter?.wifiName ||
      (activeRouter as any)?.wifiSsid ||
      ''
    );
  }, [activeRouter]);

  // Deep-linking flag: only process initial URL parameters once on mount
  const initialDeepLinkHandled = useRef(false);

  // Handle URL Param Deep-linking for Batch Detail on Initial Mount
  const paramProfile = searchParams.get('profile');
  const paramBatchId = searchParams.get('batchId');
  const paramComment = searchParams.get('comment');
  const paramPrintLabel = searchParams.get('printLabel');

  useEffect(() => {
    if (initialDeepLinkHandled.current) return;
    if (paramProfile && !selectedBatchModal) {
      initialDeepLinkHandled.current = true;
      const found = batchList.find(
        (b) =>
          b.profile === paramProfile &&
          (!paramBatchId || b.batchId === paramBatchId)
      );
      if (found) {
        setSelectedBatchModal(found);
      } else if (batches) {
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
  }, [paramProfile, paramBatchId, paramComment, paramPrintLabel, batchList, batches, selectedBatchModal]);

  // Fetch Batch Detail at Page Level for the selected batch
  const {
    data: batchDetail,
    isLoading: isBatchDetailLoading,
    error: batchDetailError,
    mutate: mutateBatchDetail,
  } = useSWR<VoucherBatchDetail>(
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
      keepPreviousData: false,
      dedupingInterval: 60000,
    }
  );

  // Check if fetched batchDetail strictly matches the currently targeted batch
  const isMatchingBatchDetail = useMemo(() => {
    if (!batchDetail || !selectedBatchModal) return false;
    if (batchDetail.profile !== selectedBatchModal.profile) return false;
    if (selectedBatchModal.batchId && batchDetail.batchId && selectedBatchModal.batchId !== batchDetail.batchId) {
      return false;
    }
    return true;
  }, [batchDetail, selectedBatchModal]);

  // Only open/render the Batch Detail Drawer once the batch is fully loaded
  const isDrawerOpen = Boolean(selectedBatchModal && isMatchingBatchDetail && !isBatchDetailLoading);

  // Safe modal close handler that prevents resurrecting from URL params
  const handleCloseDetailModal = () => {
    setSelectedBatchModal(null);
    if (searchParams.get('profile')) {
      setSearchParams({}, { replace: true });
    }
  };

  // If fetching fails, reset selectedBatchModal and notify user
  useEffect(() => {
    if (batchDetailError && selectedBatchModal) {
      handleCloseDetailModal();
    }
  }, [batchDetailError, selectedBatchModal]);

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

  const handleCreateBatch = async (
    payload: CreateBatchPayload,
    onProgress: (pct: number) => void
  ) => {
    if (!routerId) throw new Error('No router selected');
    const res = await createVouchersAPI(
      routerId,
      payload.profile,
      payload.count,
      payload.userLength,
      payload.comment
    );

    if (res?.jobId) {
      onProgress(5);
      let done = false;
      let attempts = 0;
      while (!done && attempts < 120) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        attempts++;
        try {
          const job = await fetchVoucherJobStatusAPI(routerId, res.jobId);
          if (job.progress !== undefined) {
            onProgress(job.progress);
          }
          if (job.status === 'completed') {
            done = true;
          } else if (job.status === 'failed') {
            throw new Error(job.error || 'Voucher generation failed on router');
          }
        } catch {
          if (attempts > 5) done = true;
        }
      }
    }

    const newBatch: VoucherBatch = {
      profile: payload.profile,
      printLabel: payload.comment || payload.profile,
      originalCount: payload.count,
      unusedCount: payload.count,
      activeCount: 0,
      expiredCount: 0,
      comment: payload.comment || '',
      cleanComment: payload.comment || '',
      createdAt: new Date().toISOString(),
      batchId: res?.batchId,
    };

    revalidateRouterCache(routerId);
    await mutateBatches();
    return { newBatch, pins: res?.pins };
  };

  const handleDeleteBatch = async (batch: VoucherBatch) => {
    if (!routerId) return;
    let idsToDelete: string[] = [];

    const res = await getVoucherCodesAPI(
      routerId,
      batch.profile,
      batch.comment,
      batch.printLabel,
      'all',
      batch.batchId
    );
    idsToDelete = res?.codes || [];

    // Fallback to loaded batchDetail IDs if codes endpoint returned empty
    if (idsToDelete.length === 0 && isMatchingBatchDetail && batchDetail) {
      const detailVouchers = [
        ...(batchDetail.unusedVouchers || []),
        ...(batchDetail.activeVouchers || []),
        ...(batchDetail.expiredVouchers || []),
      ];
      idsToDelete = detailVouchers
        .map((v) => v['.id'] || v.id || v.name)
        .filter((val): val is string => Boolean(val));
    }

    if (idsToDelete.length > 0) {
      await deleteVouchersAPI(routerId, idsToDelete, true);
    }
    revalidateRouterCache(routerId);
    await mutateBatches();
  };

  const handleFetchCodes = async (
    batch: VoucherBatch,
    filter: string
  ) => {
    if (!routerId) return [];
    const validFilter = ['unused', 'active', 'expired', 'all'].includes(filter)
      ? (filter as 'unused' | 'active' | 'expired' | 'all')
      : 'all';
    const res = await getVoucherCodesAPI(
      routerId,
      batch.profile,
      batch.comment,
      batch.printLabel,
      validFilter,
      batch.batchId
    );
    return res?.codes || [];
  };

  // Statistics
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

  // Filtered Batches
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
    const map = new Map<string, { profile: string; batches: IdentifiedVoucherBatch[] }>();
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

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className="responsive-container vouchers-page-container"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ─── 1. Header Bar ─── */}
      <div className="page-header-card">
        <div className="page-header-left-group">
          <div className="page-header-icon">
            <Ticket />
          </div>
          <div className="page-header-titles">
            <h2 className="page-header-title">
              {t('vouchers.title')}
            </h2>
            <p className="page-header-subtitle">
              {t('vouchers.subtitle')}
            </p>
          </div>
        </div>

        <div className="page-header-actions-group">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || batchesLoading}
            title={t('common.refresh')}
            className="page-header-btn"
          >
            <RefreshCw size={14} className={isRefreshing || batchesLoading ? 'animate-spin' : ''} />
            <span className="hide-sm-only">
              {t('common.refresh')}
            </span>
          </button>

          <button
            onClick={() => setIsCreateDrawerOpen(true)}
            className="page-header-btn page-header-btn-primary"
          >
            <Plus size={14} />
            <span>{t('common.add')}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Summary Statistics Cards ─── */}
      <div className="vouchers-stats-grid">
        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <Layers size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.totalBatches')}
            </span>
            <strong className="voucher-stat-value">
              {stats.totalBatches}
            </strong>
          </div>
        </div>

        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <Ticket size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.totalVouchers')}
            </span>
            <strong className="voucher-stat-value">
              {stats.totalVouchers}
            </strong>
          </div>
        </div>

        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <CheckCircle2 size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.unusedVouchers')}
            </span>
            <strong className="voucher-stat-value unused">
              {stats.totalUnused}
            </strong>
          </div>
        </div>

        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <Clock size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.activeVouchers')}
            </span>
            <strong className="voucher-stat-value active">
              {stats.totalActive}
            </strong>
          </div>
        </div>
      </div>

      {/* ─── 3. Search Control Bar ─── */}
      <div className="vouchers-search-bar">
        <div className="vouchers-search-input-wrapper">
          <Search
            size={15}
            className="vouchers-search-icon"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('batch.searchPlaceholder')}
            className="vouchers-search-input"
          />
        </div>
      </div>

      {/* ─── 4. Main Batches List Grouped by Profile ─── */}
      {batchesLoading ? (
        <div className="voucher-loading-stack">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="responsive-card voucher-skeleton-card">
              <div className="skeleton voucher-skeleton-inner" />
            </div>
          ))}
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="responsive-card vouchers-empty-card">
          <Ticket size={36} className="voucher-empty-icon" />
          <h4 className="vouchers-empty-title">
            {t('batch.noBatchesFound')}
          </h4>
          <p className="vouchers-empty-desc">
            {t('batch.noBatchesDesc')}
          </p>
          <button
            onClick={() => setIsCreateDrawerOpen(true)}
            className="vouchers-empty-btn"
          >
            + {t('batch.createBatch')}
          </button>
        </div>
      ) : (
        <div className="voucher-batches-stack">
          {groupedProfileBatches.map((pGroup) => {
            const firstBatch = pGroup.batches[0];
            const validityBadge = firstBatch?.validityBadge || '∞';
            const dataBadge = firstBatch?.dataBadge || '∞';
            const formattedPrice = firstBatch?.formattedPrice;
            const rateLimit = firstBatch?.rateLimit;

            return (
              <div key={pGroup.profile} className="profile-group-card">
                {/* Profile Section Header */}
                <div className="profile-group-header">
                  <div className="profile-group-title">
                    <FolderOpen size={16} className="text-blue" />
                    <strong>{pGroup.profile}</strong>
                  </div>

                  {/* Profile Metadata Pills Stack */}
                  <div className="profile-pills-stack">
                    {validityBadge && validityBadge !== '∞' && (
                      <span className="profile-meta-pill time">
                        <Clock size={10} />
                        {validityBadge}
                      </span>
                    )}
                    {dataBadge && dataBadge !== '∞' && (
                      <span className="profile-meta-pill data">
                        {dataBadge}
                      </span>
                    )}
                    {formattedPrice && (
                      <span className="profile-meta-pill price">
                        {formattedPrice}
                      </span>
                    )}
                    {rateLimit && (
                      <span className="profile-meta-pill muted">
                        {rateLimit}
                      </span>
                    )}
                    <span className="profile-meta-pill muted">
                      {pGroup.batches.length}{' '}
                      {pGroup.batches.length === 1
                        ? t('batch.batchUnitSingle')
                        : t('batch.batchesUnit')}
                    </span>
                  </div>
                </div>

                {/* Batch Cards Grid */}
                <div className="batch-cards-grid">
                  {pGroup.batches.map((batch, bIdx) => {
                    const ageStr = formatRelativeAge(batch.createdAt, t);
                    const cleanComm = batch.cleanComment ?? batch.comment;
                    const isThisBatchLoading =
                      Boolean(selectedBatchModal) &&
                      !isDrawerOpen &&
                      (selectedBatchModal === batch ||
                        Boolean(selectedBatchModal?._uid && selectedBatchModal._uid === batch._uid) ||
                        Boolean(selectedBatchModal?.batchId && selectedBatchModal.batchId === batch.batchId));

                    return (
                      <div
                        key={batch._uid || batch.batchId || bIdx}
                        className={`batch-card-item ${isThisBatchLoading ? 'loading' : ''}`}
                        onClick={() => {
                          if (isBatchDetailLoading) return;
                          setSelectedBatchModal(batch);
                        }}
                      >
                        <div className="batch-card-main">
                          <BatchRing
                            originalCount={batch.originalCount}
                            unusedCount={batch.unusedCount}
                            activeCount={batch.activeCount}
                            expiredCount={batch.expiredCount}
                          />

                          {/* Stats & Metadata */}
                          <div className="batch-card-body">
                            <div className="batch-card-top">
                              <div className="batch-stats-summary">
                                <span className="batch-stat-item">
                                  <strong>{batch.originalCount}</strong> {t('batch.totalVouchers')}
                                </span>
                                <span className="batch-stat-sep" aria-hidden="true">·</span>
                                <span className="batch-stat-item">
                                  <strong>{batch.unusedCount}</strong> {t('batch.statusUnused')}
                                </span>
                                <span className="batch-stat-sep" aria-hidden="true">·</span>
                                <span className="batch-stat-item">
                                  <strong>{batch.activeCount}</strong> {t('batch.statusActive')}
                                </span>
                                {batch.expiredCount > 0 && (
                                  <>
                                    <span className="batch-stat-sep" aria-hidden="true">·</span>
                                    <span className="batch-stat-item">
                                      <strong>{batch.expiredCount}</strong> {t('batch.statusExpired')}
                                    </span>
                                  </>
                                )}
                              </div>
                              {isThisBatchLoading ? (
                                <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
                              ) : (
                                <ChevronIcon size={14} className="flex-shrink-0" />
                              )}
                            </div>

                            {/* Bottom Metadata (Age + Clean Comment) */}
                            <div className="batch-card-bottom">
                              <span>{ageStr || t('batch.noDate')}</span>
                              {cleanComm && (
                                <>
                                  <span>•</span>
                                  <span className="batch-card-comment">{cleanComm}</span>
                                </>
                              )}
                            </div>
                          </div>
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

      {/* ─── 5. Create Voucher Batch Drawer ─── */}
      <CreateBatchDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        profiles={profileList}
        onCreateBatch={handleCreateBatch}
        onSuccess={(newBatch) => {
          setIsCreateDrawerOpen(false);
          setSelectedBatchModal(newBatch);
        }}
      />

      {/* ─── 6. Batch Detail Modal ─── */}
      {isDrawerOpen && (
        <BatchDetailModal
          selectedBatch={selectedBatchModal}
          batchDetail={batchDetail}
          isLoading={isBatchDetailLoading}
          mutateDetail={mutateBatchDetail}
          defaultWifiName={defaultWifiName}
          onClose={handleCloseDetailModal}
          onDeleteBatch={handleDeleteBatch}
          onFetchCodes={handleFetchCodes}
        />
      )}
    </div>
  );
}
