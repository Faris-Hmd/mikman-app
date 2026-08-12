import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModal } from '../context/ModalContext';
import { supabase } from '../lib/supabase';
import useSWR from 'swr';
import { fetchUserSubscriptionHistoryAPI, fetchPlansCatalogAPI, SubscriptionHistoryEntry, PlanCatalogItem } from '../api';
import { User, ShieldCheck, Clock, CreditCard, History, MessageCircle, Calendar, AlertTriangle, KeyRound, Eye, EyeOff, Lock, CheckCircle2, LogOut } from 'lucide-react';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

const WHATSAPP_NUMBER = '249966626693';

function formatPlanName(quota?: string, isRtl = false, plansCatalog?: PlanCatalogItem[], maxRouters?: number): string {
  if (!quota) return isRtl ? 'تجريبي مجاني' : 'Free Trial';
  const q = quota.toLowerCase().trim();
  if (q === 'free') return isRtl ? 'تجريبي مجاني (7 أيام)' : 'Free Trial (7 Days)';

  const matched = plansCatalog?.find(p => p.id.toLowerCase() === q);
  const title = matched ? (isRtl && matched.nameAr ? matched.nameAr : matched.name) : `${q.charAt(0).toUpperCase() + q.slice(1)} Plan`;
  const limit = maxRouters ?? matched?.maxRouters ?? 1;
  const routerText = isRtl ? (limit === 1 ? 'راوتر واحد' : `${limit} راوترات`) : (limit === 1 ? '1 Router' : `${limit} Routers`);
  return `${title} (${routerText})`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, userData, accountInfo } = useAuth();
  const { t, isRtl } = useLanguage();
  const { showAlert } = useModal();
  const { data: plansCatalog } = useSWR('plans-catalog', fetchPlansCatalogAPI);
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Password reset / set state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [hasPasswordState, setHasPasswordState] = useState<boolean>(!!userData?.hasPassword);

  useEffect(() => {
    if (userData?.hasPassword !== undefined) {
      setHasPasswordState(!!userData.hasPassword);
    }
  }, [userData]);

  useEffect(() => {
    fetchUserSubscriptionHistoryAPI()
      .then(logs => setHistory(logs))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  const remainingDays = accountInfo?.remainingTime
    ? Math.max(0, Math.ceil(accountInfo.remainingTime / (24 * 3600)))
    : 0;

  const isBanned = accountInfo?.subscriptionState === 'banned' || userData?.approved === false;
  const isExpired = accountInfo?.subscriptionState === 'expired';
  const isActive = accountInfo?.subscriptionState === 'active' && !isBanned;

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent(
      `Hello MikMan Support, I have an inquiry regarding my subscription.\nEmail: ${user?.email || ''}\nCurrent Plan: ${formatPlanName(userData?.quota, isRtl, plansCatalog, userData?.maxRouters)}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      showAlert(
        t('accountPage.passwordMinLength') || 'Password must be at least 6 characters long.',
        '',
        'error'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert(
        t('accountPage.passwordMismatch') || 'Passwords do not match.',
        '',
        'error'
      );
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      setHasPasswordState(true);
      setNewPassword('');
      setConfirmPassword('');
      showAlert(
        t('accountPage.passwordSuccess') || 'Password updated successfully!',
        '',
        'success'
      );
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      showAlert(
        (t('accountPage.passwordError') || 'Failed to update password: {error}').replace('{error}', errMsg),
        '',
        'error'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} style={{ padding: '16px 20px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Compact Page Header */}
      <div
        className="responsive-card"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(var(--primary-rgb, 99, 102, 241), 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <User size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>
              {userData?.name || user?.email?.split('@')[0] || t('accountPage.title')}
            </h1>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono, monospace)' }}>
              {user?.email}
            </span>
          </div>
        </div>

        {/* Account Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isBanned && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <AlertTriangle size={13} /> {t('accountPage.bannedAccount')}
            </span>
          )}
          {isExpired && !isBanned && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Clock size={13} /> {t('accountPage.subscriptionExpired')}
            </span>
          )}
          {isActive && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <ShieldCheck size={13} /> {t('accountPage.activeAccount')}
            </span>
          )}

          {/* Sign Out Button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={t('sidebar.signOut')}
          >
            <LogOut size={14} />
            <span>{t('sidebar.signOut')}</span>
          </button>
        </div>
      </div>

      {/* Grid: Plan & Remaining Time Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Card 1: Current Plan */}
        <div
          className="responsive-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CreditCard size={14} style={{ color: 'var(--primary)' }} /> {t('accountPage.currentPlan')}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.25)', textTransform: 'uppercase' }}>
              {userData?.quota || 'free'}
            </span>
          </div>

          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>
              {formatPlanName(userData?.quota, isRtl, plansCatalog, userData?.maxRouters)}
            </h3>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              {t('accountPage.maxRouterLimit').replace('{count}', String(userData?.maxRouters ?? 1))}
            </p>
          </div>

          <button
            onClick={() => navigate('/plans')}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(var(--primary-rgb, 99, 102, 241), 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <CreditCard size={14} />
            <span>{t('accountPage.upgradeOrChangePlan')}</span>
          </button>
        </div>

        {/* Card 2: Remaining Time */}
        <div
          className="responsive-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={14} style={{ color: '#f59e0b' }} /> {t('accountPage.remainingTime')}
            </span>
          </div>

          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: isExpired ? '#ef4444' : 'var(--foreground)' }}>
              {isExpired ? '0 Days' : `${remainingDays} ${isRtl ? 'أيام' : 'Days'}`}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} /> {t('accountPage.expiresOn').replace('{date}', formatDate(userData?.expiresAt))}
            </p>
          </div>

          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--input-bg, rgba(255,255,255,0.08))', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: isExpired ? '#ef4444' : 'var(--primary)',
                width: isExpired ? '100%' : `${Math.min(100, (remainingDays / 30) * 100)}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Password Management Form Card */}
      <div
        className="responsive-card"
        style={{
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: hasPasswordState ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: hasPasswordState ? '#10b981' : '#f59e0b',
              }}
            >
              <KeyRound size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>
                {hasPasswordState
                  ? (t('accountPage.changePasswordTitle') || 'Change Password')
                  : (t('accountPage.setPasswordTitle') || 'Set Account Password')}
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                {hasPasswordState
                  ? (t('accountPage.changePasswordDesc') || 'Update your account password to maintain security.')
                  : (t('accountPage.setPasswordDesc') || 'Set a password for your account to log in easily.')}
              </p>
            </div>
          </div>

          <span
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: '700',
              backgroundColor: hasPasswordState ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.15)',
              color: hasPasswordState ? '#10b981' : '#f59e0b',
              border: `1px solid ${hasPasswordState ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {hasPasswordState ? (
              <>
                <CheckCircle2 size={12} />
                <span>{isRtl ? 'كلمة المرور مجهزة' : 'Password Configured'}</span>
              </>
            ) : (
              <>
                <AlertTriangle size={12} />
                <span>{isRtl ? 'لم يتم تعيين كلمة مرور' : 'No Password Set'}</span>
              </>
            )}
          </span>
        </div>

        {!hasPasswordState && (
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: 'var(--foreground)',
              lineHeight: '1.45',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
            <span>
              {t('accountPage.noPasswordBanner') ||
                (isRtl
                  ? 'أنت مسجل الدخول حالياً عبر Google أو الروابط المؤقتة. يرجى تعيين كلمة مرور أدناه لتتمكن من الدخول بالبريد الإلكتروني وكلمة المرور مباشرة.'
                  : 'You are currently using Google / Passwordless login. Set a password below to enable logging in with your email and password directly.')}
            </span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* New Password Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                {t('accountPage.newPasswordLabel') || 'New Password'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    backgroundColor: 'var(--input-bg, rgba(255,255,255,0.04))',
                    color: 'var(--foreground)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: isRtl ? 'auto' : '10px',
                    left: isRtl ? '10px' : 'auto',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                {t('accountPage.confirmPasswordLabel') || 'Confirm New Password'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    backgroundColor: 'var(--input-bg, rgba(255,255,255,0.04))',
                    color: 'var(--foreground)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: isRtl ? 'auto' : '10px',
                    left: isRtl ? '10px' : 'auto',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="submit"
              disabled={savingPassword}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                fontWeight: '750',
                cursor: savingPassword ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: savingPassword ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(var(--primary-rgb, 99, 102, 241), 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              <Lock size={14} />
              <span>
                {savingPassword
                  ? (t('accountPage.savingPassword') || 'Updating password...')
                  : hasPasswordState
                  ? (t('accountPage.changePasswordBtn') || 'Update Password')
                  : (t('accountPage.setPasswordBtn') || 'Set Password')}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Subscription History Logs Section */}
      <div className="responsive-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <History size={16} style={{ color: 'var(--primary)' }} /> {t('accountPage.subscriptionHistory')}
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono, monospace)' }}>
            {t('accountPage.eventsCount').replace('{count}', String(history.length))}
          </span>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('accountPage.loadingHistory')}
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {t('accountPage.noHistory')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((log, idx) => (
              <div
                key={log.id || idx}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--input-bg, rgba(255,255,255,0.03))',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--foreground)' }}>
                    {log.action}
                  </span>
                  {log.details && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {log.details.plan && (
                        <span>{t('accountPage.plan')} <strong style={{ color: 'var(--primary)' }}>{formatPlanName(log.details.plan, isRtl, plansCatalog, log.details.max_routers)}</strong></span>
                      )}
                      {log.details.max_routers !== undefined && (
                        <span>{t('accountPage.routers')} <strong style={{ color: 'var(--foreground)' }}>{log.details.max_routers}</strong></span>
                      )}
                      {log.details.days_added !== undefined && (
                        <span>{t('accountPage.added')} <strong style={{ color: '#10b981' }}>+{log.details.days_added} {isRtl ? 'أيام' : 'Days'}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-family-mono, monospace)',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {formatDate(log.created_at || log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLogoutModal && <LogoutConfirmModal onClose={() => setShowLogoutModal(false)} />}
    </div>
  );
}