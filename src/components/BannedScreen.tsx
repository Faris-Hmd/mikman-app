import React, { useState } from 'react';
import { Ticket, ShieldAlert, LogOut, MessageCircle, Globe, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const WHATSAPP_NUMBER = '249966626693'; // Support WhatsApp

export default function BannedScreen() {
  const { user, signOut, checkStatus } = useAuth();
  const { t, isRtl, language, setLanguage } = useLanguage();
  const [checking, setChecking] = useState(false);

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent(
      `Hello MikMan Support, my account (${user?.email || ''}) has been suspended. Please review my account status.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await checkStatus();
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100dvh',
        backgroundColor: 'var(--background)',
        padding: '20px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Top Bar Language Switcher */}
      <div style={{ position: 'absolute', top: '24px', right: isRtl ? 'auto' : '24px', left: isRtl ? '24px' : 'auto', zIndex: 10 }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLanguage(language === 'ar' ? 'en' : 'ar');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--foreground)',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
          }}
        >
          <Globe size={16} style={{ color: 'var(--primary)' }} />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          padding: '36px 28px',
          borderRadius: '24px',
          border: '1px solid rgba(239,68,68,0.25)',
          backgroundColor: 'var(--card-bg)',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          boxSizing: 'border-box',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(239,68,68,0.08)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Brand Logo Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(var(--primary-rgb, 99, 102, 241), 0.35)',
            }}
          >
            <Ticket size={28} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '850', color: 'var(--foreground)', margin: 0, letterSpacing: '0.5px' }}>
              MIKMAN
            </h1>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
              Cloud Hotspot Manager
            </p>
          </div>
        </div>

        <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--glass-border)' }} />

        {/* Warning Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '2px dashed rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            boxShadow: '0 0 20px rgba(239,68,68,0.15)',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        {/* Title & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <h2 style={{ color: 'var(--foreground)', fontSize: '20px', fontWeight: '800', margin: 0 }}>
            {t('bannedScreen.title') || 'Account Suspended'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            {t('bannedScreen.subtitle') || 'Your account access has been restricted by an administrator. Please contact support via WhatsApp to resolve your account status.'}
          </p>
        </div>

        {/* User Account Tag */}
        {user?.email && (
          <div
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: 'var(--text-muted)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--glass-border)',
              borderRadius: '20px',
            }}
          >
            {user.email}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', paddingTop: '4px' }}>
          {/* Check Status Refresh Button */}
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckStatus}
            style={{
              width: '100%',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: '750',
              cursor: checking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(var(--primary-rgb, 99, 102, 241), 0.3)',
              boxSizing: 'border-box',
              opacity: checking ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={16} className={checking ? 'spin' : ''} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
            <span>{checking ? t('bannedScreen.checkingStatus') : t('bannedScreen.checkStatus')}</span>
          </button>

          <button
            onClick={handleWhatsAppContact}
            style={{
              width: '100%',
              backgroundColor: '#25d366',
              color: '#fff',
              border: 'none',
              padding: '14px 20px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: '750',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textDecoration: 'none',
              boxShadow: '0 6px 18px rgba(37,211,102,0.25)',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
          >
            <MessageCircle size={20} />
            <span>{t('bannedScreen.contactWhatsApp') || 'Contact Support on WhatsApp'}</span>
          </button>

          <button
            onClick={signOut}
            style={{
              width: '100%',
              backgroundColor: 'var(--input-bg, rgba(255,255,255,0.05))',
              color: 'var(--text-muted)',
              border: '1.5px solid var(--glass-border)',
              padding: '12px 20px',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: '650',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
          >
            <LogOut size={16} />
            <span>{t('bannedScreen.signOut') || 'Sign Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
