import { RouterConfig } from '../store';

const DEFAULT_VPS_URL = 'https://2a02-4780-7-43e7--1.sslip.io';

// In Vite dev, use empty string so API calls go through the Vite proxy (/api -> VPS).
// In production (Vercel), use the VPS URL directly so API calls go to the backend.
const isDev = import.meta.env.DEV;
export let SERVER_URL = isDev ? '' : DEFAULT_VPS_URL;

export const setServerUrl = (url: string) => {
  const targetUrl = url || DEFAULT_VPS_URL;
  // For default VPS URLs, use empty string so requests go through Vite's proxy (dev only)
  if (isDev) {
    SERVER_URL = '';
  } else {
    // In production, always use the full VPS URL
    SERVER_URL = targetUrl;
  }
};

let supabaseIdToken: string | null = null;

export const setSupabaseIdToken = (token: string | null) => {
  supabaseIdToken = token;
};

export const getAuthHeadersClient = () => {
  const headers: Record<string, string> = {
    'x-api-key': import.meta.env.VITE_API_SECRET_KEY || 'mk-voucher-secret-2026'
  };
  if (supabaseIdToken) {
    headers['Authorization'] = `Bearer ${supabaseIdToken}`;
  }
  return headers;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  routerId?: string;
  cache?: RequestCache;
  timeoutMs?: number;
}

export const apiCall = async <T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const {
    method = 'GET',
    body,
    routerId,
    cache,
    timeoutMs = 30_000
  } = options;

  let urlPath = path;

  if (routerId) {
    urlPath = `/routers/${routerId}${path.startsWith('/') ? path : '/' + path}`;
  }

  const url = `${SERVER_URL}/api${urlPath.startsWith('/') ? urlPath : '/' + urlPath}`;

  const headers: HeadersInit = {
    ...getAuthHeadersClient()
  };

  const storedLang = localStorage.getItem('@app_lang');
  if (storedLang) {
    headers['Accept-Language'] = storedLang;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
      signal: controller.signal
    });
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }

    if (url.includes('2a02-4780-7-43e7--1.sslip.io')) {
      const fallbackUrl = url.replace('2a02-4780-7-43e7--1.sslip.io', '187-127-234-201.nip.io');
      console.warn(`Failed to reach ${url}. Retrying with fallback: ${fallbackUrl}`);

      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), timeoutMs);
      try {
        res = await fetch(fallbackUrl, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          cache,
          signal: fallbackController.signal
        });

        if (SERVER_URL.includes('2a02-4780-7-43e7--1.sslip.io')) {
          SERVER_URL = SERVER_URL.replace('2a02-4780-7-43e7--1.sslip.io', '187-127-234-201.nip.io');
        }
        clearTimeout(fallbackTimeoutId);
      } catch (fallbackErr: any) {
        clearTimeout(fallbackTimeoutId);
        if (fallbackErr?.name === 'AbortError') {
          throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
        }
        throw new Error(`Network error: Unable to reach server at either primary or fallback address.`);
      }
    } else {
      throw new Error(`Network error: Unable to reach server. Check your connection.`);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorMessage = `API error (${res.status}): ${res.statusText}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error || parsed.message) {
        errorMessage = parsed.error || parsed.message;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText.substring(0, 200);
      }
    }
    throw new Error(errorMessage);
  }

  return res.json();
};

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

export const fetchRouterProfilesAPI = async (): Promise<RouterConfig[]> => {
  try {
    const response = await apiCall<{ profiles: RouterConfig[]; userData: UserData | null } | RouterConfig[]>(
      '/routers/profiles',
      { cache: 'no-store' }
    );

    if (Array.isArray(response)) {
      return response;
    }
    if (response && typeof response === 'object' && 'profiles' in response) {
      return response.profiles ?? [];
    }
    return [];
  } catch (e) {
    console.error("Fetch router profiles error:", e);
    return [];
  }
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
  } catch (e) {
    console.error("Fetch router profiles error:", e);
    return { profiles: [], userData: null };
  }
};

export const fetchProfilesAPI = async (routerId: string) => {
  return apiCall('/profiles', { routerId, cache: 'no-store' });
};

export const deleteProfileAPI = async (routerId: string, id: string) => {
  await apiCall('/profiles/remove', {
    method: 'POST',
    body: { id },
    routerId
  });
};

export const renameProfileAPI = async (routerId: string, id: string, newName: string, printLabel?: string, revenue?: string | number) => {
  await apiCall('/profiles/set', {
    method: 'POST',
    body: { id, name: newName, printLabel, revenue },
    routerId
  });
};

export const createProfileAPI = async (routerId: string, name: string, validity: string, limitMB?: number, isUnlimited?: boolean, printLabel?: string, revenue?: string | number) => {
  return apiCall('/profiles/add', {
    method: 'POST',
    body: { name, validity, limitMB, isUnlimited, printLabel, revenue },
    routerId
  });
};

export const fetchRecordsAPI = async (routerId: string): Promise<any[]> => {
  try {
    return await apiCall('/records', { routerId, cache: 'no-store' });
  } catch (e) {
    console.error("Fetch records error:", e);
    return [];
  }
};

export const createVouchersAPI = async (routerId: string, profile: string, count: number, length: number, comment?: string, limitBytesTotal?: number) => {
  const data = await apiCall<{ pins: string[] }>('/vouchers', {
    method: 'POST',
    body: { count, length, profile, comment, limitBytesTotal },
    routerId
  });
  return data.pins;
};

export const deleteVouchersAPI = async (routerId: string, ids: string[]) => {
  if (!ids || ids.length === 0) return;
  await apiCall('/vouchers/delete', {
    method: 'POST',
    body: { ids },
    routerId
  });
};

export const fetchNetworkClientsAPI = async (routerId: string) => {
  return apiCall('/network-clients', { routerId, cache: 'no-store' });
};

export const fetchVoucherBatchesAPI = async (routerId: string) => {
  return apiCall('/vouchers/batches', { routerId, cache: 'no-store' });
};

export const fetchVoucherBatchDetailAPI = async (routerId: string, profile: string, comment: string) => {
  return apiCall(`/vouchers/batches/detail?profile=${encodeURIComponent(profile)}&comment=${encodeURIComponent(comment)}`, { routerId, cache: 'no-store' });
};

export const removeActiveSessionAPI = async (routerId: string, id: string) => {
  await apiCall('/sessions/active/remove', {
    method: 'POST',
    body: { id },
    routerId
  });
};

export const formatUptimeAPI = (uptime: string): string => {
  if (!uptime || uptime === '0s' || uptime === '00:00:00' || uptime === 'Offline') return uptime === 'Offline' ? 'Offline' : '0m';

  let totalMins = 0;

  const weekMatch = uptime.match(/(\d+)w/);
  if (weekMatch) totalMins += parseInt(weekMatch[1]) * 7 * 24 * 60;

  const dayMatch = uptime.match(/(\d+)d/);
  if (dayMatch) totalMins += parseInt(dayMatch[1]) * 24 * 60;

  const timePart = uptime.match(/(\d{1,2}:){1,2}\d{1,2}/);
  if (timePart) {
    const parts = timePart[0].split(':').map(p => parseInt(p));
    if (parts.length === 3) {
      totalMins += parts[0] * 60 + parts[1];
    } else if (parts.length === 2) {
      totalMins += parts[0];
    }
  } else {
    const minMatch = uptime.match(/(\d+)m/);
    if (minMatch) totalMins += parseInt(minMatch[1]);
    const hourMatch = uptime.match(/(\d+)h/);
    if (hourMatch) totalMins += parseInt(hourMatch[1]) * 60;
  }

  if (totalMins === 0) return '0m';

  const d = Math.floor(totalMins / (24 * 60));
  const h = Math.floor((totalMins % (24 * 60)) / 60);
  const m = totalMins % 60;

  let res = '';
  if (d > 0) res += `${d}d `;
  if (h > 0) res += `${h}h `;
  if (m > 0 || res === '') res += `${m}m`;

  return res.trim();
};

export const setupWireguardTunnelAPI = async (routerId: string, routerData: any): Promise<any> => {
  return apiCall(`/wireguard/setup`, {
    method: 'POST',
    body: routerData,
    routerId
  });
};

export interface RouterProvisionStatus {
  online: boolean;
  timezone: string;
  wifiName: string;
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

export const fetchSingleRouterStatusAPI = async (id: string): Promise<RouterProvisionStatus> => {
  return apiCall(`/routers/${id}/status`, {
    cache: 'no-store',
    timeoutMs: 15000
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
  }
): Promise<{ success: boolean; message: string; updates?: string[]; errors?: string[] }> => {
  return apiCall(`/routers/${id}`, {
    method: 'PUT',
    body: data,
    timeoutMs: 270_000
  });
};

export const provisionHotspotFilesAPI = async (
  id: string,
  data: {
    wifiName?: string;
    supportName?: string;
    supportPhone?: string;
  }
): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/hotspot-files`, {
    method: 'POST',
    body: data,
    timeoutMs: 180_000
  });
};

export const provisionHotspotServerAPI = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/hotspot-server`, {
    method: 'POST',
    timeoutMs: 180_000
  });
};

export const provisionWifiSSIDAPI = async (id: string, wifiName: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/wifi-ssid`, {
    method: 'POST',
    body: { wifiName },
    timeoutMs: 180_000
  });
};

export const provisionTimezoneAPI = async (id: string, timezone: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}/provision/timezone`, {
    method: 'POST',
    body: { timezone },
    timeoutMs: 180_000
  });
};

export const deleteRouterProfileAPI = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiCall(`/routers/${id}`, {
    method: 'DELETE'
  });
};

export const fetchIpBindingsAPI = async (routerId: string): Promise<any[]> => {
  return apiCall('/ip-bindings', { routerId, cache: 'no-store' });
};

export const addIpBindingAPI = async (routerId: string, macAddress: string, ipAddress: string, comment: string, type = 'bypassed'): Promise<{ success: boolean }> => {
  return apiCall('/ip-bindings/add', {
    method: 'POST',
    body: { macAddress, ipAddress, comment, type },
    routerId
  });
};

export const removeIpBindingAPI = async (routerId: string, id: string): Promise<{ success: boolean }> => {
  return apiCall('/ip-bindings/remove', {
    method: 'POST',
    body: { id },
    routerId
  });
};

export const fetchMyClientInfoAPI = async (routerId: string): Promise<{ mac: string; ip: string; hostName?: string }> => {
  return apiCall('/my-client-info', { routerId, cache: 'no-store' });
};

interface GenerateScriptParams {
  id: string;
  name: string;
  model: string;
  wifiName: string;
  user: string;
  password: string;
  supportName?: string;
  supportPhone?: string;
  owners?: string[];
  timezone?: string;
}

export const generateCloudScriptAPI = async (params: GenerateScriptParams): Promise<{ script: string; router: any }> => {
  return apiCall('/routers/generate-script', {
    method: 'POST',
    body: params
  });
};

export const fetchAllRoutersStatusAPI = async (): Promise<any[]> => {
  try {
    return await apiCall('/routers', { cache: 'no-store' });
  } catch (e) {
    console.error("Fetch all routers status error:", e);
    return [];
  }
};

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
}

export const fetchRevenueStatsAPI = async (routerId: string, startDate?: string, endDate?: string): Promise<RevenueStatsPayload> => {
  let path = '/revenue-stats';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const queryString = params.toString();
  if (queryString) {
    path += `?${queryString}`;
  }
  return apiCall(path, { routerId, cache: 'no-store' });
};

export const registerUserAPI = async (): Promise<{ success: boolean; message: string }> => {
  return apiCall('/users/register', { method: 'POST' });
};

export const fetchRouterHistoryAPI = async (routerId: string, hours = 24, limit = 500): Promise<any[]> => {
  return apiCall(`/history?hours=${hours}&limit=${limit}`, { routerId, cache: 'no-store' });
};