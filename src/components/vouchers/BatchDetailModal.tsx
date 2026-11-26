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
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useModal } from '../../context/ModalContext';
import {
  formatBytes,
  formatRemainingTime,
  parseCommentRemainingTime,
} from '../../lib/helpers';
import { formatRelativeAge } from './voucherHelpers';
import {
  type VoucherBatch,
  type VoucherBatchDetail,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
} from '../../api';
import { PrintConfigModal } from './PrintConfigModal';
import { BatchRing } from './BatchRing';

interface BatchDetailModalProps {
  selectedBatch: VoucherBatch | null;
  batchDetail?: VoucherBatchDetail | null;
  isLoading?: boolean;
  mutateDetail?: () => void;
  defaultWifiName?: string;
  onClose: () => void;
  onDeleteBatch?: (batch: VoucherBatch) => Promise<void>;
  onCleanupExpired?: (batch: VoucherBatch) => Promise<{ deletedCount?: number; expiredCount?: number }>;
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
  onCleanupExpired,
  onFetchCodes,
}) => {
  const { t, isRtl } = useLanguage();
  const { showConfirm } = useModal();

  const [activeTab, setActiveTab] = useState<'unused' | 'active' | 'expired'>('unused');
  const [detailSearch, setDetailSearch] = useState('');
  const [modalDisplayLimit, setModalDisplayLimit] = useState(60);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [isCleaningExpired, setIsCleaningExpired] = useState(false);
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

  if (!selectedBatch || !batchDetail || isLoading) return null;

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
          onClose();
        } catch (err: any) {
          showToast(err?.message || t('batch.noBatchesFound'), 'error');
        } finally {
          setIsDeletingBatch(false);
        }
      },
      { variant: 'danger', confirmLabel: t('common.delete') }
    );
  };

  // Handle Clean Expired Vouchers from Batch
  const handleCleanupExpired = async () => {
    if (!selectedBatch || !onCleanupExpired) return;
    const countToClean = selectedBatch.expiredCount ?? expiredVouchers.length;
    if (countToClean <= 0) {
      showToast(t('batch.cleanupNone') || 'No expired vouchers to clean.');
      return;
    }

    const descTemplate =
      t('batch.cleanupConfirmDesc') ||
      'Permanently delete {count} expired voucher(s) from this batch? Active and unused vouchers will be kept.';

    showConfirm(
      t('batch.cleanupConfirmTitle') || 'Clean Expired Vouchers?',
      descTemplate.replace('{count}', String(countToClean)),
      async () => {
        try {
          setIsCleaningExpired(true);
          const result = await onCleanupExpired(selectedBatch);
          const removed = result?.deletedCount ?? result?.expiredCount ?? countToClean;
          const successTemplate =
            t('batch.cleanupSuccess') || 'Removed {count} expired voucher(s).';
          showToast(successTemplate.replace('{count}', String(removed)), 'success');
          if (activeTab === 'expired') {
            setActiveTab('unused');
          }
          mutateDetail?.();
        } catch (err: any) {
          showToast(err?.message || 'Failed to clean expired vouchers', 'error');
        } finally {
          setIsCleaningExpired(false);
        }
      },
      { variant: 'danger', confirmLabel: t('batch.cleanupExpired') || 'Clean Expired' }
    );
  };

  const tabs = [
    { key: 'unused' as const, label: t('batch.tabUnused') || t('batch.statusUnused') || 'Unused', count: selectedBatch.unusedCount ?? unusedVouchers.length },
    { key: 'active' as const, label: t('batch.tabActive') || t('batch.statusActive') || 'In Use', count: selectedBatch.activeCount ?? activeVouchers.length },
    { key: 'expired' as const, label: t('batch.tabExpired') || t('batch.statusExpired') || 'Expired', count: selectedBatch.expiredCount ?? expiredVouchers.length },
  ];

  const batchAge = formatRelativeAge(selectedBatch.createdAt || batchDetail?.createdAt, t) || t('batch.noDate');
  const unusedCount = selectedBatch.unusedCount ?? unusedVouchers.length;
  const activeCount = selectedBatch.activeCount ?? activeVouchers.length;
  const expiredCount = selectedBatch.expiredCount ?? expiredVouchers.length;
  const totalCount = selectedBatch.originalCount ?? (unusedCount + activeCount + expiredCount);
  const cleanComment = selectedBatch.cleanComment ?? selectedBatch.comment;
  const metaParts = [
    selectedBatch.dataBadge,
    selectedBatch.rateLimit,
  ].filter(Boolean);

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
                  {selectedBatch.profile}
                </h3>
                <div className="batch-detail-subtitle">
                  {batchAge}
                  {selectedBatch.formattedPrice ? ` • ${selectedBatch.formattedPrice}` : ''}
                  {selectedBatch.validityBadge ? ` • ${selectedBatch.validityBadge}` : ''}
                </div>
              </div>
            </div>

            <div className="batch-header-action-btns">
              {/* Print PDF Button */}
              <button
                onClick={() => setIsPrintModalOpen(true)}
                title={t('batch.printPdf') || t('batch.printBtn') || 'Print'}
                className="batch-header-btn print"
              >
                <Printer size={15} />
                <span>{t('batch.printBtn') || t('batch.printPdf') || 'Print'}</span>
              </button>

              {/* Clean Expired Vouchers Button */}
              {onCleanupExpired && expiredCount > 0 && (
                <button
                  onClick={handleCleanupExpired}
                  disabled={isCleaningExpired || isDeletingBatch}
                  title={t('batch.cleanupExpired') || 'Clean Expired'}
                  className="batch-header-btn cleanup"
                >
                  {isCleaningExpired ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  <span>{t('batch.cleanupExpired') || 'Clean Expired'}</span>
                </button>
              )}

              {/* Delete Batch Button */}
              {onDeleteBatch && (
                <button
                  onClick={handleDeleteEntireBatch}
                  disabled={isDeletingBatch}
                  title={t('common.delete') || 'Delete'}
                  className="batch-header-btn delete"
                >
                  {isDeletingBatch ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  <span>{t('common.delete') || 'Delete'}</span>
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

          {/* Batch Info Strip */}
          <div className="batch-detail-info-strip">
            <BatchRing
              originalCount={totalCount}
              unusedCount={unusedCount}
              activeCount={activeCount}
              expiredCount={expiredCount}
            />
            <div className="batch-detail-info-body">
              <div className="batch-stats-summary">
                <span className="batch-stat-item">
                  <strong>{totalCount}</strong> {t('batch.totalVouchers')}
                </span>
                <span className="batch-stat-sep" aria-hidden="true">·</span>
                <span className="batch-stat-item">
                  <strong>{unusedCount}</strong> {t('batch.statusUnused')}
                </span>
                <span className="batch-stat-sep" aria-hidden="true">·</span>
                <span className="batch-stat-item">
                  <strong>{activeCount}</strong> {t('batch.statusActive')}
                </span>
                {expiredCount > 0 && (
                  <>
                    <span className="batch-stat-sep" aria-hidden="true">·</span>
                    <span className="batch-stat-item">
                      <strong>{expiredCount}</strong> {t('batch.statusExpired')}
                    </span>
                  </>
                )}
              </div>
              {(cleanComment || metaParts.length > 0) && (
                <div className="batch-detail-info-meta">
                  {metaParts.map((part, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                  {cleanComment && (
                    <>
                      {metaParts.length > 0 && <span aria-hidden="true">·</span>}
                      <span className="batch-detail-info-comment">{cleanComment}</span>
                    </>
                  )}
                </div>
              )}
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
                    className={`batch-tab-btn tab-${tab.key} ${isActive ? 'active' : ''}`}
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
                  const vAny = vItem as any;

                  // Remaining Time: check normalized string, remainingSeconds, or comment EXP date
                  let rTime: string | null = null;
                  let timePct: number | null = null;

                  if (activeTab !== 'unused') {
                    const rawTimeStr = vItem.timeLeft || (vItem as ActiveVoucher).timeLeftText || vAny.remainingTime;
                    if (
                      rawTimeStr &&
                      rawTimeStr !== '0s' &&
                      rawTimeStr !== 'Expired' &&
                      !rawTimeStr.toLowerCase().includes('mb') &&
                      !rawTimeStr.toLowerCase().includes('gb')
                    ) {
                      rTime = rawTimeStr;
                    }

                    const rawRemSec = vItem.remainingSeconds ?? vAny['remaining-seconds'];
                    const remSecNum = rawRemSec != null && rawRemSec !== '' ? Number(rawRemSec) : null;
                    const rawTotalSec = vAny.limitUptimeSeconds ?? vAny['limit-uptime-seconds'] ?? vAny.limitUptime;
                    const totalSecNum = rawTotalSec != null && !isNaN(Number(rawTotalSec)) ? Number(rawTotalSec) : null;

                    if (!rTime && remSecNum != null && !isNaN(remSecNum) && remSecNum > 0) {
                      rTime = formatRemainingTime(remSecNum);
                    }

                    if (!rTime && vItem.comment) {
                      const expTime = parseCommentRemainingTime(vItem.comment);
                      if (expTime && expTime !== '0s') {
                        rTime = expTime;
                      }
                    }

                    if (vItem.timePercent != null && !isNaN(Number(vItem.timePercent))) {
                      timePct = Math.round(Number(vItem.timePercent));
                    } else if (remSecNum != null && totalSecNum != null && totalSecNum > 0) {
                      timePct = Math.round(Math.min(100, Math.max(0, (remSecNum / totalSecNum) * 100)));
                    }
                  }

                  // Remaining Data: check normalized string, remainingBytes, or quota calculation
                  let rData: string | null = null;
                  let dataPct: number | null = null;

                  if (activeTab !== 'unused') {
                    const rawDataStr = vItem.dataLeft || vAny.remainingData;
                    if (rawDataStr && rawDataStr !== '0 MB' && rawDataStr !== '0 B') {
                      rData = rawDataStr;
                    }

                    const rawRemBytes = vItem.remainingBytes ?? vAny['remaining-bytes'];
                    const remBytesNum = rawRemBytes != null && rawRemBytes !== '' ? Number(rawRemBytes) : null;
                    const rawLimitBytes = vItem.limitBytesTotal ?? vAny['limit-bytes-total'];
                    const limitBytesNum = rawLimitBytes != null && !isNaN(Number(rawLimitBytes)) ? Number(rawLimitBytes) : 0;

                    if (!rData && remBytesNum != null && !isNaN(remBytesNum) && remBytesNum > 0) {
                      rData = formatBytes(remBytesNum);
                    }

                    if (!rData && limitBytesNum > 0) {
                      const bIn = Number(vAny.bytesIn ?? vAny['bytes-in'] ?? 0);
                      const bOut = Number(vAny.bytesOut ?? vAny['bytes-out'] ?? 0);
                      const usedBytes = (isNaN(bIn) ? 0 : bIn) + (isNaN(bOut) ? 0 : bOut);
                      const calculatedRem = Math.max(0, limitBytesNum - usedBytes);
                      if (calculatedRem > 0) {
                        rData = formatBytes(calculatedRem);
                      }
                    }

                    if (vItem.dataPercent != null && !isNaN(Number(vItem.dataPercent))) {
                      dataPct = Math.round(Number(vItem.dataPercent));
                    } else if (limitBytesNum > 0) {
                      const bytesForPct = remBytesNum != null && !isNaN(remBytesNum)
                        ? remBytesNum
                        : (rData ? limitBytesNum - (Number(vAny.bytesIn ?? 0) + Number(vAny.bytesOut ?? 0)) : null);
                      if (bytesForPct != null) {
                        dataPct = Math.round(Math.min(100, Math.max(0, (bytesForPct / limitBytesNum) * 100)));
                      }
                    }
                  }

                  // Clean Device Name
                  const rawDevName = (vItem.deviceName || vAny.hostName || '').trim();
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

                  const loginDate = vItem.loginDate;

                  return (
                    <div key={(vItem as any)['.id'] || vName || idx} className="voucher-card-item">
                      <div className="voucher-card-row">
                        <div className="voucher-card-left">
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
                          {/* Login Date for expired pins */}
                          {loginDate && activeTab === 'expired' && (
                            <span
                              className="voucher-badge-pill login-date"
                              title={t('vouchers.loginDate') || 'Login Date'}
                            >
                              <LogIn size={10} />
                              <span>{loginDate}</span>
                            </span>
                          )}

                          {/* Remaining Time */}
                          {rTime && (
                            <span
                              className="voucher-badge-pill time"
                              title={t('common.remainingTime') || 'Remaining Time'}
                            >
                              <Clock size={10} />
                              <span>{rTime}</span>
                              {timePct != null && (
                                <span className="voucher-badge-percent">({timePct}%)</span>
                              )}
                            </span>
                          )}

                          {/* Remaining Data */}
                          {rData && (
                            <span
                              className="voucher-badge-pill data"
                              title={t('common.remainingData') || 'Remaining Data'}
                            >
                              <HardDrive size={10} />
                              <span>{rData}</span>
                              {dataPct != null && (
                                <span className="voucher-badge-percent">({dataPct}%)</span>
                              )}
                            </span>
                          )}

                          {/* Connected Device Name */}
                          {cleanDeviceName && (
                            <span className="voucher-badge-pill device" title={cleanDeviceName}>
                              <Smartphone size={10} />
                              <span>{cleanDeviceName}</span>
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
      {isPrintModalOpen && (
        <PrintConfigModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          selectedBatch={selectedBatch}
          defaultWifiName={defaultWifiName}
          onFetchCodes={onFetchCodes}
        />
      )}
    </>
  );
};
