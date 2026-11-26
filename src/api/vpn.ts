import { apiCall } from './client';
import type { ServerVpnConfigResponse, UserPeerStatusItem } from './types';

export const fetchUserVpnPeersStatusAPI = async (clientPublicKey?: string): Promise<UserPeerStatusItem[]> => {
  try {
    const params = new URLSearchParams();
    if (clientPublicKey) params.append('clientPublicKey', clientPublicKey);
    const queryString = params.toString();
    const path = `/user/vpn-peers/status${queryString ? `?${queryString}` : ''}`;
    const res = await apiCall<{ success: boolean; peers: any[] }>(path, { cache: 'no-store' });
    const rawPeers = res.peers || [];
    return rawPeers
      .map((p: any) => {
        const pk = (p.publicKey || p.clientPublicKey || p.public_key || p.key || '').trim();
        const ip = (p.clientIp || p.ip || p.client_ip || '').trim();
        const name = (p.name || p.deviceName || p.device_name || '').trim();
        const rawType = (p.deviceType || p.device_type || '').toLowerCase();
        const isPhone = rawType === 'phone' || name.toLowerCase().includes('phone');
        const deviceType = (isPhone ? 'phone' : 'pc') as 'pc' | 'phone' | 'device';
        return {
          publicKey: pk,
          clientIp: ip,
          name: name || (isPhone ? 'Admin Phone' : 'Admin PC'),
          deviceType,
          endpoint: p.endpoint,
          latestHandshake: p.latestHandshake || 0,
          lastHandshakeHuman: p.lastHandshakeHuman || p.last_handshake_human || 'Never',
          isOnline: Boolean(p.isOnline ?? p.online),
          transferRx: p.transferRx || 0,
          transferTx: p.transferTx || 0,
        };
      })
      .filter((p: UserPeerStatusItem) => (p.publicKey && p.publicKey.length > 0) || (p.clientIp && p.clientIp.length > 0));
  } catch (e) {
    return [];
  }
};

export const deleteUserVpnPeerAPI = async (publicKey: string, clientIp?: string): Promise<boolean> => {
  try {
    const res = await apiCall<{ success: boolean; message: string }>('/user/vpn-peers/delete', {
      method: 'POST',
      body: { publicKey, clientIp },
    });
    return Boolean(res?.success);
  } catch (e: any) {
    const msg = e?.message || 'Failed to delete peer';
    throw new Error(msg);
  }
};

export const fetchUserVpnConfigAPI = async (
  clientPublicKey?: string,
  deviceName?: string,
  deviceType?: 'pc' | 'phone' | 'device',
  register = false
): Promise<ServerVpnConfigResponse | null> => {
  try {
    const params = new URLSearchParams();
    if (clientPublicKey) params.append('clientPublicKey', clientPublicKey);
    if (deviceName) params.append('deviceName', deviceName);
    if (deviceType) params.append('deviceType', deviceType);
    if (register) params.append('register', 'true');
    const queryString = params.toString();
    const path = `/user/vpn-config${queryString ? `?${queryString}` : ''}`;
    return await apiCall<ServerVpnConfigResponse>(path, { cache: 'no-store' });
  } catch (e) {
    if (register) {
      throw e;
    }
    return null;
  }
};

export const saveUserVpnPeerAPI = async (
  clientPublicKey: string,
  deviceName: string,
  deviceType: 'pc' | 'phone' | 'device'
): Promise<ServerVpnConfigResponse | null> => {
  try {
    return await apiCall<ServerVpnConfigResponse>('/user/vpn-config', {
      method: 'POST',
      body: {
        clientPublicKey,
        deviceName,
        deviceType,
        register: true,
      },
    });
  } catch (e) {
    return null;
  }
};
