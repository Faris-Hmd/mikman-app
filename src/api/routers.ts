import { mutate } from 'swr';
import { apiCall, logError } from './client';
import type { RouterConfig } from '../store';
import type {
  UserData,
  RouterProfilesResponse,
  RouterProvisionStatus,
  RouterInterfacesResponse,
  UploadJobStatus,
  PortForwardsResponse,
  GenerateScriptParams,
} from './types';

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

export const fetchRouterProfilesAPI = async (): Promise<RouterConfig[]> => {
  const { profiles } = await fetchRouterProfilesWithUserAPI();
  return profiles;
};

export const fetchSingleRouterStatusAPI = async (id: string): Promise<RouterProvisionStatus> => {
  return apiCall<RouterProvisionStatus>(`/routers/${id}/status`, {
    cache: 'no-store',
    timeoutMs: 15_000,
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
    useCustomHotspotName?: boolean;
    cardPrintLabel?: string;
    useCustomPrintLabel?: boolean;
  }
): Promise<{ success: boolean; message: string; updates?: string[]; errors?: string[] }> => {
  return apiCall(`/routers/${id}`, {
    method: 'PUT',
    body: data,
    timeoutMs: 270_000,
  });
};

export const deleteRouterProfileAPI = async (id: string): Promise<{ success: boolean; message: string }> => {
  const result = await apiCall<{ success: boolean; message: string }>(`/routers/${id}`, {
    method: 'DELETE',
  });
  mutate('router-profiles');
  mutate('router-statuses');
  mutate('all-routers-status');
  mutate((key: any) => typeof key === 'string' && key.includes(id), undefined, { revalidate: false });
  return result;
};

export const fetchRouterInterfacesAPI = async (routerId: string): Promise<RouterInterfacesResponse> => {
  return apiCall<RouterInterfacesResponse>(`/routers/${routerId}/interfaces`, { cache: 'no-store' });
};

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

export const setupWireguardTunnelAPI = async (routerId: string, routerData: Record<string, unknown>): Promise<unknown> => {
  return apiCall('/wireguard/setup', {
    method: 'POST',
    body: routerData,
    routerId,
  });
};

export const fetchPortForwardsAPI = async (routerId: string): Promise<PortForwardsResponse> => {
  return apiCall<PortForwardsResponse>('/port-forwards', { routerId, cache: 'no-store' });
};

export const addPortForwardAPI = async (
  routerId: string,
  data: { toAddress: string; toPort?: number | string; dstPort: number | string; protocol?: string; comment?: string }
): Promise<{ success: boolean; routerVpnIp?: string }> => {
  return apiCall('/port-forwards/add', {
    method: 'POST',
    body: data,
    routerId,
  });
};

export const removePortForwardAPI = async (
  routerId: string,
  id?: string,
  toAddress?: string
): Promise<{ success: boolean }> => {
  return apiCall('/port-forwards/remove', {
    method: 'POST',
    body: { id, toAddress },
    routerId,
  });
};

export const generateCloudScriptAPI = async (params: GenerateScriptParams): Promise<{ script: string; router: unknown }> => {
  return apiCall('/routers/generate-script', {
    method: 'POST',
    body: params,
  });
};

export const fetchRouterHistoryAPI = async (
  _routerId: string,
  _hours = 24,
  _limit = 500
): Promise<any[]> => {
  return Promise.resolve([]);
};
