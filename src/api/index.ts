import { mutate } from 'swr';
import { supabase } from '../lib/supabase';
import type { RouterConfig } from '../store';

// In Vite dev, use empty string so API calls go through the Vite proxy (/api -> VPS).
// In production (Vercel), use the VPS URL from the VITE_VPS_URL env var.
const VPS_URL = import.meta.env.VITE_VPS_URL || '';
const isDev   = import.meta.env.DEV;
export let SERVER_URL = isDev ? '' : VPS_URL;

export const setServerUrl = (url: string) => {
  if (isDev) {
    SERVER_URL = '';
  } else {
    SERVER_URL = url || VPS_URL;
  }
};

// ---- Auth token management ----

let supabaseIdToken: string | null = null;

export const setSupabaseIdToken = (token: string | null) => {
  supabaseIdToken = token;
};

/**
 * Refresh the Supabase access token and update the stored token.
 * Returns the fresh token, or null if no session exists.
 */
const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    const freshToken = data.session?.access_token ?? null;
    supabaseIdToken = freshToken;
    return freshToken;
  } catch {
    return null;
  }
};

export const getAuthHeadersClient = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  // x-api-key is injected server-side by the Vercel proxy / Vite dev proxy.
  // It is never exposed in the client bundle.
  if (supabaseIdToken) {
    headers['Authorization'] = `Bearer ${supabaseIdToken}`;
  }
  return headers;
};

// ---- Request helpers ----

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  routerId?: string;
  cache?: RequestCache;
  timeoutMs?: number;
}

/**
 * Execute a fetch with timeout support.
 */
const doFetch = async (
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error('Network error: Unable to reach server. Check your connection.');
  } finally {
    clearTimeout(timeoutId);
  }
};

// ---- Core API caller ----

export const apiCall = async <T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const {
    method = 'GET',
    body,
    routerId,
    cache,
    timeoutMs = 30_000,
  } = options;

  let urlPath = path;
  if (routerId) {
    urlPath = `/routers/${routerId}${path.startsWith('/') ? path : '/' + path}`;
  }

  const url = `${SERVER_URL}/api${urlPath.startsWith('/') ? urlPath : '/' + urlPath}`;

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { ...getAuthHeadersClient() };

    const storedLang = localStorage.getItem('@app_lang');
    if (storedLang) {
      headers['Accept-Language'] = storedLang;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  };

  const makeRequest = async (): Promise<Response> => {
    const headers = buildHeaders();
    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
    };

    const res = await doFetch(url, fetchOptions, timeoutMs);
    return res;
  };

  let res = await makeRequest();

  // ---- 401 retry with fresh token ----
  if (res.status === 401 && supabaseIdToken) {
    const freshToken = await refreshAuthToken();
    if (freshToken) {
      res = await makeRequest();
    }
  }

  // ---- Handle non-OK responses ----
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorMessage = `API error (${res.status}): ${res.statusText}`;
    let parsedData: any = null;
    let errorCode: string | undefined = undefined;
    try {
      const parsed = JSON.parse(errorText);
      parsedData = parsed;
      if (parsed.error || parsed.message) {
        errorMessage = parsed.error || parsed.message;
      }
      if (parsed.code) {
        errorCode = parsed.code;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText.substring(0, 200);
      }
    }

    if (res.status === 403) {
      const lowerMsg = errorMessage.toLowerCase();
      if (lowerMsg.includes('banned') || lowerMsg.includes('pending approval') || errorCode === 'ACCOUNT_BANNED') {
        window.dispatchEvent(new CustomEvent('account:banned'));
      } else if (lowerMsg.includes('expired') || errorCode === 'SUBSCRIPTION_EXPIRED') {
        window.dispatchEvent(new CustomEvent('account:expired'));
      }
    }

    const err = new Error(errorMessage) as any;
    err.status = res.status;
    err.code = errorCode;
    if (parsedData?.userCount !== undefined) err.userCount = parsedData.userCount;
    if (parsedData?.profileName !== undefined) err.profileName = parsedData.profileName;
    throw err;
  }

  return res.json();
};

// ---- Logging helpers ----

const logError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

// ---- Types ----

export interface UserData {
  email: string;
  approved: boolean;
  expiresAt: string | null;
  maxRouters: number;
  quota: string;
  hasPassword: boolean;
  name: string | null;
}

export interface RouterProfilesResponse {
  profiles: RouterConfig[];
  userData: UserData | null;
}

export interface RouterProvisionStatus {
  online: boolean;
  timezone: string;
  wifiName: string;
  routerTime?: string | null;
  uptime?: string;
  uptime_display?: string;
  cpuLoad?: number | null;
  cpuLoad_display?: string;
  totalMemory?: number | null;
  freeMemory?: number | null;
  activeUsers?: number;
  status?: 'online' | 'offline';
  temperature?: number | null;
  temperature_display?: string;
}

export interface RevenueStatsPayload {
  totalRevenue: number;
  totalVouchers: number;
  daily: Array<{
    date: string;
    revenue: number;
    count: number;
    profiles: Record<string, { count: number; revenue: number }>;
  }>;
  weekly: Array<{
    label: string;
    revenue: number;
    count: number;
    profiles: Record<string, { count: number; revenue: number }>;
  }>;
  monthly: Array<{
    label: string;
    revenue: number;
    count: number;
    profiles: Record<string, { count: number; revenue: number }>;
  }>;
  profiles: Array<{
    profile: string;
    revenue: number;
    count: number;
    percentage: number;
  }>;
  firstRecordDate?: string;
  lastRecordDate?: string;
}

// ── Voucher batch types (updated to match new API response shapes) ──────────

export interface VoucherBatch {
  batchId?: string;
  profile: string;
  printLabel: string;
  comment: string;
  createdAt?: string;
  originalCount: number;
  unusedCount: number;
  activeCount: number;
  expiredCount: number;
}

export interface VoucherSummary {
  '.id': string;
  name: string;
  comment: string;
  profile: string;
  'limit-bytes-total': string;
}

export interface ActiveVoucher extends VoucherSummary {
  startDate: string | null;
  startTime: string | null;
  expDate: string | null;
  loginDate: string | null;
  remainingSeconds: number | null;
  remainingBytes: number | null;
  limitBytesTotal: number;
  timeLeftText: string;
  deviceName: string;
  isOnline: boolean;
  sessionId: string | null;
  ipAddress: string | null;
  uptime: string | null;
  bytesIn: string | null;
  bytesOut: string | null;
}

export interface ExpiredVoucher extends VoucherSummary {
  expDate: string | null;
  loginDate: string | null;
  remainingBytes: number | null;
  limitBytesTotal: number;
  timeLeftText: string;
}

export interface VoucherBatchDetail {
  batchId?: string;
  profile: string;
  printLabel: string;
  comment: string;
  createdAt?: string;
  originalCount: number;
  unusedCount: number;
  activeCount: number;
  expiredCount: number;
  isProfileGroup: boolean;
  unusedVouchers: VoucherSummary[];
  activeVouchers: ActiveVoucher[];
  expiredVouchers: ExpiredVoucher[];
}

export interface VoucherSearchResult extends ActiveVoucher {
  isExpired: boolean;
  isInUse: boolean;
}

interface GenerateScriptParams {
  id: string;
  name: string;
  model: string;
  wifiName: string;
  user: string;
  password?: string;
  supportName?: string;
  supportPhone?: string;
  owners?: string[];
  timezone?: string;
}

// ---- API functions ----

// Uses the same /routers/profiles endpoint as fetchRouterProfilesWithUserAPI below.
// Kept as a convenience aliasing the richer version.
export const fetchRouterProfilesAPI = async (): Promise<RouterConfig[]> => {
  const { profiles } = await fetchRouterProfilesWithUserAPI();
  return profiles;
};

export const fetchRouterProfilesWithUserAPI = async (): Promise<RouterProfilesResponse> => {
  try {
    const response = await apiCall<{ profiles: RouterConfig[]; userData: UserData | null } | RouterConfig[]>(
      '/routers/profiles',
      { cache: 'no-store' }
    );
    if (Array.isArray(response)) {
      return { profiles: response, userData: null };
    }
    if (response && typeof response === 'object' && 'profiles' in response) {
      return { profiles: response.profiles ?? [], userData: response.userData ?? null };
    }
    return { profiles: [], userData: null };
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    const isBanned = e?.status === 403 && (msg.includes('banned') || msg.includes('pending approval') || e?.code === 'ACCOUNT_BANNED');
    const isExpired = e?.status === 403 && (msg.includes('expired') || e?.code === 'SUBSCRIPTION_EXPIRED');

    if (isBanned) {
      return {
        profiles: [],
        userData: {
          email: '',
          approved: false,
          expiresAt: null,
          maxRouters: 0,
          quota: 'free',
          hasPassword: true,
          name: null,
        }
      };
    }
    if (isExpired) {
      return {
        profiles: [],
        userData: {
          email: '',
          approved: true,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          maxRouters: 0,
          quota: 'expired',
          hasPassword: true,
          name: null,
        }
      };
    }

    logError('Fetch router profiles error:', e);
    return { profiles: [], userData: null };
  }
};

export const fetchProfilesAPI = async (routerId: string): Promise<unknown> => {
  const res = await apiCall<any>('/profiles', { routerId, cache: 'no-store' });
  let list: any[] = [];
  if (Array.isArray(res)) {
    list = res;
  } else if (res && typeof res === 'object') {
    if (Array.isArray(res.profiles)) {
      list = res.profiles;
    } else if (Array.isArray(res.data)) {
      list = res.data;
    }
  }
  return list
    .map((p: any) => {
      let rev = p.revenue ?? p.price;
      if ((rev === undefined || rev === null || rev === '') && typeof p['on-login'] === 'string') {
        const match = p['on-login'].match(/(?:price|revenue|rev)\s*[:=]?\s*\$?\s*(\d+(?:\.\d+)?)/i);
        if (match) rev = parseFloat(match[1]);
      }
      if ((rev === undefined || rev === null || rev === '') && typeof p.onlogin === 'string') {
        const match = p.onlogin.match(/(?:price|revenue|rev)\s*[:=]?\s*\$?\s*(\d+(?:\.\d+)?)/i);
        if (match) rev = parseFloat(match[1]);
      }
      if ((rev === undefined || rev === null || rev === '') && typeof p.comment === 'string') {
        const match = p.comment.match(/(?:price|revenue|rev)\s*[:=]?\s*\$?\s*(\d+(?:\.\d+)?)/i);
        if (match) rev = parseFloat(match[1]);
      }
      const numRev = rev !== undefined && rev !== null && rev !== '' ? Number(rev) : null;

      // Extract validity if missing
      let val = p.validity;
      if (!val) {
        const onLogin = (p['on-login'] || p.onlogin || p.comment || '') as string;
        const matchVal = onLogin.match(/(?:validity|rem|time)\s*[:=]?\s*["']?(\d+\s*[a-zA-Z]+)["']?/i);
        if (matchVal) {
          val = matchVal[1];
        } else if (p['session-timeout']) {
          val = String(p['session-timeout']).split(' ')[0];
        } else if (p.name) {
          const matchNameVal = String(p.name).match(/\b(\d+\s*[dhmwDHMW])\b/);
          if (matchNameVal) val = matchNameVal[1];
        }
      }

      // Extract limitMB if missing
      let mb = p.limitMB;
      if (mb === undefined || mb === null) {
        const onLogin = (p['on-login'] || p.onlogin || p.comment || '') as string;
        const matchMb = onLogin.match(/(?:limitMB|limit|data)\s*[:=]?\s*["']?(\d+(?:\.\d+)?)\s*(MB|GB|mb|gb|M|G)?["']?/i);
        if (matchMb) {
          const num = parseFloat(matchMb[1]);
          const unit = (matchMb[2] || 'M').toUpperCase();
          mb = unit.startsWith('G') ? Math.round(num * 1024) : Math.round(num);
        } else if (p['limit-bytes-total']) {
          const bytes = parseInt(String(p['limit-bytes-total']), 10);
          if (!isNaN(bytes) && bytes > 0) {
            mb = Math.round(bytes / 1048576);
          }
        } else if (p.name) {
          const matchNameMb = String(p.name).match(/\b(\d+(?:\.\d+)?)\s*(MB|GB|mb|gb)\b/i);
          if (matchNameMb) {
            const num = parseFloat(matchNameMb[1]);
            const unit = matchNameMb[2].toUpperCase();
            mb = unit === 'GB' ? Math.round(num * 1024) : Math.round(num);
          }
        }
      }

      return {
        ...p,
        validity: val || p.validity,
        limitMB: mb !== undefined && mb !== null ? mb : p.limitMB,
        revenue: numRev !== null && !isNaN(numRev) ? numRev : p.revenue ?? p.price,
        price: numRev !== null && !isNaN(numRev) ? numRev : p.price ?? p.revenue,
      };
    })
    .filter((p: any) => {
      const name = (p.name || p.id || '').toString().toLowerCase().trim();
      return name !== 'default';
    });
};

export const deleteProfileAPI = async (routerId: string, id: string): Promise<void> => {
  await apiCall('/profiles/remove', {
    method: 'POST',
    body: { id },
    routerId,
  });
};

export const syncAllProfilesAPI = async (routerId: string): Promise<{ success: boolean; count: number }> => {
  return await apiCall<{ success: boolean; count: number }>('/profiles/sync-all', {
    method: 'POST',
    routerId,
  });
};

export const syncAllRoutersProfilesAPI = async (): Promise<{ success: boolean; totalUpdated: number; results: Record<string, number> }> => {
  return await apiCall<{ success: boolean; totalUpdated: number; results: Record<string, number> }>('/sync-all-profiles', {
    method: 'POST',
  });
};

export const renameProfileAPI = async (
  routerId: string,
  id: string,
  newName: string,
  printLabel?: string,
  revenue?: string | number,
  validity?: string,
  limitMB?: number,
  isUnlimited?: boolean
): Promise<void> => {
  await apiCall('/profiles/set', {
    method: 'POST',
    body: { id, name: newName, printLabel, revenue, validity, limitMB, isUnlimited },
    routerId,
  });
};

export const createProfileAPI = async (
  routerId: string,
  name: string,
  validity: string,
  limitMB?: number,
  isUnlimited?: boolean,
  printLabel?: string,
  revenue?: string | number
): Promise<unknown> => {
  return apiCall('/profiles/add', {
    method: 'POST',
    body: { name, validity, limitMB, isUnlimited, printLabel, revenue },
    routerId,
  });
};

export const fetchRecordsAPI = async (routerId: string): Promise<any[]> => {
  try {
    return await apiCall<any[]>('/vouchers/records', { routerId, cache: 'no-store' });
  } catch (e) {
    logError('Fetch records error:', e);
    return [];
  }
};

// ── Voucher Management APIs (new endpoints) ────────────────────────────────

export const createVouchersAPI = async (
  routerId: string,
  profile: string,
  count: number,
  length: number,
  comment?: string,
  limitBytesTotal?: number
): Promise<{ pins: string[]; jobId?: string; batchId?: string }> => {
  const data = await apiCall<{ pins: string[]; jobId?: string; batchId?: string; success: boolean }>(
    '/vouchers/create',
    {
      method: 'POST',
      body: { count, length, profile, comment, limitBytesTotal },
      routerId,
      timeoutMs: 300_000,
    }
  );
  return { pins: data.pins, jobId: data.jobId, batchId: data.batchId };
};

export interface VoucherJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total?: number;
  error?: string | null;
}

export const fetchVoucherJobStatusAPI = async (
  routerId: string,
  jobId: string
): Promise<VoucherJobStatus> => {
  return apiCall(`/vouchers/jobs/${jobId}`, {
    routerId,
    cache: 'no-store',
    timeoutMs: 15_000,
  });
};

export const revalidateRouterCache = (routerId: string, keys?: string[]) => {
  if (!routerId) return;
  if (keys && keys.length > 0) {
    keys.forEach((k) => mutate(k));
    return;
  }
  // Targeted revalidation to avoid overwhelming the MikroTik router REST API with parallel requests
  mutate(`batch-list-${routerId}`);
  mutate(`voucher-profiles-${routerId}`);
  mutate(`router-profiles-${routerId}`);
  mutate((key: any) => typeof key === 'string' && key.includes(`batch-detail-${routerId}`), undefined, { revalidate: true });
};

export const deleteVouchersAPI = async (routerId: string, ids: string[]): Promise<void> => {
  if (!ids || ids.length === 0) return;
  await apiCall('/vouchers/delete', {
    method: 'POST',
    body: { ids },
    routerId,
  });
};

export const fetchNetworkClientsAPI = async (routerId: string): Promise<unknown> => {
  return apiCall('/network-clients', { routerId, cache: 'no-store' });
};

// ── Voucher Batch APIs ─────────────────────────────────────────────────────

export const fetchVoucherBatchesAPI = async (routerId: string): Promise<VoucherBatch[]> => {
  return apiCall<VoucherBatch[]>('/vouchers/batches', { routerId, cache: 'no-store' });
};

export const fetchVoucherBatchDetailAPI = async (
  routerId: string,
  profile: string,
  comment?: string,
  printLabel?: string,
  batchId?: string
): Promise<VoucherBatchDetail> => {
  const params = new URLSearchParams();
  params.append('profile', profile);
  if (comment) params.append('comment', comment);
  if (printLabel) params.append('printLabel', printLabel);
  if (batchId) params.append('batchId', batchId);
  return apiCall<VoucherBatchDetail>(
    `/vouchers/batches/detail?${params.toString()}`,
    { routerId, cache: 'no-store' }
  );
};

/**
 * Search for voucher codes within a batch (partial name match).
 */
export const searchVouchersAPI = async (
  routerId: string,
  query: string,
  profile?: string,
  comment?: string,
  printLabel?: string,
  batchId?: string
): Promise<{ results: VoucherSearchResult[]; total: number }> => {
  const params = new URLSearchParams();
  params.append('q', query);
  if (profile) params.append('profile', profile);
  if (comment) params.append('comment', comment);
  if (printLabel) params.append('printLabel', printLabel);
  if (batchId) params.append('batchId', batchId);
  return apiCall(`/vouchers/search?${params.toString()}`, { routerId, cache: 'no-store' });
};

/**
 * Get ALL voucher codes for a batch (lightweight, names only — for print/export).
 */
export const getVoucherCodesAPI = async (
  routerId: string,
  profile: string,
  comment?: string,
  printLabel?: string,
  status?: 'unused' | 'active' | 'expired' | 'all',
  batchId?: string
): Promise<{ codes: string[]; total: number }> => {
  const params = new URLSearchParams();
  params.append('profile', profile);
  if (comment) params.append('comment', comment);
  if (printLabel) params.append('printLabel', printLabel);
  if (status) params.append('status', status);
  if (batchId) params.append('batchId', batchId);
  return apiCall(`/vouchers/batches/detail/codes?${params.toString()}`, { routerId, cache: 'no-store' });
};

/**
 * Get ALL vouchers for a specific status category (for "show all" button).
 */
export const getAllVouchersByStatusAPI = async (
  routerId: string,
  profile: string,
  status: 'unused' | 'active' | 'expired',
  comment?: string,
  printLabel?: string,
  batchId?: string
): Promise<{ vouchers: (VoucherSummary | ActiveVoucher | ExpiredVoucher)[]; total: number; status: string }> => {
  const params = new URLSearchParams();
  params.append('profile', profile);
  params.append('status', status);
  if (comment) params.append('comment', comment);
  if (printLabel) params.append('printLabel', printLabel);
  if (batchId) params.append('batchId', batchId);
  return apiCall(`/vouchers/batches/detail/all?${params.toString()}`, { routerId, cache: 'no-store' });
};

export const removeActiveSessionAPI = async (routerId: string, id: string): Promise<void> => {
  await apiCall('/sessions/active/remove', {
    method: 'POST',
    body: { id },
    routerId,
  });
};

export const formatUptimeAPI = (uptime?: string): string => {
  if (!uptime || uptime === '0s' || uptime === '00:00:00' || uptime === 'Offline' || uptime === '—' || uptime === 'N/A')
    return uptime === 'Offline' ? 'Offline' : '—';

  let totalMins = 0;

  const weekMatch = uptime.match(/(\d+)w/);
  if (weekMatch) totalMins += parseInt(weekMatch[1], 10) * 7 * 24 * 60;

  const dayMatch = uptime.match(/(\d+)d/);
  if (dayMatch) totalMins += parseInt(dayMatch[1], 10) * 24 * 60;

  const timePart = uptime.match(/(\d{1,2}:){1,2}\d{1,2}/);
  if (timePart) {
    const parts = timePart[0].split(':').map((p) => parseInt(p, 10));
    if (parts.length === 3) {
      totalMins += parts[0] * 60 + parts[1];
    } else if (parts.length === 2) {
      totalMins += parts[0];
    }
  } else {
    const hourMatch = uptime.match(/(\d+)h/);
    if (hourMatch) totalMins += parseInt(hourMatch[1], 10) * 60;
    const minMatch = uptime.match(/(\d+)m/);
    if (minMatch) totalMins += parseInt(minMatch[1], 10);
  }

  if (totalMins === 0) return '0m';

  const d = Math.floor(totalMins / (24 * 60));
  const h = Math.floor((totalMins % (24 * 60)) / 60);
  const m = totalMins % 60;

  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

export const setupWireguardTunnelAPI = async (routerId: string, routerData: Record<string, unknown>): Promise<unknown> => {
  return apiCall('/wireguard/setup', {
    method: 'POST',
    body: routerData,
    routerId,
  });
};

export const fetchSingleRouterStatusAPI = async (id: string): Promise<RouterProvisionStatus> => {
  return apiCall<RouterProvisionStatus>(`/routers/${id}/status`, {
    cache: 'no-store',
    timeoutMs: 15_000,
  });
};

export const updateRouterProfileAPI = async (
  id: string,
  data: {
    name?: string;
    user?: string;
    password?: string;
    model?: string;
    owners?: string[];
    wifiName?: string;
    supportName?: string;
    supportPhone?: string;
    timezone?: string;
    hotspotWifiName?: string;
    cardPrintLabel?: string;
    useCustomHotspotName?: boolean;
    useCustomPrintLabel?: boolean;
  }
): Promise<{ success: boolean; message: string; updates?: string[]; errors?: string[] }> => {
  return apiCall(`/routers/${id}`, {
    method: 'PUT',
    body: data,
    timeoutMs: 270_000,
  });
};

export interface UploadJobStatus {
  id: string;
  routerId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

export const provisionHotspotFilesAPI = async (
  id: string,
  data: {
    wifiName?: string;
    supportName?: string;
    supportPhone?: string;
  }
): Promise<{ success: boolean; message: string; jobId?: string; status?: string }> => {
  return apiCall(`/routers/${id}/provision/hotspot-files`, {
    method: 'POST',
    body: data,
    timeoutMs: 30_000,
  });
};

export const fetchHotspotUploadJobStatusAPI = async (
  id: string,
  jobId: string
): Promise<UploadJobStatus> => {
  return apiCall(`/routers/${id}/provision/hotspot-files/status/${jobId}`, {
    cache: 'no-store',
    timeoutMs: 15_000,
  });
};

export const provisionHotspotServerAPI = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/hotspot-server`, {
    method: 'POST',
    timeoutMs: 180_000,
  });
};

export const provisionWifiSSIDAPI = async (id: string, wifiName: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/wifi-ssid`, {
    method: 'POST',
    body: { wifiName },
    timeoutMs: 180_000,
  });
};

export const provisionTimezoneAPI = async (id: string, timezone: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/timezone`, {
    method: 'POST',
    body: { timezone },
    timeoutMs: 180_000,
  });
};

export const deleteRouterProfileAPI = async (id: string): Promise<{ success: boolean; message: string }> => {
  const result = await apiCall<{ success: boolean; message: string }>(`/routers/${id}`, {
    method: 'DELETE',
  });
  mutate('router-profiles-user');
  mutate('user-routers');
  mutate((key: any) => typeof key === 'string' && key.includes(id), undefined, { revalidate: false });
  return result;
};

export const fetchIpBindingsAPI = async (routerId: string): Promise<any[]> => {
  return apiCall<any[]>('/ip-bindings', { routerId, cache: 'no-store' });
};

export const addIpBindingAPI = async (
  routerId: string,
  macAddress: string,
  ipAddress: string,
  comment: string,
  type = 'bypassed'
): Promise<{ success: boolean }> => {
  return apiCall('/ip-bindings/add', {
    method: 'POST',
    body: { macAddress, ipAddress, comment, type },
    routerId,
  });
};

export const removeIpBindingAPI = async (routerId: string, id: string): Promise<{ success: boolean }> => {
  return apiCall('/ip-bindings/remove', {
    method: 'POST',
    body: { id },
    routerId,
  });
};

export const fetchMyClientInfoAPI = async (routerId: string): Promise<{ mac: string; ip: string; hostName?: string }> => {
  return apiCall('/my-client-info', { routerId, cache: 'no-store' });
};

export const generateCloudScriptAPI = async (params: GenerateScriptParams): Promise<{ script: string; router: unknown }> => {
  return apiCall('/routers/generate-script', {
    method: 'POST',
    body: params,
  });
};

export const fetchAllRoutersStatusAPI = async (): Promise<any[]> => {
  try {
    return await apiCall<any[]>('/routers', { cache: 'no-store' });
  } catch (e) {
    logError('Fetch all routers status error:', e);
    return [];
  }
};

export const fetchRevenueStatsAPI = async (
  routerId: string,
  startDate?: string,
  endDate?: string
): Promise<RevenueStatsPayload> => {
  let path = '/revenue-stats';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const queryString = params.toString();
  if (queryString) {
    path += `?${queryString}`;
  }
  return apiCall<RevenueStatsPayload>(path, { routerId, cache: 'no-store' });
};

export const registerUserAPI = async (): Promise<{ success: boolean; message: string }> => {
  return apiCall('/users/register', { method: 'POST' });
};

export interface SubscriptionHistoryEntry {
  id?: string;
  action: string;
  created_at?: string;
  timestamp?: string;
  details?: {
    plan?: string;
    max_routers?: number;
    days_added?: number;
    expires_at?: string;
  };
}

export const fetchUserSubscriptionHistoryAPI = async (): Promise<SubscriptionHistoryEntry[]> => {
  try {
    const res = await apiCall<{ success: boolean; history: SubscriptionHistoryEntry[] }>('/users/subscription-history', { cache: 'no-store' });
    const logs = (res.history || []).map((item: any) => ({
      ...item,
      created_at: item.created_at || item.timestamp,
      timestamp: item.created_at || item.timestamp
    }));
    return logs;
  } catch (e) {
    logError('Fetch subscription history error:', e);
    return [];
  }
};

export interface PlanCatalogItem {
  id: string;
  name: string;
  nameAr?: string;
  priceSdg?: number;
  priceUsd?: number;
  days: number;
  maxRouters: number;
  description?: string;
}

export const fetchPlansCatalogAPI = async (): Promise<PlanCatalogItem[]> => {
  try {
    const res = await apiCall<{ plans: PlanCatalogItem[] }>('/users/plans');
    return res.plans || [];
  } catch (e) {
    logError('Fetch plans catalog error:', e);
    return [];
  }
};

export const fetchRouterHistoryAPI = async (
  _routerId: string,
  _hours = 24,
  _limit = 500
): Promise<any[]> => {
  return Promise.resolve([]);
};