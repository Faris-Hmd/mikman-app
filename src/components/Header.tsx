import React from 'react';
import { useLocation } from 'react-router-dom';
import { Ticket, Cpu, Activity, Clock, Thermometer, Sun, Moon, Menu } from 'lucide-react';
import { RouterConfig } from '../store';
import { formatUptimeAPI } from '../api';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  activeRouter: RouterConfig | null;
  isConnected: boolean | null;
  resources: any;
  health: any;
  onDisconnect: () => void;
  user: any;
  onProfileClick: () => void;
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export default function Header({
  activeRouter, isConnected, resources, health, onDisconnect, user,
  onProfileClick, onMenuToggle, isMobileMenuOpen, theme, toggleTheme
}: HeaderProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const { language, setLanguage, t } = useLanguage();

  const getTabTitle = () => {
    if (pathname === '/' || (activeRouter && pathname === `/${activeRouter.id}`)) return t('common.home');
    if (pathname.endsWith('/account')) return t('sidebar.accountDetails');
    if (pathname.endsWith('/vouchers')) return t('sidebar.vouchers');
    if (pathname.endsWith('/profiles')) return t('sidebar.profiles');
    if (pathname.endsWith('/batch')) return t('sidebar.batchPrint');
    if (pathname.endsWith('/users')) return t('sidebar.users');
    if (pathname.endsWith('/aps')) return t('sidebar.devices');
    if (pathname.endsWith('/records')) return t('sidebar.audit');
    if (pathname.endsWith('/revenue')) return t('sidebar.revenue');
    if (pathname.endsWith('/settings')) return t('sidebar.settings');
    return 'App';
  };

  const title = getTabTitle();

  const getTemperature = (): number | null => {
    if (health == null) return null;
    if (Array.isArray(health)) {
      const entry = health.find((i: any) => i.name === 'temperature' || i.name === 'cpu-temperature' || i.name === 'board-temperature1');
      return entry?.value ?? null;
    }
    if (typeof health === 'object') {
      const val = health.temperature ?? health['cpu-temperature'] ?? health['board-temperature1'] ?? null;
      return val !== null ? Number(val) : null;
    }
    return null;
  };

  return (
    <>
      <header className="app-header">
        <div className="header-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '36px' }}>
            {user && (
              <button onClick={onMenuToggle} className="mobile-nav"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--foreground)', borderRadius: '10px', backgroundColor: isMobileMenuOpen ? 'var(--secondary)' : 'transparent', transition: 'background-color 0.2s', boxSizing: 'border-box', zIndex: 10 }}>
                <Menu size={22} />
              </button>
            )}
            <div className="mobile-nav" onClick={onDisconnect} title={t('header.routerSelection')}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '8px', padding: '4px 8px', transition: 'background-color 0.2s' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.3)' }}>
                <Ticket size={20} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--foreground)', margin: 0, letterSpacing: '-0.4px', lineHeight: '1.2' }}>MIKMAN</h1>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
              </div>
            </div>
            <div className="desktop-nav">
              <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--foreground)', margin: 0, letterSpacing: '-0.5px' }}>{title}</h1>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} className="header-action-btn hide-on-mobile"
              style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'inherit', letterSpacing: '0.3px' }} title={t('header.languageSelector')}>
              {language === 'en' ? 'AR' : 'EN'}
            </button>
            <button onClick={toggleTheme} className="header-action-btn" title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
              {theme === 'dark' ? <Sun size={18} color="var(--primary)" /> : <Moon size={18} color="var(--primary)" />}
            </button>
            {user && (
              <button onClick={onProfileClick}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid var(--primary)', transition: 'border-color 0.2s', backgroundColor: 'transparent', padding: 0, cursor: 'pointer' }}>
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>
                    {user.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>
      {activeRouter && (
        <div className="mobile-telemetry-bar" style={{ gap: '4px', padding: '6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)', border: '1px solid ' + (isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'), height: '18px', boxSizing: 'border-box' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isConnected ? '#22c55e' : '#ef4444', boxShadow: isConnected ? '0 0 3px #22c55e' : '0 0 3px #ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: '9px', fontWeight: '700', color: isConnected ? '#22c55e' : '#ef4444' }}>{activeRouter.name}</span>
          </div>
          {isConnected && resources && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {resources['cpu-load'] !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--secondary)', border: '1px solid var(--glass-border)', height: '18px', boxSizing: 'border-box', fontSize: '9px', color: 'var(--text-muted)' }}>
                  <Cpu size={8} color="var(--primary)" /><span><span className="header-stat-label">CPU: </span><strong style={{ color: 'var(--foreground)' }}>{resources['cpu-load']}%</strong></span>
                </div>
              )}
              {resources['total-memory'] && resources['free-memory'] && (() => {
                const total = parseInt(resources['total-memory']); const free = parseInt(resources['free-memory']); const used = total - free;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--secondary)', border: '1px solid var(--glass-border)', height: '18px', boxSizing: 'border-box', fontSize: '9px', color: 'var(--text-muted)' }}>
                    <Activity size={8} color="var(--primary)" /><span><span className="header-stat-label">RAM: </span><strong style={{ color: 'var(--foreground)' }}>{Math.round(used / (1024*1024))}/{Math.round(total / (1024*1024))}MB</strong></span>
                  </div>
                );
              })()}
              {resources['uptime'] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--secondary)', border: '1px solid var(--glass-border)', height: '18px', boxSizing: 'border-box', fontSize: '9px', color: 'var(--text-muted)' }}>
                  <Clock size={8} color="var(--primary)" /><span>{formatUptimeAPI(resources['uptime'])}</span>
                </div>
              )}
              {(() => { const temp = getTemperature(); if (temp === null) return null; return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--secondary)', border: '1px solid var(--glass-border)', height: '18px', boxSizing: 'border-box', fontSize: '9px', color: 'var(--text-muted)' }}>
                  <Thermometer size={8} color="var(--primary)" /><span><strong style={{ color: 'var(--foreground)' }}>{temp}°C</strong></span>
                </div>
              );})()}
            </div>
          )}
        </div>
      )}
    </>
  );
}