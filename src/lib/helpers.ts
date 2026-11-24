import { RouterConfig } from '../store';

/**
 * Maps router hardware models to static brand images.
 */
export const getRouterImage = (router?: RouterConfig | { name?: string; model?: string; boardName?: string } | string | null): string => {
  if (!router) return 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ax3.png';
  let nameLower = '';
  let modelLower = '';
  if (typeof router === 'string') {
    modelLower = router.toLowerCase();
  } else {
    nameLower = (router.name || '').toLowerCase();
    modelLower = (router.model || (router as any).boardName || (router as any)['board-name'] || '').toLowerCase();
  }
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
  return 'https://zekstvj1hdm1c6qt.public.blob.vercel-storage.com/hap-ax3.png';
};

/**
 * Returns localized subscription quota plan title.
 */
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

/**
 * Formats display name, hiding internal auto-generated placeholder router names.
 */
export const cleanDisplayName = (name?: string | null, fallback = 'MikroTik'): string => {
  if (!name) return fallback;
  if (name.startsWith('cloud_') || name.startsWith('router_') || /^cloud_\d+$/.test(name)) {
    return fallback;
  }
  return name;
};

/**
 * Resolves the router's dedicated WireGuard VPN peer IP.
 */
export const getRouterVpnIp = (
  router?: { vpnIp?: string; wgClientIp?: string; ip?: string; host?: string } | null,
  status?: { vpnIp?: string; ip?: string } | null
): string => {
  if (!router) return '';
  const raw = router.vpnIp || router.wgClientIp || status?.vpnIp || status?.ip || router.ip || router.host || '';
  const trimmed = raw.split('/')[0].trim();
  return trimmed === '10.8.0.1' ? '' : trimmed;
};

/**
 * Formats byte values into clean human-readable strings (e.g. 500 MB, 1.2 GB).
 */
export const formatBytes = (bytes?: number | string | null): string | null => {
  if (bytes == null || bytes === '') return null;
  const num = typeof bytes === 'number' ? bytes : parseInt(String(bytes), 10);
  if (isNaN(num) || num <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let b = num;
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(i === 0 ? 0 : 1).replace(/\.0$/, '')} ${units[i]}`;
};

/**
 * Formats seconds into clean duration strings (e.g. 2d 5h, 3h 20m, 45m).
 */
export const formatRemainingTime = (seconds?: number | null): string | null => {
  if (seconds == null || isNaN(seconds)) return null;
  if (seconds <= 0) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

/**
 * Parses remaining time from comment if comment contains EXP date.
 */
export const parseCommentRemainingTime = (comment?: string | null): string | null => {
  if (!comment) return null;
  const expMatch = comment.match(/(?:^|[|\s])EXP:\s*([^\r\n|]+)/i);
  if (!expMatch) return null;
  const dateStr = expMatch[1].trim();
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const diffSec = Math.floor((parsed - Date.now()) / 1000);
    return formatRemainingTime(diffSec);
  }
  return null;
};
