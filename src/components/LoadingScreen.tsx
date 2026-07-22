import { Ticket } from 'lucide-react';

interface LoadingScreenProps {
  loadingTitle?: string;
  loadingSubtitle?: string;
  compact?: boolean;
}

export default function LoadingScreen({ loadingTitle, loadingSubtitle, compact }: LoadingScreenProps) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '24px 20px',
      minHeight: compact ? 200 : '100vh',
      backgroundColor: compact ? 'transparent' : 'var(--background)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.4)',
      }}>
        <Ticket size={28} style={{ color: '#fff', transform: 'rotate(-45deg)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
            animation: `jumping-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
            opacity: 0.4,
          }} />
        ))}
      </div>
      {loadingTitle && <p style={{ color: 'var(--foreground)', fontSize: 13, fontWeight: 700, margin: 0 }}>{loadingTitle}</p>}
      {loadingSubtitle && <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, margin: 0 }}>{loadingSubtitle}</p>}
    </div>
  );
}
