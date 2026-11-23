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
  revalidateRouterCache,
  type VoucherBatch,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
} from '../../api';
import type { Profile } from './types';

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

  // Filtered Vouchers List
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
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || (v.comment || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [batchDetail, detailTab, detailSearch]);

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
      t('common.delete'),
      t('batch.deleteBatchConfirm'),
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
            showToast(t('batch.noVouchersInBatch'), 'error');
            return;
          }
          await deleteVouchersAPI(routerId, codes);
          showToast(t('batch.batchDeletedSuccess'), 'success');
          revalidateRouterCache(routerId);
          onBatchDeleted();
        } catch (err: any) {
          showToast(err?.message || t('batch.noBatchesFound'), 'error');
        } finally {
          setIsDeletingBatch(false);
        }
      }
    );
  };

  const tabs = [
    { key: 'all', label: t('batch.allCount').replace('{count}', String(selectedBatch.originalCount || 0)) },
    { key: 'unused', label: t('batch.unusedCount').replace('{count}', String(selectedBatch.unusedCount || 0)) },
    { key: 'active', label: t('batch.activeCount').replace('{count}', String(selectedBatch.activeCount || 0)) },
    { key: 'expired', label: t('batch.expiredCount').replace('{count}', String(selectedBatch.expiredCount || 0)) },
  ];

  return (
    <div
      className="batch-detail-modal-overlay"
      onClick={onClose}
    >
      <div
        className="batch-detail-modal-content"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-drag-handle" />

        {/* Modal Header */}
        <div className="batch-detail-header">
          <div className="drawer-title-group">
            <div className="batch-detail-icon">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="batch-detail-title">
                {selectedBatch.profile || selectedBatch.printLabel}
              </h3>
              {selectedBatch.printLabel && selectedBatch.printLabel !== selectedBatch.profile && (
                <div className="batch-detail-subtitle">
                  {selectedBatch.printLabel}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="batch-detail-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Bar (Solid High Contrast Buttons) */}
        <div className="batch-detail-actions-bar">
          <button
            onClick={onOpenPrint}
            className="batch-detail-print-btn"
          >
            <Printer size={15} />
            <span>{t('batch.print')}</span>
          </button>

          <button
            onClick={handleDeleteEntireBatch}
            disabled={isDeletingBatch}
            className="batch-detail-delete-btn"
          >
            <Trash2 size={15} />
            <span>
              {isDeletingBatch ? t('batch.deletingBatch') : t('batch.deleteBatch')}
            </span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="batch-detail-tabs-bar">
          <div className="batch-detail-tabs-track">
            {tabs.map((tab) => {
              const isActive = detailTab === tab.key;
              const statusClass = tab.key === 'active' ? 'active-status' : tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key as any)}
                  className={`batch-detail-tab-btn ${isActive ? `active ${statusClass}` : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input Box */}
        <div className="batch-detail-search-area">
          <div className="vouchers-search-input-wrapper">
            <Search
              size={14}
              className="vouchers-search-icon"
              style={{ [isRtl ? 'right' : 'left']: '10px' }}
            />
            <input
              type="text"
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
              placeholder={t('batch.searchVouchersPlaceholder')}
              className="vouchers-search-input"
              style={{
                padding: `6px ${isRtl ? '30px' : '10px'} 6px ${isRtl ? '10px' : '30px'}`,
              }}
            />
          </div>
        </div>

        {/* Scrollable Vouchers List */}
        <div className="batch-detail-cards-scroll">
          {detailLoading ? (
            <div className="voucher-loading-state">
              <Loader2 size={24} className="animate-spin" />
              <div>{t('batch.loadingVouchers')}</div>
            </div>
          ) : modalFilteredVouchers.length === 0 ? (
            <div className="voucher-empty-state">
              {t('batch.noMatchingVouchers')}
            </div>
          ) : (
            <>
              {modalFilteredVouchers.slice(0, modalDisplayLimit).map((vItem, idx) => {
                const isCopied = copiedCode === vItem.name;
                const vName = vItem.name || (vItem as any)['.id'] || '';

                return (
                  <div key={(vItem as any)['.id'] || vName || idx} className="voucher-card-item">
                    <div className="voucher-card-row">
                      <div className="voucher-card-left">
                        {vItem.disabled && (
                          <span className="voucher-disabled-badge">
                            Disabled
                          </span>
                        )}

                        <strong className="voucher-card-code">{vName}</strong>

                        <button
                          onClick={() => handleCopyCode(vName)}
                          title={t('common.copy')}
                          className={`voucher-copy-btn ${isCopied ? 'copied' : ''}`}
                        >
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>

                      <div
                        className="voucher-badges-stack"
                        style={{
                          marginLeft: isRtl ? '0' : 'auto',
                          marginRight: isRtl ? 'auto' : '0',
                        }}
                      >
                        {/* Pre-normalized Remaining Time */}
                        {vItem.timeLeft && vItem.timeLeft !== '0s' && (
                          <span className="voucher-badge-pill time">
                            <Clock size={10} />
                            <span>{vItem.timeLeft}</span>
                          </span>
                        )}

                        {/* Pre-normalized Remaining Data */}
                        {vItem.dataLeft && vItem.dataLeft !== '0 MB' && (
                          <span className="voucher-badge-pill data">
                            <HardDrive size={10} />
                            <span>{vItem.dataLeft}</span>
                            {vItem.dataPercent != null && (
                              <span>({vItem.dataPercent}%)</span>
                            )}
                          </span>
                        )}

                        {/* Pre-normalized Device Name */}
                        {vItem.deviceName && (
                          <span className="voucher-badge-pill device" title={vItem.deviceName}>
                            <Smartphone size={10} />
                            <span>{vItem.deviceName}</span>
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
                  className="voucher-load-more-btn"
                >
                  {t('batch.loadMoreRemaining').replace(
                    '{count}',
                    String(modalFilteredVouchers.length - modalDisplayLimit)
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
