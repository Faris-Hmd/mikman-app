import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModal } from '../context/ModalContext';
import { supabase } from '../lib/supabase';
import useSWR from 'swr';
import { fetchUserSubscriptionHistoryAPI, fetchPlansCatalogAPI, fetchRouterProfilesWithUserAPI, SubscriptionHistoryEntry, PlanCatalogItem } from '../api';
import { User, ShieldCheck, Clock, CreditCard, History, Calendar, AlertTriangle, KeyRound, Eye, EyeOff, Lock, CheckCircle2, LogOut } from 'lucide-react';
import LogoutConfirmModal from '../components/auth/LogoutConfirmModal';
import './Account.css';

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
  useSWR('router-profiles-user', fetchRouterProfilesWithUserAPI);
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
    <div className={`account-container ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Compact Page Header */}
      <div className="account-header-card responsive-card">
        <div className="account-user-info">
          <div className="account-user-avatar">
            <User size={20} />
          </div>
          <div className="account-user-text">
            <h1 className="account-user-name">
              {userData?.name || user?.email?.split('@')[0] || t('accountPage.title')}
            </h1>
            <span className="account-user-email">
              {user?.email}
            </span>
          </div>
        </div>

        {/* Account Status Badge */}
        <div className="account-header-badges">
          {isBanned && (
            <span className="account-status-tag banned">
              <AlertTriangle size={13} /> {t('accountPage.bannedAccount')}
            </span>
          )}
          {isExpired && !isBanned && (
            <span className="account-status-tag expired">
              <Clock size={13} /> {t('accountPage.subscriptionExpired')}
            </span>
          )}
          {isActive && (
            <span className="account-status-tag active">
              <ShieldCheck size={13} /> {t('accountPage.activeAccount')}
            </span>
          )}

          {/* Sign Out Button (Solid Red High Contrast) */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="account-signout-btn"
            title={t('sidebar.signOut')}
          >
            <LogOut size={14} />
            <span>{t('sidebar.signOut')}</span>
          </button>
        </div>
      </div>

      {/* Grid: Plan & Remaining Time Overview */}
      <div className="account-overview-grid">
        {/* Card 1: Current Plan */}
        <div className="responsive-card account-card-content">
          <div className="account-card-header">
            <span className="account-card-title">
              <CreditCard size={14} color="var(--primary)" /> {t('accountPage.currentPlan')}
            </span>
            <span className="account-quota-tag">
              {userData?.quota || 'free'}
            </span>
          </div>

          <div>
            <h3 className="account-plan-name">
              {formatPlanName(userData?.quota, isRtl, plansCatalog, userData?.maxRouters)}
            </h3>
            <p className="account-plan-subtitle">
              {t('accountPage.maxRouterLimit').replace('{count}', String(userData?.maxRouters ?? 1))}
            </p>
          </div>

          <button
            onClick={() => navigate('/plans')}
            className="account-btn-blue"
          >
            <CreditCard size={14} />
            <span>{t('accountPage.upgradeOrChangePlan')}</span>
          </button>
        </div>

        {/* Card 2: Remaining Time */}
        <div className="responsive-card account-card-content">
          <div className="account-card-header">
            <span className="account-card-title">
              <Clock size={14} color="var(--warning)" /> {t('accountPage.remainingTime')}
            </span>
          </div>

          <div>
            <div className={`account-days-display ${isExpired ? 'expired' : ''}`}>
              {isExpired ? '0 Days' : `${remainingDays} ${isRtl ? 'أيام' : 'Days'}`}
            </div>
            <p className="account-expires-date">
              <Calendar size={12} /> {t('accountPage.expiresOn').replace('{date}', formatDate(userData?.expiresAt))}
            </p>
          </div>

          <div className="account-progress-track">
            <div
              className={`account-progress-fill ${isExpired ? 'expired' : ''}`}
              style={{
                ['--progress' as any]: isExpired ? '100%' : `${Math.min(100, (remainingDays / 30) * 100)}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Password Management Form Card */}
      <div className="responsive-card account-password-card">
        <div className="account-password-header">
          <div className="flex items-center gap-2">
            <div className={`account-password-icon ${hasPasswordState ? 'is-set' : 'is-unset'}`}>
              <KeyRound size={16} />
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-bold text-foreground m-0">
                {hasPasswordState
                  ? (t('accountPage.changePasswordTitle') || 'Change Password')
                  : (t('accountPage.setPasswordTitle') || 'Set Account Password')}
              </h2>
              <p className="text-[11px] text-muted m-0">
                {hasPasswordState
                  ? (t('accountPage.changePasswordDesc') || 'Update your account password to maintain security.')
                  : (t('accountPage.setPasswordDesc') || 'Set a password for your account to log in easily.')}
              </p>
            </div>
          </div>

          <span className={`account-password-badge ${hasPasswordState ? 'is-set' : 'is-unset'}`}>
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
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5 text-xs text-foreground flex items-center gap-2.5 mb-3">
            <AlertTriangle size={16} color="var(--warning)" className="flex-shrink-0" />
            <span>
              {t('accountPage.noPasswordBanner') ||
                (isRtl
                  ? 'أنت مسجل الدخول حالياً عبر Google أو الروابط المؤقتة. يرجى تعيين كلمة مرور أدناه لتتمكن من الدخول بالبريد الإلكتروني وكلمة المرور مباشرة.'
                  : 'You are currently using Google / Passwordless login. Set a password below to enable logging in with your email and password directly.')}
            </span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <div className="account-form-grid">
            {/* New Password Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted">
                {t('accountPage.newPasswordLabel') || 'New Password'}
              </label>
              <div className="account-input-group">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="account-input"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`account-input-eye ${isRtl ? 'rtl' : 'ltr'}`}
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted">
                {t('accountPage.confirmPasswordLabel') || 'Confirm New Password'}
              </label>
              <div className="account-input-group">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="account-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`account-input-eye ${isRtl ? 'rtl' : 'ltr'}`}
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingPassword}
              className="account-save-pwd-btn"
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
        <div className="account-history-header">
          <h2 className="text-sm font-bold text-foreground m-0 flex items-center gap-1.5">
            <History size={16} color="var(--primary)" /> {t('accountPage.subscriptionHistory')}
          </h2>
          <span className="text-[11px] text-muted font-mono">
            {t('accountPage.eventsCount').replace('{count}', String(history.length))}
          </span>
        </div>

        {loadingHistory ? (
          <div className="py-6 text-center text-xs text-muted">
            {t('accountPage.loadingHistory')}
          </div>
        ) : history.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted italic">
            {t('accountPage.noHistory')}
          </div>
        ) : (
          <div className="account-history-list">
            {history.map((log, idx) => (
              <div key={log.id || idx} className="account-history-item">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-foreground">
                    {log.action}
                  </span>
                  {log.details && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                      {log.details.plan && (
                        <span>{t('accountPage.plan')} <strong className="text-primary">{formatPlanName(log.details.plan, isRtl, plansCatalog, log.details.max_routers)}</strong></span>
                      )}
                      {log.details.max_routers !== undefined && (
                        <span>{t('accountPage.routers')} <strong className="text-foreground">{log.details.max_routers}</strong></span>
                      )}
                      {log.details.days_added !== undefined && (
                        <span>{t('accountPage.added')} <strong className="text-emerald-500">+{log.details.days_added} {isRtl ? 'أيام' : 'Days'}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                <div className="account-history-time">
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
