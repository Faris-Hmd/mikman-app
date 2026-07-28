import React, { useState, useEffect } from 'react';
import { Ticket, Mail, Lock, ShieldCheck, Sun, Moon, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function SignIn() {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const storedTheme = (localStorage.getItem('@theme') as 'dark' | 'light') || 'dark';
    setTheme(storedTheme);
    if (storedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('@theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      console.error("Sign-in error:", err);
      setError(err.message || t('auth.errorOccurred'));
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }
    setAuthLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err: any) {
      console.error("Email auth error:", err);
      let errMsg = err.message || t('auth.errorOccurred');
      if (errMsg.includes('Invalid login credentials')) errMsg = t('auth.invalidCredentials');
      else if (errMsg.includes('Email not confirmed')) errMsg = t('auth.emailNotConfirmed');
      setError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex flex-col justify-center items-center min-h-dvh bg-[var(--background)] p-4 sm:p-6 relative overflow-hidden select-none"
    >
      {/* Top Toggles Bar (Language & Theme) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
        {/* Language Toggle */}
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--card-bg)] text-[var(--foreground)] text-xs font-bold cursor-pointer hover:bg-[var(--secondary)] transition-all shadow-sm"
          title="Switch Language"
        >
          <Globe size={14} className="text-[var(--primary)]" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--glass-border)] bg-[var(--card-bg)] text-[var(--foreground)] cursor-pointer hover:bg-[var(--secondary)] transition-all shadow-sm"
          title={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
        >
          {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
        </button>
      </div>

      {/* Background ambient glowing Orbs */}
      <div className="absolute w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(var(--primary-rgb),0.18)_0%,transparent_70%)] -top-[12%] -right-[8%] z-0 pointer-events-none blur-xl animate-pulse" />
      <div className="absolute w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)] -bottom-[12%] -left-[8%] z-0 pointer-events-none blur-2xl" />

      {/* Card Container */}
      <div
        className="relative flex flex-col items-center p-7 sm:p-9 rounded-3xl border border-[var(--glass-border)] bg-[var(--card-bg)] backdrop-blur-2xl max-w-[420px] w-full text-center z-10 box-border shadow-[0_20px_50px_rgba(0,0,0,0.25)] before:absolute before:top-0 before:left-6 before:right-6 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-[var(--primary)]/40 before:to-transparent"
      >
        {/* Brand Logo Header */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2563eb] to-[#3b82f6] flex items-center justify-center mb-4 shadow-[0_8px_20px_-4px_rgba(37,99,235,0.5)] border border-white/20">
          <Ticket size={28} color="#ffffff" className="-rotate-45 stroke-[2.2]" />
        </div>

        <h1 className="text-2xl sm:text-[26px] font-[900] text-[var(--foreground)] m-0 mb-1.5 tracking-tight">
          MIKMAN
        </h1>
        <p className="text-[13.5px] text-[var(--text-muted)] m-0 mb-6 leading-relaxed max-w-[310px]">
          {t('auth.signInSubtitle')}
        </p>

        {error && (
          <div className="w-full bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-xl p-3.5 mb-5 text-[12.5px] text-[#ef4444] text-start leading-relaxed box-border font-medium flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] mt-1.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3.5 box-border">
          {/* Email Input */}
          <div className="relative w-full text-start box-border">
            <span className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 flex transition-colors duration-200 ${focusedField === 'email' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              <Mail size={18} />
            </span>
            <input
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              disabled={authLoading || loading}
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--foreground)',
                borderColor: focusedField === 'email' ? 'var(--primary)' : 'var(--glass-border)',
              }}
              className={`w-full h-12 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} rounded-xl border text-[14.5px] font-semibold outline-none transition-all duration-200 box-border disabled:opacity-50`}
            />
          </div>

          {/* Password Input */}
          <div className="relative w-full text-start box-border">
            <span className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 flex transition-colors duration-200 ${focusedField === 'password' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              <Lock size={18} />
            </span>
            <input
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              disabled={authLoading || loading}
              style={{
                backgroundColor: 'var(--input-bg)',
                color: 'var(--foreground)',
                borderColor: focusedField === 'password' ? 'var(--primary)' : 'var(--glass-border)',
              }}
              className={`w-full h-12 ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} rounded-xl border text-[14.5px] font-semibold outline-none transition-all duration-200 box-border disabled:opacity-50`}
            />
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={authLoading || loading}
            style={{
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              boxShadow: '0 6px 20px -4px rgba(var(--primary-rgb), 0.45)',
            }}
            className="w-full h-12 border-none rounded-xl text-[14.5px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 box-border mt-1 disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90 active:scale-[0.98]"
          >
            {authLoading ? (
              <div className="w-4.5 h-4.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span>{t('auth.signInBtn')}</span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-5 w-full gap-3">
          <div className="flex-1 h-px bg-[var(--glass-border)]" />
          <span className="text-[10px] text-[var(--text-muted)] font-extrabold uppercase tracking-wider">
            {t('auth.orContinueWith')}
          </span>
          <div className="flex-1 h-px bg-[var(--glass-border)]" />
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          style={{
            backgroundColor: 'var(--input-bg)',
            color: 'var(--foreground)',
            borderColor: 'var(--glass-border)',
          }}
          className="flex items-center justify-center gap-3 w-full h-12 font-bold text-[14px] rounded-xl border shadow-sm hover:border-[var(--primary)]/50 active:scale-[0.98] transition-all duration-200 box-border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <div className="w-4.5 h-4.5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t('auth.googleBtn')}</span>
            </>
          )}
        </button>

        <p className="mt-5 text-xs text-[var(--text-muted)] font-medium">
          {isRtl ? (
            <>مستخدم جديد؟ سجّل الدخول بواسطة <strong className="text-[var(--primary)] font-bold">Google</strong> لإنشاء حساب.</>
          ) : (
            <>New user? Sign in with <strong className="text-[var(--primary)] font-bold">Google</strong> to register.</>
          )}
        </p>

        <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-[var(--text-muted)] mt-6 opacity-75">
          <ShieldCheck size={13} className="text-[var(--primary)]" />
          <span>{t('auth.securityNotice')}</span>
        </div>
      </div>
    </div>
  );
}