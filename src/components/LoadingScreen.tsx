import React from 'react';
import { Ticket } from 'lucide-react';

interface LoadingScreenProps {
  loadingTitle: string;
  loadingSubtitle: string;
}

export default function LoadingScreen({ loadingTitle, loadingSubtitle }: LoadingScreenProps) {
  return (
    <div style={{ 
      flex: 1, display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--background)', justifyContent: 'center', alignItems: 'center',
      height: '100dvh', padding: '20px', boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
        padding: '40px', borderRadius: '24px', border: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
        boxShadow: 'var(--shadow-lg)', maxWidth: '360px', width: '100%', textAlign: 'center', boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.4)'
          }}>
            <Ticket size={28} color="#fff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '850', color: 'var(--foreground)', margin: 0, letterSpacing: '-0.6px' }}>MIKMAN</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Cloud Hotspot Manager</p>
          </div>
        </div>
        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--secondary)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
          <style>{`@keyframes loading-bar-animation { 0% { left: -50%; } 50% { left: 100%; } 100% { left: -50%; } }`}</style>
          <div style={{ position: 'absolute', height: '100%', width: '50%', backgroundColor: 'var(--primary)', borderRadius: '2px', animation: 'loading-bar-animation 1.5s infinite ease-in-out' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ color: 'var(--foreground)', fontSize: '13.5px', fontWeight: '700', margin: 0, letterSpacing: '0.1px' }}>{loadingTitle}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '500', margin: 0, letterSpacing: '0.1px' }}>{loadingSubtitle}</p>
        </div>
      </div>
    </div>
  );
}