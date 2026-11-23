import ZapIcon from './ZapIcon';
import '../layout/shell.css';

interface LoadingScreenProps {
  loadingTitle?: string;
  loadingSubtitle?: string;
  compact?: boolean;
}

export default function LoadingScreen({ loadingTitle, loadingSubtitle, compact }: LoadingScreenProps) {
  return (
    <div className={`shell-loading-center ${compact ? 'compact' : ''}`}>
      <div className="shell-loading-icon-box">
        <ZapIcon size={26} color="#ffffff" fill="#ffffff" strokeWidth="1.2" />
      </div>
      <div className="flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary opacity-40"
            style={{ animation: `jumping-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      {loadingTitle && <p className="text-foreground text-xs font-bold m-0">{loadingTitle}</p>}
      {loadingSubtitle && <p className="text-muted text-[11px] font-medium m-0">{loadingSubtitle}</p>}
    </div>
  );
}
