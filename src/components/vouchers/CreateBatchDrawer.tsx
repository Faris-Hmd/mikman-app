import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, X, ChevronDown, Tag, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { createVouchersAPI, fetchVoucherJobStatusAPI, type VoucherBatch } from '../../api';
import type { Profile } from './types';
import { getProfileInfoDetails } from './voucherHelpers';

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
        setSuccessMsg(
          t('vouchers.pushingToRouter') ||
            (isRtl ? 'جاري كتابة الكروت في الراوتر...' : 'Pushing vouchers to router...')
        );
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
        style={{
          direction: isRtl ? 'rtl' : 'ltr',
          borderLeft: isRtl ? 'none' : '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
          borderRight: isRtl ? '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Drag Handle for Mobile */}
        <div className="sheet-drag-handle" style={{ margin: '8px auto 2px auto' }} />

        {/* Drawer Header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
              {t('vouchers.generateBatchTitle') || 'إنشاء دفعة كروت جديدة'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--foreground)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Form */}
        <form onSubmit={handleGenerateBatch} className="drawer-form-container">
          <div className="drawer-form-body">
            {errorMsg && (
              <div
                style={{
                  background: '#ef4444',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  background: '#16a34a',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 1. Profile Dropdown Menu */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.profileLabel') || 'البروفايل (باقة الكروت)'}
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={createProfile}
                  onChange={(e) => setCreateProfile(e.target.value)}
                  className="drawer-select-field"
                  style={{
                    padding: isRtl ? '0 12px 0 32px' : '0 32px 0 12px',
                  }}
                >
                  <option value="" disabled style={{ background: '#1e293b', color: '#94a3b8' }}>
                    {t('vouchers.selectProfile') || 'اختر باقة الكروت...'}
                  </option>
                  {profileList.map((p) => {
                    const pName = p.name || p.id;
                    const pInfo = getProfileInfoDetails(pName, profileList);
                    const details = [pInfo.validity, pInfo.dataLimit].filter(Boolean).join(' • ');
                    return (
                      <option
                        key={pName}
                        value={pName}
                        style={{ background: '#1e293b', color: '#ffffff', fontWeight: 600 }}
                      >
                        {pName} {details ? `(${details})` : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown
                  size={15}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    [isRtl ? 'left' : 'right']: '12px',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* 2. Voucher Quantity: Wide Input Field + Predefined Dropdown Beside It */}
            <div className="drawer-field-group">
              <label className="drawer-field-label">
                {t('vouchers.quantityLabel') || 'عدد الكروت'}
              </label>
              <div className="drawer-input-row">
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={countInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setCountInput(val);
                    }}
                    placeholder={t('vouchers.quantityLabel') || 'أدخل عدد الكروت'}
                    className="drawer-input-field"
                    style={{
                      fontWeight: 800,
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
                      fontSize: '12px',
                      padding: isRtl ? '0 10px 0 28px' : '0 28px 0 10px',
                    }}
                  >
                    <option value="" disabled style={{ background: '#1e293b', color: '#94a3b8' }}>
                      كمية محددة...
                    </option>
                    {[50, 100, 250, 500, 1000, 2000].map((q) => (
                      <option
                        key={q}
                        value={String(q)}
                        style={{ background: '#1e293b', color: '#ffffff', fontWeight: 600 }}
                      >
                        {q} كرت
                      </option>
                    ))}
                    <option
                      value="custom"
                      style={{ background: '#1e293b', color: '#60a5fa', fontWeight: 700 }}
                    >
                      مخصص
                    </option>
                  </select>
                  <ChevronDown
                    size={14}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      [isRtl ? 'left' : 'right']: '10px',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Code Length Segmented Bar */}
            <div className="drawer-field-group">
              <div className="drawer-field-header">
                <label className="drawer-field-label">
                  {t('vouchers.lengthLabel') || 'طول كود الـ PIN'}
                </label>
                <span className="drawer-field-badge">
                  {length} {t('vouchers.digits') || 'أرقام'}
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
                {t('vouchers.batchNameLabel') || 'اسم الدفعة / ملاحظة (اختياري)'}
              </label>
              <div style={{ position: 'relative' }}>
                <Tag
                  size={14}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    [isRtl ? 'right' : 'left']: '10px',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    t('vouchers.batchNamePlaceholder') || 'مثال: عروض الصيف، شبكة ضيوف...'
                  }
                  className="drawer-input-field"
                  style={{
                    padding: `0 ${isRtl ? '30px' : '10px'} 0 ${isRtl ? '10px' : '30px'}`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div
            className="create-batch-drawer-footer"
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              background: 'var(--card-bg, #1a1a1a)',
              borderTop: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {jobProgress !== null && (
              <div
                style={{
                  width: '100%',
                  height: '3px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
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
                  <span>{t('vouchers.generateBtn') || 'إنشاء الكروت الآن'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
