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
