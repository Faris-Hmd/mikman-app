import React, { useState, useMemo, useEffect } from 'react';
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
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import {
  type VoucherBatch,
  type VoucherBatchDetail,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
} from '../../api';
import { PrintConfigModal } from './PrintConfigModal';

interface BatchDetailModalProps {
  selectedBatch: VoucherBatch | null;
  batchDetail?: VoucherBatchDetail | null;
  isLoading?: boolean;
  mutateDetail?: () => void;
  defaultWifiName?: string;
  onClose: () => void;
  onDeleteBatch?: (batch: VoucherBatch) => Promise<void>;
  onFetchCodes: (batch: VoucherBatch, filter: string) => Promise<string[]>;
}

export const BatchDetailModal: React.FC<BatchDetailModalProps> = ({
  selectedBatch,
  batchDetail,
  isLoading,
  mutateDetail,
  defaultWifiName,
  onClose,
  onDeleteBatch,
  onFetchCodes,
}) => {
  const { t, isRtl } = useLanguage();
  const { showConfirm } = useModal();

  const [activeTab, setActiveTab] = useState<'unused' | 'active' | 'expired'>('unused');
  const [detailSearch, setDetailSearch] = useState('');
  const [modalDisplayLimit, setModalDisplayLimit] = useState(60);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (selectedBatch) {
      setDetailSearch('');
      setModalDisplayLimit(60);
      setActiveTab('unused');
      setToastMessage(null);
    }
  }, [selectedBatch]);

  const detailLoading = isLoading || !batchDetail;

  const unusedVouchers: VoucherSummary[] = useMemo(() => {
    return batchDetail?.unusedVouchers || (batchDetail as any)?.unused || [];
  }, [batchDetail]);

  const activeVouchers: ActiveVoucher[] = useMemo(() => {
    return batchDetail?.activeVouchers || (batchDetail as any)?.active || [];
  }, [batchDetail]);

  const expiredVouchers: ExpiredVoucher[] = useMemo(() => {
    return batchDetail?.expiredVouchers || (batchDetail as any)?.expired || [];
  }, [batchDetail]);

  const modalFilteredVouchers = useMemo(() => {
    const term = detailSearch.trim().toLowerCase();
    let source: (VoucherSummary | ActiveVoucher | ExpiredVoucher)[] = [];
    if (activeTab === 'unused') source = unusedVouchers;
    else if (activeTab === 'active') source = activeVouchers;
    else source = expiredVouchers;

    if (!term) return source;

    return source.filter((v: any) => {
      const codeMatch = (v.name || v.id || '').toLowerCase().includes(term);
      const userMatch = (v.user || '').toLowerCase().includes(term);
      const macMatch = (v.mac || '').toLowerCase().includes(term);
      const devMatch = (v.deviceName || v.comment || '').toLowerCase().includes(term);
      return codeMatch || userMatch || macMatch || devMatch;
    });
  }, [detailSearch, activeTab, unusedVouchers, activeVouchers, expiredVouchers]);

  if (!selectedBatch) return null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  // Handle Delete Entire Batch
  const handleDeleteEntireBatch = async () => {
    if (!selectedBatch || !onDeleteBatch) return;
    showConfirm(
      t('common.delete'),
      t('batch.deleteBatchConfirm'),
      async () => {
        try {
          setIsDeletingBatch(true);
          await onDeleteBatch(selectedBatch);
          showToast(t('batch.batchDeletedSuccess'), 'success');
          onClose();
        } catch (err: any) {
          showToast(err?.message || t('batch.noBatchesFound'), 'error');
        } finally {
          setIsDeletingBatch(false);
        }
      }
    );
  };

  const tabs = [
    { key: 'unused' as const, label: t('batch.tabUnused'), count: selectedBatch.unusedCount ?? unusedVouchers.length },
    { key: 'active' as const, label: t('batch.tabActive'), count: selectedBatch.activeCount ?? activeVouchers.length },
    { key: 'expired' as const, label: t('batch.tabExpired'), count: selectedBatch.expiredCount ?? expiredVouchers.length },
  ];

  return (
    <>
      <div
        className="batch-detail-modal-overlay"
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
          className="batch-detail-modal-content"
          dir={isRtl ? 'rtl' : 'ltr'}
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
                <h3 className="drawer-title">
                  {selectedBatch.printLabel || selectedBatch.profile}
                </h3>
                <div className="batch-detail-subtitle">
                  {selectedBatch.profile}
                  {selectedBatch.formattedPrice ? ` • ${selectedBatch.formattedPrice}` : ''}
                  {selectedBatch.validityBadge ? ` • ${selectedBatch.validityBadge}` : ''}
                </div>
              </div>
            </div>

            <div className="batch-header-action-btns">
              {/* Print PDF Button */}
              <button
                onClick={() => setIsPrintModalOpen(true)}
                title={t('batch.printPdf')}
                className="batch-header-btn print"
              >
                <Printer size={15} />
                <span>{t('batch.printPdf')}</span>
              </button>

              {/* Delete Batch Button */}
              {onDeleteBatch && (
                <button
                  onClick={handleDeleteEntireBatch}
                  disabled={isDeletingBatch}
                  title={t('common.delete')}
                  className="batch-header-btn delete"
                >
                  {isDeletingBatch ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  <span>{t('common.delete')}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="batch-detail-close-btn"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="batch-detail-tabs-bar">
            <div className="batch-tabs-list">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setDetailSearch('');
                      setModalDisplayLimit(60);
                    }}
                    className={`batch-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <span>{tab.label}</span>
                    <span className="batch-tab-count">
                      {tab.count}
                    </span>
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
                className="vouchers-search-icon batch-search-icon"
              />
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder={t('batch.searchVouchersPlaceholder')}
                className="vouchers-search-input batch-search-input"
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

                        <div className="voucher-badges-stack">
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
                            </span>
                          )}

                          {/* Connected Device Name */}
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

      {/* Embedded Print PDF Config Modal */}
      <PrintConfigModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedBatch={selectedBatch}
        defaultWifiName={defaultWifiName}
        onFetchCodes={onFetchCodes}
      />
    </>
  );
};
