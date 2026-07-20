import React, { useState } from 'react';
import { Ticket, Mail, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

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
      setError(err.message || 'An error occurred during Google sign-in.');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setAuthLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err: any) {
      console.error("Email auth error:", err);
      let errMsg = err.message || 'An error occurred during authentication.';
      if (errMsg.includes('Invalid login credentials')) errMsg = 'Incorrect email or password.';
      else if (errMsg.includes('Email not confirmed')) errMsg = 'Please verify your email before signing in.';
      setError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-dvh bg-[var(--background)] p-6 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(var(--primary-rgb),0.15)_0%,transparent_70%)] -top-[10%] -right-[10%] z-0 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.1)_0%,transparent_70%)] -bottom-[10%] -left-[10%] z-0 pointer-events-none" />
      
      <div className="flex flex-col items-center p-9 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[20px] max-w-[400px] w-full text-center z-[1] box-border">
        <div className="w-14 h-14 rounded-xl bg-[var(--primary)] flex items-center justify-center mb-5 shadow-[0_8px_16px_-4px_rgba(var(--primary-rgb),0.3)]">
          <Ticket size={28} color="#fff" className="-rotate-45" />
        </div>
        
        <h1 className="text-[23px] font-[850] text-[var(--foreground)] m-0 mb-1.5 tracking-tight">MIKMAN</h1>
        <p className="text-[var(--text-base)] text-[var(--text-muted)] m-0 mb-6 leading-relaxed">
          Sign in to access and manage your hotspot network gateway.
        </p>

        {error && (
          <div className="w-full bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] rounded-xl p-3 mb-5 text-[12.5px] text-[#ef4444] text-left leading-relaxed box-border">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3 box-border">
          <div className="relative w-full text-left box-border">
            <span className={`absolute left-[14px] top-1/2 -translate-y-1/2 flex transition-colors duration-200 ${focusedField === 'email' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              <Mail size={18} />
            </span>
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
              disabled={authLoading || loading}
              className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border-[1.5px] border-[var(--glass-border)] bg-[var(--input-bg)] text-[var(--foreground)] text-base font-semibold outline-none transition-all duration-200 box-border focus:border-[var(--primary)] disabled:opacity-50" />
          </div>

          <div className="relative w-full text-left box-border">
            <span className={`absolute left-[14px] top-1/2 -translate-y-1/2 flex transition-colors duration-200 ${focusedField === 'password' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              <Lock size={18} />
            </span>
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
              disabled={authLoading || loading}
              className="w-full h-[50px] pl-[44px] pr-4 rounded-xl border-[1.5px] border-[var(--glass-border)] bg-[var(--input-bg)] text-[var(--foreground)] text-base font-semibold outline-none transition-all duration-200 box-border focus:border-[var(--primary)] disabled:opacity-50" />
          </div>

          <button type="submit" disabled={authLoading || loading}
            className="w-full h-[50px] bg-[var(--primary)] text-white border-none rounded-xl text-[15px] font-[750] cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 box-border mt-1 shadow-[0_4px_12px_rgba(var(--primary-rgb),0.15)] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[var(--primary-hover)]">
            {authLoading ? (
              <div className="w-[18px] h-[18px] rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : <span>Sign In</span>}
          </button>
        </form>

        <div className="flex items-center my-5 w-full">
          <div className="flex-1 h-px bg-[var(--glass-border)]" />
          <span className="px-3 text-[10.5px] text-[var(--text-muted)] font-[850] uppercase tracking-[0.8px]">or continue with</span>
          <div className="flex-1 h-px bg-[var(--glass-border)]" />
        </div>

        <button onClick={handleGoogleSignIn} disabled={loading || authLoading}
          className="flex items-center justify-center gap-3 w-full h-[50px] bg-[var(--input-bg)] border-[1.5px] border-[var(--glass-border)] rounded-xl text-[var(--foreground)] text-[15px] font-semibold cursor-pointer transition-all duration-200 box-border disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[var(--secondary)] hover:border-[var(--primary)]">
          {loading ? (
            <div className="w-[18px] h-[18px] rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#EA4335" d="M9 3.58c1.12 0 2.12.39 2.92 1.15l2.17-2.17C12.78.88 11 0 9 0 5.5 0 2.52 2 1.03 4.93l2.85 2.22C4.55 4.9 6.57 3.58 9 3.58z"/><path fill="#4285F4" d="M17.64 9.2c0-.62-.06-1.22-.16-1.8H9v3.4h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.78 2.16c1.63-1.5 2.57-3.71 2.57-6.46z"/><path fill="#FBBC05" d="M3.88 10.78a5.54 5.54 0 0 1 0-3.56L1.03 5A9 9 0 0 0 1 9a9 9 0 0 0 .03 4l2.85-2.22z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.78-2.16c-.77.52-1.76.83-3.18.83-2.43 0-4.45-1.32-5.18-3.56l-2.85 2.22C2.52 16 5.5 18 9 18z"/></svg>
              <span>Google</span>
            </>
          )}
        </button>

        <p className="mt-6 text-[var(--text-base)] text-[var(--text-muted)]">
          New user? Sign in with <strong className="text-[var(--primary)]">Google</strong> to register.
        </p>
        <p className="text-[10.5px] text-[var(--text-muted)] mt-7 mb-0">
          Authorized access only. Security protocols active.
        </p>
      </div>
    </div>
  );
}