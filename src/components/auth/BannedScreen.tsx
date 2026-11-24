import { useState } from 'react';
import { Ticket, ShieldAlert, LogOut, MessageCircle, Languages, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import '../layout/shell.css';

const WHATSAPP_NUMBER = '249966626693';

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
      className="flex flex-col justify-center items-center min-h-dvh bg-[var(--background)] p-5 box-border relative"
    >
      {/* Top Bar Language Switcher */}
      <div className={`absolute top-6 z-10 ${isRtl ? 'left-6' : 'right-6'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLanguage(language === 'ar' ? 'en' : 'ar');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--card-bg)] border-none text-[var(--foreground)] text-xs font-bold cursor-pointer shadow-md backdrop-blur-md"
        >
          <Languages size={16} color="var(--primary)" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="flex flex-col items-center gap-6 p-7 sm:p-9 rounded-3xl border border-red-500/25 bg-[var(--card-bg)] max-w-[420px] w-full text-center box-border shadow-2xl backdrop-blur-xl">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Ticket size={28} color="var(--white)" className="-rotate-45" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-black text-[var(--foreground)] m-0 tracking-wide">
              MIKMAN
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-extrabold uppercase tracking-widest m-0">
              Cloud Hotspot Manager
            </p>
          </div>
        </div>

        <div className="w-full h-px bg-[var(--glass-border)]" />

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-dashed border-red-500/40 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/15">
          <ShieldAlert size={32} />
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-2.5 w-full">
          <h2 className="text-[var(--foreground)] text-xl font-extrabold m-0">
            {t('bannedScreen.title') || 'Account Suspended'}
          </h2>
          <p className="text-[var(--text-muted)] text-xs leading-relaxed m-0">
            {t('bannedScreen.subtitle') || 'Your account access has been restricted by an administrator. Please contact support via WhatsApp to resolve your account status.'}
          </p>
        </div>

        {/* User Account Tag */}
        {user?.email && (
          <div className="px-4 py-1.5 text-xs font-mono text-[var(--text-muted)] bg-white/5 border border-[var(--glass-border)] rounded-full">
            {user.email}
          </div>
        )}

        {/* Action Buttons (Solid High Contrast per AGENTS.md) */}
        <div className="flex flex-col gap-3 w-full pt-1">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckStatus}
            className="btn-solid-blue w-full py-3 rounded-xl text-xs"
          >
            <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
            <span>{checking ? t('bannedScreen.checkingStatus') : t('bannedScreen.checkStatus')}</span>
          </button>

          <button
            onClick={handleWhatsAppContact}
            className="btn-solid-green w-full py-3 rounded-xl text-xs"
          >
            <MessageCircle size={18} />
            <span>{t('bannedScreen.contactWhatsApp') || 'Contact Support on WhatsApp'}</span>
          </button>

          <button
            onClick={signOut}
            className="btn-solid-slate w-full py-2.5 rounded-xl text-xs"
          >
            <LogOut size={16} />
            <span>{t('bannedScreen.signOut') || 'Sign Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
