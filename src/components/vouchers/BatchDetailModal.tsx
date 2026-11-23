import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import {
  Layers,
  Printer,
  Trash2,
  Search,
  Check,
  Copy,
  Clock,
  HardDrive,
  Smartphone,
  Loader2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import {
  fetchVoucherBatchDetailAPI,
  deleteVouchersAPI,
  getVoucherCodesAPI,
  sortByLoginDate,
  formatLoginDateDisplay,
  revalidateRouterCache,
  type VoucherBatch,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
} from '../../api';
import type { Profile } from './types';
import { formatBytes, getProfileInfoDetails } from './voucherHelpers';

interface BatchDetailModalProps {
  selectedBatch: VoucherBatch | null;
  routerId: string;
  profileList: Profile[];
  isRtl: boolean;
  onClose: () => void;
  onOpenPrint: () => void;
  onBatchDeleted: () => void;
  showToast: (text: string, type: 'success' | 'error') => void;
}

export const BatchDetailModal: React.FC<BatchDetailModalProps> = ({
  selectedBatch,
  routerId,
  profileList,
  isRtl,
  onClose,
  onOpenPrint,
  onBatchDeleted,
  showToast,
}) => {
  const { t } = useLanguage();
  const { showConfirm } = useModal();

  const [detailTab, setDetailTab] = useState<'all' | 'unused' | 'active' | 'expired'>('all');
  const [detailSearch, setDetailSearch] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState<boolean>(false);
  const [modalDisplayLimit, setModalDisplayLimit] = useState<number>(60);

  useEffect(() => {
    setModalDisplayLimit(60);
  }, [detailTab, detailSearch, selectedBatch]);

  // Fetch Batch Detail
  const {
    data: batchDetail,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR(
    routerId && selectedBatch?.profile
      ? `batch-detail-${routerId}-${selectedBatch.profile}-${selectedBatch.batchId || ''}-${selectedBatch.comment || ''}`
      : null,
    () =>
      fetchVoucherBatchDetailAPI(
        routerId,
        selectedBatch!.profile,
        selectedBatch!.comment,
        selectedBatch!.printLabel,
        selectedBatch!.batchId
      ),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      dedupingInterval: 60000,
    }
  );

  const sortedActiveVouchers = useMemo(() => {
    return sortByLoginDate(batchDetail?.activeVouchers || []);
  }, [batchDetail?.activeVouchers]);

  const sortedExpiredVouchers = useMemo(() => {
    return sortByLoginDate(batchDetail?.expiredVouchers || []);
  }, [batchDetail?.expiredVouchers]);

  const expiredNamesSet = useMemo(() => {
    return new Set((batchDetail?.expiredVouchers || []).map((ev) => ev.name || (ev as any)['.id']));
  }, [batchDetail?.expiredVouchers]);

  const activeNamesSet = useMemo(() => {
    return new Set((batchDetail?.activeVouchers || []).map((av) => av.name || (av as any)['.id']));
  }, [batchDetail?.activeVouchers]);

  // Filtered Vouchers List
  const modalFilteredVouchers = useMemo(() => {
    if (!batchDetail) return [];
    let list: (VoucherSummary | ActiveVoucher | ExpiredVoucher)[] = [];

    if (detailTab === 'unused') list = batchDetail.unusedVouchers || [];
    else if (detailTab === 'active') list = sortedActiveVouchers;
    else if (detailTab === 'expired') list = sortedExpiredVouchers;
    else {
      list = [
        ...(batchDetail.unusedVouchers || []),
        ...sortedActiveVouchers,
        ...sortedExpiredVouchers,
      ];
    }

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || (v.comment || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [batchDetail, detailTab, detailSearch, sortedActiveVouchers, sortedExpiredVouchers]);

  if (!selectedBatch) return null;

  // Handle Copy Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Handle Delete Entire Batch
  const handleDeleteEntireBatch = async () => {
    if (!routerId || !selectedBatch) return;
    showConfirm(
      t('common.delete') || 'Delete Batch',
      t('batch.deleteBatchConfirm') || 'Are you sure you want to delete all vouchers in this batch?',
      async () => {
        try {
          setIsDeletingBatch(true);
          const res = await getVoucherCodesAPI(
            routerId,
            selectedBatch.profile,
            selectedBatch.comment,
            selectedBatch.printLabel,
            'all',
            selectedBatch.batchId
          );
          const codes = res?.codes || [];
          if (codes.length === 0) {
            showToast(t('batch.noVouchersInBatch') || 'No vouchers found to delete', 'error');
            return;
          }
          await deleteVouchersAPI(routerId, codes);
          showToast(t('batch.batchDeletedSuccess') || 'Batch deleted successfully', 'success');
          revalidateRouterCache(routerId);
          onBatchDeleted();
        } catch (err: any) {
          showToast(err?.message || 'Failed to delete batch', 'error');
        } finally {
          setIsDeletingBatch(false);
        }
      }
    );
  };

  return (
    <div
      className="modal-overlay batch-detail-modal-overlay"
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
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        className="batch-detail-modal-content"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          background: 'var(--card-bg, #1a1a1a)',
          border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          direction: isRtl ? 'rtl' : 'ltr',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Drag Handle for Mobile */}
        <div className="sheet-drag-handle" />

        {/* Modal Header */}
        <div className="batch-detail-header">
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
                {selectedBatch.profile || selectedBatch.printLabel}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                {selectedBatch.printLabel && selectedBatch.printLabel !== selectedBatch.profile && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {selectedBatch.printLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Bar (Print PDF / Delete Batch - Solid High Contrast) */}
        <div className="batch-detail-actions-bar">
          <button
            onClick={onOpenPrint}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
            }}
          >
            <Printer size={15} />
            <span>{t('batch.print') || 'طباعة PDF'}</span>
          </button>

          <button
            onClick={handleDeleteEntireBatch}
            disabled={isDeletingBatch}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#dc2626',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '12px',
              cursor: isDeletingBatch ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
            }}
          >
            <Trash2 size={15} />
            <span>
              {isDeletingBatch ? 'جاري الحذف...' : t('batch.deleteBatch') || 'حذف الدفعة'}
            </span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="batch-detail-tabs-bar">
          <div className="batch-detail-tabs-track">
            {[
              { key: 'all', label: `الكل (${selectedBatch.originalCount})` },
              { key: 'unused', label: `غير مستخدمة (${selectedBatch.unusedCount})` },
              { key: 'active', label: `نشطة (${selectedBatch.activeCount})` },
              { key: 'expired', label: `منتهية (${selectedBatch.expiredCount})` },
            ].map((tab) => {
              const isActive = detailTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key as any)}
                  className="batch-detail-tab-btn"
                  style={{
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    background: isActive
                      ? tab.key === 'unused'
                        ? '#16a34a'
                        : tab.key === 'active'
                        ? '#2563eb'
                        : tab.key === 'expired'
                        ? '#ca8a04'
                        : '#334155'
                      : 'transparent',
                    boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input Box */}
        <div className="batch-detail-search-area">
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
                background: 'var(--input-bg, rgba(32, 32, 36, 0.75))',
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

        {/* Scrollable Vouchers List */}
        <div className="batch-detail-cards-scroll">
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
            <>
              {modalFilteredVouchers.slice(0, modalDisplayLimit).map((vItem, idx) => {
                const isCopied = copiedCode === vItem.name;
                const vAny = vItem as any;
                const vName = vItem.name || vAny['.id'] || '';

                const isInExpiredList = expiredNamesSet.has(vName);
                const isInActiveList = activeNamesSet.has(vName);
                const isExp = Boolean(
                  vAny.isExpired === true ||
                    vAny.disabled === true ||
                    vAny.disabled === 'true' ||
                    isInExpiredList
                );
                const isAct =
                  !isExp &&
                  Boolean(
                    isInActiveList ||
                      (vAny.address && vAny.disabled !== true && vAny.disabled !== 'true')
                  );
                const vStatus: 'unused' | 'active' | 'expired' = isExp
                  ? 'expired'
                  : isAct
                  ? 'active'
                  : 'unused';

                // Data Left
                const limitBytesNum = Number(vAny.limitBytesTotal ?? vAny['limit-bytes-total'] ?? 0);
                const bIn = Number(vAny.bytesIn ?? vAny['bytes-in'] ?? 0);
                const bOut = Number(vAny.bytesOut ?? vAny['bytes-out'] ?? 0);
                const usedBytes = bIn + bOut;

                let dataLeftStr: string | null = null;
                let dataPct: number | null = null;

                if (vStatus !== 'unused') {
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
                  if (!dataLeftStr && vStatus === 'expired') {
                    dataLeftStr = '0 MB';
                  }
                }

                // Time Left
                let timeLeftStr: string | null = null;
                let timePct: number | null = null;

                if (vStatus === 'active') {
                  timeLeftStr = vAny.timeLeftText || null;
                  const remainingSec =
                    vAny.remainingSeconds != null ? Number(vAny.remainingSeconds) : null;
                  const totalSec =
                    vAny.limitUptimeSeconds != null ? Number(vAny.limitUptimeSeconds) : null;

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
                } else if (vStatus === 'expired') {
                  timeLeftStr = '0s';
                }

                // Device Name
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

                return (
                  <div key={vItem['.id'] || vName || idx} className="voucher-card-item">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        width: '100%',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        {vAny.isDisabled === true || vAny.disabled === true || vAny.disabled === 'true' ? (
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
                        ) : null}

                        {/* PIN / Voucher Code */}
                        <strong className="voucher-card-code">{vName}</strong>

                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopyCode(vName)}
                          title={t('common.copy') || 'نسخ الكود'}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isCopied ? '#22c55e' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>

                      {/* Action & Metadata Badges */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                          scrollbarWidth: 'none',
                          marginLeft: isRtl ? '0' : 'auto',
                          marginRight: isRtl ? 'auto' : '0',
                        }}
                      >
                        {/* Remaining Time Badge */}
                        {timeLeftStr && timeLeftStr !== '0s' && (
                          <span
                            className="item-badge"
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '0 6px',
                              borderRadius: '5px',
                              height: '20px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <Clock size={10} style={{ flexShrink: 0 }} />
                            <span>{timeLeftStr}</span>
                            {timePct !== null && (
                              <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 600 }}>
                                ({Math.round(timePct)}%)
                              </span>
                            )}
                          </span>
                        )}

                        {/* Remaining Data Badge */}
                        {dataLeftStr && dataLeftStr !== '0 MB' && (
                          <span
                            className="item-badge"
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '0 6px',
                              borderRadius: '5px',
                              height: '20px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'rgba(192, 132, 252, 0.12)',
                              border: '1px solid rgba(192, 132, 252, 0.3)',
                              color: '#c084fc',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <HardDrive size={10} style={{ flexShrink: 0 }} />
                            <span>{dataLeftStr}</span>
                            {dataPct !== null && (
                              <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 600 }}>
                                ({Math.round(dataPct)}%)
                              </span>
                            )}
                          </span>
                        )}

                        {/* Device Name Badge */}
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
                              padding: '0 6px',
                              height: '20px',
                              maxWidth: '120px',
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
                            <Smartphone size={10} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cleanDeviceName}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {modalFilteredVouchers.length > modalDisplayLimit && (
                <button
                  onClick={() => setModalDisplayLimit((prev) => prev + 60)}
                  style={{
                    background: 'var(--primary, #2563eb)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'center',
                    marginTop: '8px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  {isRtl
                    ? `عرض المزيد (${modalFilteredVouchers.length - modalDisplayLimit} كرت متبقي)`
                    : `Load More (${modalFilteredVouchers.length - modalDisplayLimit} remaining)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
