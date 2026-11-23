import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, X, ChevronDown, Tag, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { createVouchersAPI, fetchVoucherJobStatusAPI, type VoucherBatch } from '../../api';
import type { Profile } from './types';

interface CreateBatchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  profileList: Profile[];
  isRtl: boolean;
  onSuccess: (newBatch: VoucherBatch, pins?: string[]) => void;
}

export const CreateBatchDrawer: React.FC<CreateBatchDrawerProps> = ({
  isOpen,
  onClose,
  routerId,
  profileList,
  isRtl,
  onSuccess,
}) => {
  const { t } = useLanguage();

  const [createProfile, setCreateProfile] = useState<string>('');
  const [countInput, setCountInput] = useState<string>('100');
  const [length, setLength] = useState<number>(6);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [jobProgress, setJobProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto select initial profile
  useEffect(() => {
    if (profileList.length > 0 && !createProfile) {
      setCreateProfile(profileList[0].name || profileList[0].id);
    }
  }, [profileList, createProfile]);

  const count = useMemo(() => {
    const parsed = parseInt(countInput, 10);
    if (isNaN(parsed) || parsed < 1) return 1;
    if (parsed > 5000) return 5000;
    return parsed;
  }, [countInput]);

  if (!isOpen) return null;

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId || !createProfile) {
      setErrorMsg(t('vouchers.selectProfileFirst'));
      return;
    }

    if (count > 5000) {
      setErrorMsg(t('vouchers.maxLimitError'));
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
        setSuccessMsg(t('vouchers.pushingToRouter'));
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

      setTimeout(() => {
        setIsSubmitting(false);
        setJobProgress(null);
        setSuccessMsg(null);
        onSuccess(newBatch, res?.pins);
      }, 500);
    } catch (err: any) {
      console.error('Failed to generate batch vouchers:', err);
      setErrorMsg(err?.message || t('vouchers.couldNotGenerate'));
      setIsSubmitting(false);
      setJobProgress(null);
    }
  };

  return (
    <div
      className="create-batch-drawer-overlay"
      style={{ justifyContent: isRtl ? 'flex-start' : 'flex-end' }}
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="create-batch-drawer-content"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-drag-handle" />

        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-header-icon">
              <Sparkles size={16} />
            </div>
            <h3 className="drawer-title">
              {t('vouchers.generateBatchTitle')}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="drawer-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Form */}
        <form onSubmit={handleGenerateBatch} className="drawer-form-container">
          <div className="drawer-form-body">
            {errorMsg && (
              <div className="drawer-alert-error">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="drawer-alert-success">
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 1. Profile Dropdown Menu */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.profileLabel')}
              </label>
              <div className="vouchers-search-input-wrapper">
                <select
                  value={createProfile}
                  onChange={(e) => setCreateProfile(e.target.value)}
                  className="drawer-select-field"
                  style={{
                    padding: isRtl ? '0 12px 0 32px' : '0 32px 0 12px',
                  }}
                >
                  <option value="" disabled>
                    {t('vouchers.selectProfile')}
                  </option>
                  {profileList.map((p) => {
                    const pName = p.name || p.id;
                    return (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown
                  size={15}
                  className="drawer-select-chevron"
                  style={{ [isRtl ? 'left' : 'right']: '12px' }}
                />
              </div>
            </div>

            {/* 2. Voucher Quantity */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.quantityLabel')}
              </label>
              <div className="drawer-input-row">
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={countInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setCountInput(val);
                    }}
                    placeholder={t('vouchers.enterQuantity')}
                    className="drawer-input-field"
                    style={{
                      textAlign: isRtl ? 'right' : 'left',
                      padding: '0 12px',
                    }}
                  />
                </div>

                <div style={{ width: '130px', flexShrink: 0, position: 'relative' }}>
                  <select
                    value={[50, 100, 250, 500, 1000, 2000].includes(count) ? String(count) : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'custom') {
                        setCountInput(val);
                      }
                    }}
                    className="drawer-select-field"
                    style={{
                      padding: isRtl ? '0 10px 0 28px' : '0 28px 0 10px',
                    }}
                  >
                    <option value="" disabled>
                      {t('vouchers.presetQuantity')}
                    </option>
                    {[50, 100, 250, 500, 1000, 2000].map((q) => (
                      <option key={q} value={String(q)}>
                        {q} {t('vouchers.vouchersUnit')}
                      </option>
                    ))}
                    <option value="custom">
                      {t('vouchers.custom')}
                    </option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="drawer-select-chevron"
                    style={{ [isRtl ? 'left' : 'right']: '10px' }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Code Length Segmented Bar */}
            <div className="drawer-field-group">
              <div className="drawer-field-header">
                <label className="drawer-field-label">
                  {t('vouchers.lengthLabel')}
                </label>
                <span className="drawer-field-badge">
                  {length} {t('vouchers.digits')}
                </span>
              </div>

              <div className="drawer-length-grid">
                {[4, 5, 6, 7, 8].map((l) => {
                  const isSelected = length === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLength(l)}
                      className={`drawer-length-btn ${isSelected ? 'active' : 'inactive'}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Batch Name / Print Comment */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.batchNameLabel')}
              </label>
              <div className="vouchers-search-input-wrapper">
                <Tag
                  size={14}
                  className="vouchers-search-icon"
                  style={{ [isRtl ? 'right' : 'left']: '10px' }}
                />
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('vouchers.batchNamePlaceholder')}
                  className="drawer-input-field"
                  style={{
                    padding: `0 ${isRtl ? '30px' : '10px'} 0 ${isRtl ? '10px' : '30px'}`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="create-batch-drawer-footer">
            {jobProgress !== null && (
              <div className="drawer-progress-track">
                <div
                  className="drawer-progress-fill"
                  style={{ width: `${jobProgress}%` }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !createProfile || count <= 0}
              className="drawer-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>
                    {jobProgress !== null
                      ? `${t('vouchers.generating')} ${jobProgress}%`
                      : t('vouchers.generating')}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{t('vouchers.generateBtn')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
