import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useSWR from 'swr';
import { fetchProfilesAPI, createVouchersAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

interface Profile {
  id: string;
  name?: string;
  validity?: string;
  limitMB?: number;
  isUnlimited?: boolean;
}
import {
  Layers,
  Ticket,
  KeyRound,
  Tag,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Clock,
  HardDrive,
  ExternalLink,
} from 'lucide-react';

export default function VouchersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();

  // Form State
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [countInput, setCountInput] = useState<string>('100');
  const [length, setLength] = useState<number>(6);
  const [comment, setComment] = useState<string>('');

  const count = useMemo(() => {
    const parsed = parseInt(countInput, 10);
    if (isNaN(parsed) || parsed < 1) return 1;
    if (parsed > 5000) return 5000;
    return parsed;
  }, [countInput]);

  // Status State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Profiles
  const { data: profilesData, isLoading: profilesLoading } = useSWR(
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

  const isProfilesLoading = profilesLoading || (profilesData === undefined && routerId !== undefined);

  // Auto-select first profile when loaded
  useEffect(() => {
    if (profileList.length > 0) {
      if (!selectedProfile || !profileList.some(p => (p.name || p.id) === selectedProfile)) {
        setSelectedProfile(profileList[0].name || profileList[0].id);
      }
    }
  }, [profileList, selectedProfile]);

  // Selected Profile Object
  const currentProfileObj = useMemo(() => {
    return profileList.find((p) => (p.name || p.id) === selectedProfile);
  }, [profileList, selectedProfile]);

  // Handle Form Submit
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routerId || !selectedProfile) {
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

    try {
      const res = await createVouchersAPI(
        routerId,
        selectedProfile,
        count,
        length,
        comment.trim() || undefined
      );

      setSuccessMsg(
        t('vouchers.doneGenerated')
          .replace('{count}', String(count))
          .replace('{profile}', selectedProfile)
      );

      // Brief delay then navigate directly to batch detail view
      setTimeout(() => {
        const params = new URLSearchParams();
        params.set('profile', selectedProfile);
        if (res?.batchId) params.set('batchId', res.batchId);
        if (comment.trim()) params.set('comment', comment.trim());
        navigate(`/${routerId}/batch/detail?${params.toString()}`);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to generate batch vouchers:', err);
      setErrorMsg(err?.message || t('vouchers.couldNotGenerate'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Styles ──

  const cardGlassStyle: React.CSSProperties = {
    background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.2s ease',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg, rgba(0, 0, 0, 0.2))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '10px',
    padding: `10px ${isRtl ? '34px' : '14px'} 10px ${isRtl ? '14px' : '34px'}`,
    color: 'var(--foreground)',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
  };

  // Preset Buttons
  const quantityPresets = [100, 500, 1000, 2000];
  const lengthPresets = [4, 5, 6, 7, 8];

  return (
    <div
      className="responsive-container"
      style={{
        maxWidth: '1000px',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* ─── Page Header ─── */}
      <div className="responsive-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.4) 100%)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
            flexShrink: 0
          }}>
            <Ticket size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('vouchers.generateBatchTitle')}
            </h2>
          </div>
        </div>

        <Link
          to={`/${routerId}/batch`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            background: 'var(--card-bg)',
            color: 'var(--primary, #3b82f6)',
            fontSize: '11px',
            fontWeight: '700',
            textDecoration: 'none',
            flexShrink: 0
          }}
        >
          <Layers size={13} />
          <span style={{ whiteSpace: 'nowrap' }}>{t('vouchers.batchPrint') || 'View Batches'}</span>
        </Link>
      </div>

      {/* Main Grid: Form Controls (Left/Main) & Ticket Live Preview (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left Card: Form Inputs */}
        <form onSubmit={handleGenerate} style={{ ...cardGlassStyle, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
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
                padding: '10px 14px',
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

          {/* 1. Profile Selector (with embedded icon & manage link) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
                {t('vouchers.profileLabel')}
              </label>
              <Link
                to={`/${routerId}/profiles`}
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--primary, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                <span>{t('vouchers.manageProfiles')}</span>
                <ExternalLink size={12} />
              </Link>
            </div>
            {isProfilesLoading ? (
              <div className="skeleton" style={{ width: '100%', height: '42px', borderRadius: '10px' }} />
            ) : (
              <div style={{ position: 'relative', width: '100%' }}>
                <Layers
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
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  disabled={isSubmitting}
                  style={selectStyle}
                  required
                >
                  {profileList.length === 0 ? (
                    <option value="">{t('vouchers.noProfilesFound')}</option>
                  ) : (
                    profileList.map((p) => (
                      <option key={p.id || p.name} value={p.name || p.id}>
                        {p.name || p.id} {p.validity ? `(${p.validity})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Profile Info Pills */}
            {currentProfileObj && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {currentProfileObj.validity && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: '#818cf8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Clock size={11} />
                    {currentProfileObj.validity}
                  </span>
                )}
                {currentProfileObj.limitMB ? (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(14, 165, 233, 0.12)',
                      color: '#0ea5e9',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <HardDrive size={11} />
                    {currentProfileObj.limitMB} MB
                  </span>
                ) : currentProfileObj.isUnlimited ? (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(34, 197, 94, 0.12)',
                      color: '#22c55e',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Zap size={11} />
                    Unlimited
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* 2. Voucher Quantity (with embedded icon & preset pills) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
              {t('vouchers.quantityLabel')}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Ticket
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
                inputMode="numeric"
                pattern="[0-9]*"
                value={countInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    setCountInput(val);
                  }
                }}
                onBlur={() => {
                  const num = parseInt(countInput, 10);
                  if (isNaN(num) || num < 1) {
                    setCountInput('1');
                  } else if (num > 5000) {
                    setCountInput('5000');
                  }
                }}
                disabled={isSubmitting}
                style={inputStyle}
                required
              />
            </div>
            {/* Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {quantityPresets.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setCountInput(String(q))}
                  style={{
                    padding: '3px 9px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                    background: count === q ? 'var(--primary, #3b82f6)' : 'rgba(0, 0, 0, 0.15)',
                    color: count === q ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Code Length (with embedded icon & preset pills) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
              {t('vouchers.lengthLabel')}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <KeyRound
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
                type="number"
                min={3}
                max={16}
                value={length}
                onChange={(e) => setLength(Math.max(3, Math.min(16, parseInt(e.target.value) || 6)))}
                disabled={isSubmitting}
                style={inputStyle}
                required
              />
            </div>
            {/* Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {lengthPresets.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLength(l)}
                  style={{
                    padding: '3px 9px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                    background: length === l ? 'var(--primary, #3b82f6)' : 'rgba(0, 0, 0, 0.15)',
                    color: length === l ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {l} {t('vouchers.digits')}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Batch Print Label / Comment (with embedded icon) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
              {t('vouchers.batchNameLabel')}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Tag
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
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('vouchers.batchNamePlaceholder')}
                disabled={isSubmitting}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || profilesLoading || !selectedProfile}
            style={{
              marginTop: '8px',
              padding: '12px 20px',
              border: 'none',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              opacity: isSubmitting || !selectedProfile ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{t('vouchers.generating')}</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>{t('vouchers.generateBtn')}</span>
              </>
            )}
          </button>
        </form>

        {/* Right Card: Live Ticket Preview */}
        <div style={{ ...cardGlassStyle, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} style={{ color: 'var(--primary, #3b82f6)' }} />
              {t('vouchers.ticketPreview')}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#22c55e',
              }}
            >
              {t('vouchers.liveMock')}
            </span>
          </div>

          {/* Ticket Print Card Mockup (Matches Actual Print Voucher Design) */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {t('vouchers.printLayoutNotice')}
            </span>

            {/* Single Print Ticket Replica */}
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
                fontFamily: "'Cairo', system-ui, -apple-system, sans-serif",
              }}
            >
              {/* Top: Wifi Icon + WiFi Network / Comment */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#000000',
                  width: '100%',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  direction: isRtl ? 'rtl' : 'ltr',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                  <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                  <line x1="12" y1="20" x2="12.01" y2="20"></line>
                </svg>
                <span>{comment.trim() || t('vouchers.defaultHotspotName')}</span>
              </div>

              {/* Middle: PIN / Code */}
              <div
                style={{
                  fontSize: length > 8 ? '14px' : '17px',
                  fontWeight: 800,
                  color: '#000000',
                  letterSpacing: '1px',
                  lineHeight: 1,
                  direction: 'ltr',
                  fontFamily: 'monospace, system-ui',
                }}
              >
                {'9'.repeat(Math.ceil(length / 2)) + '4'.repeat(Math.floor(length / 2))}
              </div>

              {/* Bottom: Profile Name */}
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#333333',
                  width: '100%',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.1,
                  direction: isRtl ? 'rtl' : 'ltr',
                }}
              >
                {selectedProfile}
              </div>
            </div>
          </div>

          {/* Batch Summary Stats List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('vouchers.summaryTotal')}</span>
              <strong style={{ color: 'var(--foreground)' }}>{count} {t('vouchers.vouchersUnit')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('vouchers.summaryProfile')}</span>
              <strong style={{ color: 'var(--primary, #3b82f6)' }}>{selectedProfile || '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('vouchers.summaryCodeFormat')}</span>
              <strong style={{ color: 'var(--foreground)' }}>{length} {t('vouchers.digitsFormat')}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}