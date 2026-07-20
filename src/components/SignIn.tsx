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
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', backgroundColor: 'var(--background)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--primary-rgb), 0.15) 0%, transparent 70%)', top: '-10%', right: '-10%', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)', bottom: '-10%', left: '-10%', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 24px', borderRadius: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-xl)', maxWidth: '400px', width: '100%', textAlign: 'center', zIndex: 1, boxSizing: 'border-box' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 8px 16px -4px rgba(var(--primary-rgb), 0.3)' }}>
          <Ticket size={28} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
        </div>
        <h1 style={{ fontSize: '23px', fontWeight: 850, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>MIKMAN</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>Sign in to access and manage your hotspot network gateway.</p>
        {error && (
          <div style={{ width: '100%', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '12.5px', color: 'var(--danger)', textAlign: 'left', lineHeight: 1.4, boxSizing: 'border-box' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleEmailAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', width: '100%', textAlign: 'left', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: focusedField === 'email' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', transition: 'color 0.2s' }}>
              <Mail size={18} />
            </span>
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
              disabled={authLoading || loading}
              style={{ width: '100%', height: '50px', padding: '0 16px 0 44px', borderRadius: '12px', border: '1.5px solid ' + (focusedField === 'email' ? 'var(--primary)' : 'var(--glass-border)'), backgroundColor: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '16px', fontWeight: '600', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }} />
          </div>
          <div style={{ position: 'relative', width: '100%', textAlign: 'left', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: focusedField === 'password' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', transition: 'color 0.2s' }}>
              <Lock size={18} />
            </span>
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
              disabled={authLoading || loading}
              style={{ width: '100%', height: '50px', padding: '0 16px 0 44px', borderRadius: '12px', border: '1.5px solid ' + (focusedField === 'password' ? 'var(--primary)' : 'var(--glass-border)'), backgroundColor: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '16px', fontWeight: '600', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={authLoading || loading}
            style={{ width: '100%', height: '50px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '750', cursor: (authLoading || loading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease', boxSizing: 'border-box', marginTop: '4px', boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.15)' }}>
            {authLoading ? (
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            ) : <span>Sign In</span>}
          </button>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', width: '100%' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--glass-border)' }} />
          <span style={{ padding: '0 12px', fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.8px' }}>or continue with</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--glass-border)' }} />
        </div>
        <button onClick={handleGoogleSignIn} disabled={loading || authLoading}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', height: '50px', backgroundColor: 'var(--input-bg)', border: '1.5px solid var(--glass-border)', borderRadius: '12px', color: 'var(--foreground)', fontSize: '15px', fontWeight: '600', cursor: (loading || authLoading) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', boxSizing: 'border-box' }}>
          {loading ? (
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#EA4335" d="M9 3.58c1.12 0 2.12.39 2.92 1.15l2.17-2.17C12.78.88 11 0 9 0 5.5 0 2.52 2 1.03 4.93l2.85 2.22C4.55 4.9 6.57 3.58 9 3.58z"/><path fill="#4285F4" d="M17.64 9.2c0-.62-.06-1.22-.16-1.8H9v3.4h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.78 2.16c1.63-1.5 2.57-3.71 2.57-6.46z"/><path fill="#FBBC05" d="M3.88 10.78a5.54 5.54 0 0 1 0-3.56L1.03 5A9 9 0 0 0 1 9a9 9 0 0 0 .03 4l2.85-2.22z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.78-2.16c-.77.52-1.76.83-3.18.83-2.43 0-4.45-1.32-5.18-3.56l-2.85 2.22C2.52 16 5.5 18 9 18z"/></svg>
              <span>Google</span>
            </>
          )}
        </button>
        <p style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>New user? Sign in with <strong style={{ color: 'var(--primary)' }}>Google</strong> to register.</p>
        <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '28px', marginBottom: 0 }}>Authorized access only. Security protocols active.</p>
      </div>
    </div>
  );
}