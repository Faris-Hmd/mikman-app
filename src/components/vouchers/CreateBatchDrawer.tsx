import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, X, ChevronDown, Tag, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { type VoucherBatch } from '../../api';
import type { Profile } from './types';

export interface CreateBatchPayload {
  profile: string;
  count: number;
  userLength: number;
  comment?: string;
}

interface CreateBatchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  onCreateBatch: (
    payload: CreateBatchPayload,
    onProgress: (pct: number) => void
  ) => Promise<{ newBatch: VoucherBatch; pins?: string[] }>;
  onSuccess: (newBatch: VoucherBatch, pins?: string[]) => void;
}

export const CreateBatchDrawer: React.FC<CreateBatchDrawerProps> = ({
  isOpen,
  onClose,
  profiles,
  onCreateBatch,
  onSuccess,
}) => {
  const { t, isRtl } = useLanguage();

  const [createProfile, setCreateProfile] = useState<string>('');
  const [countInput, setCountInput] = useState<string>('100');
  const [length, setLength] = useState<number>(6);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [jobProgress, setJobProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const profileList = profiles;

  // Auto select initial profile
  useEffect(() => {
    if (profileList.length > 0 && !createProfile) {
      setCreateProfile(profileList[0].name || profileList[0].id || '');
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
    if (!createProfile) {
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
      const result = await onCreateBatch(
        {
          profile: createProfile,
          count,
          userLength: length,
          comment: comment.trim() || undefined,
        },
        (pct) => setJobProgress(pct)
      );

      setSuccessMsg(
        t('vouchers.doneGenerated')
          .replace('{count}', String(count))
          .replace('{profile}', createProfile)
      );
      setJobProgress(100);

      setTimeout(() => {
        onSuccess(result.newBatch, result.pins);
        onClose();
        setIsSubmitting(false);
        setJobProgress(null);
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
      className="create-batch-drawer-overlay drawer-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="create-batch-drawer-content"
        dir={isRtl ? 'rtl' : 'ltr'}
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

        {/* Form Body */}
        <form onSubmit={handleGenerateBatch} className="drawer-form-body">
          {errorMsg && (
            <div className="drawer-error-banner">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="drawer-success-banner">
              <CheckCircle2 size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="drawer-fields-container">
            {/* 1. Profile Dropdown */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.profileLabel')}
              </label>
              <div className="drawer-select-wrapper">
                <select
                  value={createProfile}
                  onChange={(e) => setCreateProfile(e.target.value)}
                  className="drawer-select-field drawer-input-with-chevron"
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
                  className="drawer-select-chevron drawer-chevron-pos"
                />
              </div>
            </div>

            {/* 2. Voucher Quantity */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.quantityLabel')}
              </label>
              <div className="drawer-input-row">
                <div className="flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={countInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setCountInput(val);
                    }}
                    placeholder={t('vouchers.enterQuantity')}
                    className="drawer-input-field input-pad-horizontal"
                  />
                </div>

                <div className="drawer-prefix-group">
                  <select
                    value={[50, 100, 250, 500, 1000, 2000].includes(count) ? String(count) : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'custom') {
                        setCountInput(val);
                      }
                    }}
                    className="drawer-select-field drawer-input-with-chevron"
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
                    className="drawer-select-chevron drawer-chevron-pos"
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
                  className="vouchers-search-icon drawer-custom-pos"
                />
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('vouchers.batchNamePlaceholder')}
                  className="drawer-input-field drawer-input-with-custom"
                />
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="create-batch-drawer-footer">
            {jobProgress !== null && (
              <div className="drawer-progress-container">
                <div className="drawer-progress-bar">
                  <div
                    className="drawer-progress-fill progress-bar-fill"
                    style={{ width: `${jobProgress}%` }}
                  />
                </div>
                <div className="drawer-progress-text">
                  {jobProgress}% {t('vouchers.generating')}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !createProfile}
              className="drawer-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('vouchers.generating')}</span>
                </>
              ) : (
                <span>{t('vouchers.generateBtn')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
