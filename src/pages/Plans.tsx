import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { Ticket, LogOut } from 'lucide-react';

export default function PlansPage() {
  const { user, accountInfo } = useAuth();
  const { t } = useLanguage();

  const isUnapproved = accountInfo?.subscriptionState === 'unapproved';
  const isExpired = accountInfo?.subscriptionState === 'expired';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', backgroundColor: 'var(--background)', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '32px', borderRadius: '16px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--card-bg)', maxWidth: '380px', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.3)' }}>
            <Ticket size={24} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--foreground)', margin: 0 }}>MIKMAN</h1>
            <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>Cloud Hotspot Manager</p>
          </div>
        </div>

        <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--glass-border)' }} />

        {/* Unapproved state */}
        {isUnapproved && (
          <>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(245,158,11,0.08)', border: '2px dashed #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <h2 style={{ color: 'var(--foreground)', fontSize: '18px', fontWeight: '850', margin: 0 }}>Access Pending</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                Your account {user?.email} is pending admin approval. Please contact the administrator to activate your subscription.
              </p>
            </div>
            <a
              href={`https://wa.me/249966626693?text=${encodeURIComponent(`Hello, I'm requesting access approval for my account:\nEmail: ${user?.email}\n\nPlease approve my account to access the MIKMAN management app.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ width: '100%', backgroundColor: '#25d366', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: '750', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,211,102,0.2)', boxSizing: 'border-box' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163A11.867 11.867 0 0 1 1.63 11.97C1.63 5.37 6.963.037 13.567.037c3.197 0 6.202 1.244 8.46 3.504a11.905 11.905 0 0 1 3.503 8.473c-.005 6.6-5.339 11.933-11.94 11.933-2 0-3.963-.5-5.71-1.45L0 24z" /></svg>
              Send Request via WhatsApp
            </a>
          </>
        )}

        {/* Expired state */}
        {isExpired && (
          <>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.08)', border: '2px dashed #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <h2 style={{ color: 'var(--foreground)', fontSize: '18px', fontWeight: '850', margin: 0 }}>Subscription Expired</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                Your subscription has expired. Please renew your plan to continue accessing MIKMAN services.
              </p>
            </div>
            <a
              href={`https://wa.me/249966626693?text=${encodeURIComponent(`Hello, my subscription has expired. I'd like to renew my plan.\nEmail: ${user?.email}\n\nPlease help me with the renewal process.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ width: '100%', backgroundColor: '#25d366', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: '750', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,211,102,0.2)', boxSizing: 'border-box' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163A11.867 11.867 0 0 1 1.63 11.97C1.63 5.37 6.963.037 13.567.037c3.197 0 6.202 1.244 8.46 3.504a11.905 11.905 0 0 1 3.503 8.473c-.005 6.6-5.339 11.933-11.94 11.933-2 0-3.963-.5-5.71-1.45L0 24z" /></svg>
              Renew via WhatsApp
            </a>
          </>
        )}

        {/* Active — plans overview */}
        {!isUnapproved && !isExpired && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <h2 style={{ color: 'var(--foreground)', fontSize: '18px', fontWeight: '850', margin: 0 }}>Your Plan</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                You're on the <strong style={{ color: 'var(--foreground)' }}>{accountInfo?.plan || 'Free'}</strong> plan. Your subscription is active.
              </p>
            </div>
            <a
              href={`https://wa.me/249966626693?text=${encodeURIComponent(`Hello, I'm interested in upgrading my MIKMAN plan.\nEmail: ${user?.email}\nCurrent plan: ${accountInfo?.plan || 'Free'}\n\nPlease share the available upgrade options.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ width: '100%', backgroundColor: '#25d366', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: '750', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,211,102,0.2)', boxSizing: 'border-box' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163A11.867 11.867 0 0 1 1.63 11.97C1.63 5.37 6.963.037 13.567.037c3.197 0 6.202 1.244 8.46 3.504a11.905 11.905 0 0 1 3.503 8.473c-.005 6.6-5.339 11.933-11.94 11.933-2 0-3.963-.5-5.71-1.45L0 24z" /></svg>
              Upgrade via WhatsApp
            </a>
          </>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          style={{ width: '100%', backgroundColor: 'var(--input-bg)', color: 'var(--text-muted)', border: '1.5px solid var(--glass-border)', padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxSizing: 'border-box' }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
}