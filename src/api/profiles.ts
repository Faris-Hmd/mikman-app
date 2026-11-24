import { apiCall } from './client';

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
