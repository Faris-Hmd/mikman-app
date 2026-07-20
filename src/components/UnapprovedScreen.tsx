import React from 'react';
import { Ticket, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UnapprovedScreenProps {
  user: any;
  userData: any;
  selectedQuota: string;
  setSelectedQuota: (quota: string) => void;
  selectedDuration: string;
  setSelectedDuration: (duration: string) => void;
  setIsApproved: (isApproved: boolean | null) => void;
  t: any;
}

export default function UnapprovedScreen({ user, userData, selectedQuota, setSelectedQuota, selectedDuration, setSelectedDuration, setIsApproved, t }: UnapprovedScreenProps) {
  const expiresAt = userData?.expiresAt;
  let isExpired = false;
  if (expiresAt) {
    const expiresAtDate = expiresAt.seconds ? new Date(expiresAt.seconds * 1000) : new Date(expiresAt);
    isExpired = expiresAtDate <= new Date();
  }

  const isFree = selectedQuota === 'free';
  const durationText = isFree ? '1 Month' :
    selectedDuration === '1m' ? '1 Month' : selectedDuration === '3m' ? '3 Months' : selectedDuration === '6m' ? '6 Months' : '12 Months';

  const activeQuota = selectedQuota;
  const quotaText = activeQuota === 'free' ? 'Free Trial (1 Router Limit)' : activeQuota === 'quota1' ? 'Quota 1 (10 Routers Limit)' : activeQuota === 'quota2' ? 'Quota 2 (20 Routers Limit)' : `Custom (${userData?.maxRouters || 1} Routers Limit)`;

  const waMessage = isExpired
    ? `Hello, my subscription has expired for my account:\nEmail: ${user?.email}\nPlan: ${quotaText}\nDuration: ${durationText}\n\nPlease renew my subscription to access the MIKMAN management app.`
    : `Hello, I'm requesting access approval for my account:\nEmail: ${user?.email}\nRequested Plan: ${quotaText}\nRequested Duration: ${durationText}\n\nPlease approve my account to access the MIKMAN management app.`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', height: '100dvh', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '36px 32px', borderRadius: '24px', border: '1px solid rgba(0, 0, 0, 0.06)', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)', maxWidth: '380px', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
            <Ticket size={24} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '850', color: '#0f172a', margin: 0 }}>MIKMAN</h1>
            <p style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>Cloud Hotspot Manager</p>
          </div>
        </div>
        <div style={{ width: '100%', height: '1px', backgroundColor: '#e2e8f0' }} />
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: '2px dashed ' + (isExpired ? '#ef4444' : '#f59e0b'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: isExpired ? '#ef4444' : '#f59e0b' }}>
          {isExpired ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <h2 style={{ color: '#0f172a', fontSize: '19px', fontWeight: '850', margin: 0 }}>{isExpired ? 'Subscription Expired' : 'Access Pending'}</h2>
          <p style={{ color: '#64748b', fontSize: '12.5px', lineHeight: '1.5', margin: '0 0 4px 0' }}>
            {isExpired ? `Your subscription for ${user?.email} has expired.` : `Select your preferred plan and duration to request access approval for ${user?.email}.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '6px' }}>
            <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', textAlign: 'left' }}>1. Select Plan:</span>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {[{ id: 'free', label: 'Free Trial', desc: '1 Router' }, { id: 'quota1', label: 'Quota 1', desc: '10 Routers' }, { id: 'quota2', label: 'Quota 2', desc: '20 Routers' }].map(p => {
                const isSel = selectedQuota === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => { setSelectedQuota(p.id); if (p.id === 'free') setSelectedDuration('1m'); }}
                    style={{ flex: 1, padding: '10px 4px', borderRadius: '12px', border: '1.5px solid ' + (isSel ? '#3b82f6' : '#cbd5e1'), backgroundColor: isSel ? 'rgba(59, 130, 246, 0.06)' : '#f8fafc', color: isSel ? '#2563eb' : '#64748b', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', transition: 'all 0.15s ease', boxSizing: 'border-box' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800' }}>{p.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.8 }}>{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', textAlign: 'left' }}>2. Select Duration:</span>
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              {[{ id: '1m', label: '1 Month' }, { id: '3m', label: '3 Months' }, { id: '6m', label: '6 Months' }, { id: '12m', label: '12 Months' }].map(d => {
                const isSel = selectedDuration === d.id;
                const isDisabled = selectedQuota === 'free' && d.id !== '1m';
                return (
                  <button key={d.id} type="button" disabled={isDisabled} onClick={() => setSelectedDuration(d.id)}
                    style={{ flex: 1, padding: '8px 2px', borderRadius: '10px', border: '1.5px solid ' + (isSel ? '#3b82f6' : '#cbd5e1'), backgroundColor: isSel ? 'rgba(59, 130, 246, 0.06)' : isDisabled ? '#f1f5f9' : '#f8fafc', color: isSel ? '#2563eb' : isDisabled ? '#cbd5e1' : '#64748b', cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: '700', opacity: isDisabled ? 0.5 : 1, transition: 'all 0.15s ease', boxSizing: 'border-box' }}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <a href={`https://wa.me/249966626693?text=${encodeURIComponent(waMessage)}`} target="_blank" rel="noopener noreferrer"
            style={{ width: '100%', backgroundColor: '#25d366', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14.5px', fontWeight: '750', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)', boxSizing: 'border-box' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163A11.867 11.867 0 0 1 1.63 11.97C1.63 5.37 6.963.037 13.567.037c3.197 0 6.202 1.244 8.46 3.504a11.905 11.905 0 0 1 3.503 8.473c-.005 6.6-5.339 11.933-11.94 11.933-2 0-3.963-.5-5.71-1.45L0 24z"/></svg>
            Send Request via WhatsApp
          </a>
          <button onClick={() => { supabase.auth.signOut().then(() => setIsApproved(null)); }}
            style={{ width: '100%', backgroundColor: '#f1f5f9', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '11px', borderRadius: '12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxSizing: 'border-box' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}