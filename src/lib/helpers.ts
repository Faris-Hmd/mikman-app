import { RouterConfig } from '../store';
import { SERVER_URL } from '../api';

export const getRemainingDays = (expiresAt: any, nowTime: number): number | null => {
  if (!expiresAt) return null;
  try {
    const expiresAtDate = typeof expiresAt === 'object' && expiresAt.seconds
      ? new Date(expiresAt.seconds * 1000)
      : new Date(expiresAt as string | number);
    const diffTime = expiresAtDate.getTime() - nowTime;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch { return null; }
};

export const getTemperature = (routerStatus: any): number | null => {
  if (!routerStatus) return null;
  if (routerStatus.temperature !== undefined && routerStatus.temperature !== null) return Number(routerStatus.temperature);
  const health = routerStatus.health;
  if (health == null) return null;
  if (Array.isArray(health)) {
    const entry = health.find((i: any) => i.name === 'temperature' || i.name === 'cpu-temperature' || i.name === 'board-temperature1');
    return entry?.value !== undefined ? Number(entry.value) : null;
  }
  if (typeof health === 'object') {
    const val = health.temperature ?? health['cpu-temperature'] ?? health['board-temperature1'] ?? null;
    return val !== null ? Number(val) : null;
  }
  return null;
};

export const formatSpeedCompact = (bps: number | undefined | null, speedUnit: 'bits' | 'bytes'): string => {
  if (bps === undefined || bps === null) return '—';
  if (speedUnit === 'bytes') {
    const Bps = bps / 8;
    if (Bps >= 1000000000) return `${(Bps / 1000000000).toFixed(1)} GB`;
    if (Bps >= 1000000) return `${(Bps / 1000000).toFixed(1)} MB`;
    if (Bps >= 1000) return `${(Bps / 1000).toFixed(0)} KB`;
    return `${Bps.toFixed(0)} B`;
  } else {
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(1)}G`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)}M`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(0)}K`;
    return `${bps}`;
  }
};

export const getRouterImage = (router: RouterConfig): string | null => {
  const nameLower = (router.name || '').toLowerCase();
  const modelLower = (router.model || '').toLowerCase();
  const imgMap: Record<string, string> = {
    'hap-ax3': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ax3.png',
    'hap-ac3': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ac3.png',
    'hap-ax-lite': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ax-lite.png',
    'hap-ax2': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ax2.png',
    'hap-ac2': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ac2.png',
    'hap-lite': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-lite.png',
    'l009': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/l009.png',
    'chr': 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/chr.png',
  };
  for (const [key, url] of Object.entries(imgMap)) {
    if (nameLower.includes(key) || modelLower.includes(key)) return url;
  }
  return null;
};

export const getWinboxAddress = (router: RouterConfig): string => {
  if (router.isCloudManaged && router.wgServerListenPort) {
    let host = '';
    if (SERVER_URL) {
      try {
        const url = new URL(SERVER_URL.startsWith('http') ? SERVER_URL : `http://${SERVER_URL}`);
        host = url.hostname;
      } catch {}
    }
    if (!host) host = window.location.hostname;
    if (host) return `${host}:${router.wgServerListenPort}`;
  }
  return router.vpnIp || router.ip || '';
};

export const skeletonStyle = (w: string): React.CSSProperties => ({
  display: 'inline-block', width: w, height: '10px', borderRadius: '4px', backgroundColor: 'var(--glass-border)', animation: 'skeleton-pulse 1.4s ease-in-out infinite', verticalAlign: 'middle'
});

export const getQuotaName = (t: (key: string) => string, quota?: string, mr?: number): string => {
  if (!quota) return t('dashboard.planFree');
  const q = quota.toLowerCase().trim();
  if (q === 'free') return t('dashboard.planFree');
  if (q === 'basic' || q === 'quota1') return t('dashboard.planBasic');
  if (q === 'pro' || q === 'quota2') return t('dashboard.planPro');
  if (q === 'max') return t('dashboard.planMax');
  if (mr) return t('dashboard.planCustom').replace('{count}', String(mr));
  return `${q.charAt(0).toUpperCase() + q.slice(1)} Plan`;
};