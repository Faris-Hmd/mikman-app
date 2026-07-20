import { Ticket } from 'lucide-react';

interface LoadingScreenProps {
  loadingTitle: string;
  loadingSubtitle: string;
}

export default function LoadingScreen({ loadingTitle, loadingSubtitle }: LoadingScreenProps) {
  return (
    <div className="flex-1 flex flex-col bg-[var(--background)] justify-center items-center h-dvh p-5 box-border">
      <div className="flex flex-col items-center gap-6 p-10 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[16px] max-w-[360px] w-full text-center box-border">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]">
            <Ticket size={28} color="#fff" className="-rotate-45" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-[850] text-[var(--foreground)] m-0 tracking-tight">MIKMAN</h1>
            <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-[1px] m-0">Cloud Hotspot Manager</p>
          </div>
        </div>
        <div className="w-full h-1 bg-[var(--secondary)] rounded-sm overflow-hidden relative">
          <style>{`@keyframes loading-bar-animation { 0% { left: -50%; } 50% { left: 100%; } 100% { left: -50%; } }`}</style>
          <div className="absolute h-full w-1/2 bg-[var(--primary)] rounded-sm" style={{ animation: 'loading-bar-animation 1.5s infinite ease-in-out' }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[var(--foreground)] text-[13.5px] font-bold m-0 tracking-[0.1px]">{loadingTitle}</p>
          <p className="text-[var(--text-muted)] text-[11px] font-medium m-0 tracking-[0.1px]">{loadingSubtitle}</p>
        </div>
      </div>
    </div>
  );
}