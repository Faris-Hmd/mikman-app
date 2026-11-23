import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchVoucherBatchesAPI,
  fetchProfilesAPI,
  fetchRouterProfilesWithUserAPI,
  revalidateRouterCache,
  type VoucherBatch,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Plus,
  Layers,
  Ticket,
  CheckCircle2,
  Clock,
  HardDrive,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Search,
  Check,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import '../../styles/vouchers.css';
import type { Profile } from '../../components/vouchers/types';
import {
  formatBatchAge,
  getCleanComment,
  formatPriceBadge,
  getProfileInfoDetails,
} from '../../components/vouchers/voucherHelpers';
import { CreateBatchDrawer } from '../../components/vouchers/CreateBatchDrawer';
import { BatchDetailModal } from '../../components/vouchers/BatchDetailModal';
import { PrintConfigModal } from '../../components/vouchers/PrintConfigModal';

export default function VouchersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local Controls State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals & Drawer State
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState<boolean>(false);
  const [selectedBatchModal, setSelectedBatchModal] = useState<VoucherBatch | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Toast helper
  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    { revalidateOnFocus: true, keepPreviousData: true }
  );

  const profileList: Profile[] = useMemo(() => {
    if (Array.isArray(profilesData)) return profilesData;
    if (profilesData && typeof profilesData === 'object') {
      if (Array.isArray((profilesData as any).profiles)) return (profilesData as any).profiles;
      if (Array.isArray((profilesData as any).data)) return (profilesData as any).data;
    }
    return [];
  }, [profilesData]);

  // Fetch Router Status / Wifi Name
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
      <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div className="page-header-icon">
            <Ticket />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="page-header-title">
              {t('vouchers.title') || 'الكروت والدفعات'}
            </h2>
            <p className="page-header-subtitle">
              {t('vouchers.subtitle') || 'إدارة وتوليد كروت الهوتسبوت'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || batchesLoading}
            title={t('common.refresh') || 'تحديث'}
            className="page-header-btn"
            style={{ cursor: isRefreshing || batchesLoading ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={14} className={isRefreshing || batchesLoading ? 'animate-spin' : ''} />
            <span className="hide-sm-only" style={{ whiteSpace: 'nowrap' }}>
              {t('common.refresh') || 'تحديث'}
            </span>
          </button>

          <button
            onClick={() => setIsCreateDrawerOpen(true)}
            className="page-header-btn page-header-btn-primary"
          >
            <Plus size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{t('common.add') || 'إضافة'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Summary Statistics Cards ─── */}
      <div className="vouchers-stats-grid">
        {/* Total Batches Card */}
        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <Layers size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.totalBatches') || 'إجمالي الدفعات'}
            </span>
            <strong className="voucher-stat-value">
              {stats.totalBatches}
            </strong>
          </div>
        </div>

        {/* Total Vouchers Card */}
        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <Ticket size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.totalVouchers') || 'إجمالي الكروت'}
            </span>
            <strong className="voucher-stat-value">
              {stats.totalVouchers}
            </strong>
          </div>
        </div>

        {/* Unused Vouchers Card */}
        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <CheckCircle2 size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.unusedVouchers') || 'غير مستخدمة'}
            </span>
            <strong className="voucher-stat-value unused">
              {stats.totalUnused}
            </strong>
          </div>
        </div>

        {/* Active Vouchers Card */}
        <div className="voucher-stat-card">
          <div className="voucher-stat-icon">
            <Clock size={14} />
          </div>
          <div className="voucher-stat-info">
            <span className="voucher-stat-label">
              {t('batch.activeVouchers') || 'نشطة الآن'}
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
            style={{ [isRtl ? 'right' : 'left']: '12px' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('batch.searchPlaceholder') || 'البحث باسم الدفعة أو البروفايل...'}
            className="vouchers-search-input"
            style={{
              padding: `8px ${isRtl ? '34px' : '12px'} 8px ${isRtl ? '12px' : '34px'}`,
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
            const pInfo = getProfileInfoDetails(pGroup.profile, profileList, pGroup.batches[0]);
            return (
              <div key={pGroup.profile} className="profile-group-card">
                {/* Profile Section Header */}
                <div className="profile-group-header">
                  <div className="profile-group-title">
                    <FolderOpen size={16} style={{ color: '#3b82f6' }} />
                    <strong>{pGroup.profile}</strong>
                  </div>

                  {/* Profile Metadata Pills Stack */}
                  <div className="profile-pills-stack">
                    {pInfo.validityBadge && (
                      <span className="profile-meta-pill time">
                        <Clock size={10} style={{ opacity: 0.8 }} />
                        {pInfo.validityBadge}
                      </span>
                    )}
                    {pInfo.dataBadge && (
                      <span className="profile-meta-pill data">
                        <HardDrive size={10} style={{ opacity: 0.8 }} />
                        {pInfo.dataBadge}
                      </span>
                    )}
                    {pInfo.price && (
                      <span className="profile-meta-pill price">
                        <DollarSign size={10} style={{ opacity: 0.8 }} />
                        {formatPriceBadge(pInfo.price)}
                      </span>
                    )}
                    {pInfo.rateLimit && (
                      <span className="profile-meta-pill muted">
                        {pInfo.rateLimit}
                      </span>
                    )}
                    <span className="profile-meta-pill muted">
                      {pGroup.batches.length} {pGroup.batches.length === 1 ? 'دفعة' : 'دفعات'}
                    </span>
                  </div>
                </div>

                {/* Batch Cards Grid */}
                <div className="batch-cards-grid">
                  {pGroup.batches.map((batch, bIdx) => {
                    const ageStr = formatBatchAge(batch.batchId, batch.comment, batch.createdAt, isRtl);
                    const cleanComm = batch.cleanComment ?? getCleanComment(batch.comment);

                    return (
                      <div
                        key={batch.batchId || bIdx}
                        className="batch-card-item"
                        onClick={() => setSelectedBatchModal(batch)}
                      >
                        {/* Top Badges Stack & Arrow */}
                        <div className="batch-card-top">
                          <div className="batch-pills-row">
                            <span className="batch-pill">
                              {batch.originalCount} {t('batch.totalVouchers') || 'إجمالي'}
                            </span>
                            <span className="batch-pill unused">
                              {batch.unusedCount} {t('batch.statusUnused') || 'غير مستخدم'}
                            </span>
                            <span className="batch-pill active">
                              {batch.activeCount} {t('batch.statusActive') || 'نشط'}
                            </span>
                            {batch.expiredCount > 0 && (
                              <span className="batch-pill expired">
                                {batch.expiredCount} {t('batch.statusExpired') || 'منتهي'}
                              </span>
                            )}
                          </div>
                          <ChevronIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </div>

                        {/* Bottom Metadata (Age + Clean Comment) */}
                        <div className="batch-card-bottom">
                          <span>{ageStr || (isRtl ? 'بدون تاريخ' : 'No date')}</span>
                          {cleanComm && (
                            <>
                              <span>•</span>
                              <span className="batch-card-comment">{cleanComm}</span>
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

      {/* ─── 5. Create Voucher Batch Drawer ─── */}
      <CreateBatchDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        routerId={routerId || ''}
        profileList={profileList}
        isRtl={isRtl}
        onSuccess={(newBatch) => {
          setIsCreateDrawerOpen(false);
          if (routerId) revalidateRouterCache(routerId);
          mutateBatches();
          setSelectedBatchModal(newBatch);
        }}
      />

      {/* ─── 6. Batch Detail Modal ─── */}
      <BatchDetailModal
        selectedBatch={selectedBatchModal}
        routerId={routerId || ''}
        profileList={profileList}
        isRtl={isRtl}
        onClose={() => {
          setSelectedBatchModal(null);
          setSearchParams({});
        }}
        onOpenPrint={() => setIsPrintModalOpen(true)}
        onBatchDeleted={() => {
          setSelectedBatchModal(null);
          setSearchParams({});
          mutateBatches();
        }}
        showToast={showToast}
      />

      {/* ─── 7. Print Config Modal ─── */}
      <PrintConfigModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedBatch={selectedBatchModal}
        routerId={routerId || ''}
        activeRouter={activeRouter}
        isRtl={isRtl}
        showToast={showToast}
      />
    </div>
  );
}
