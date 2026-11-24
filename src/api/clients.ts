import { apiCall, logError } from './client';

export const fetchNetworkClientsAPI = async (routerId: string): Promise<unknown> => {
  return apiCall('/network-clients', { routerId, cache: 'no-store' });
};

export const fetchRecordsAPI = async (routerId: string): Promise<any[]> => {
  try {
    return await apiCall<any[]>('/vouchers/records', { routerId, cache: 'no-store' });
  } catch (e) {
    logError('Fetch records error:', e);
    return [];
  }
};

export const fetchIpBindingsAPI = async (routerId: string): Promise<any[]> => {
  const res = await apiCall<any[]>('/ip-bindings', { routerId, cache: 'no-store' });
  return Array.isArray(res) ? res : [];
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
