import { mutate } from 'swr';
import { apiCall } from './client';
import type {
  VoucherBatch,
  VoucherSummary,
  ActiveVoucher,
  ExpiredVoucher,
  VoucherBatchDetail,
  VoucherSearchResult,
  VoucherJobStatus,
} from './types';

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
  if (keys && keys.length > 0) {
    keys.forEach((key) => mutate(key));
    return;
  }
  mutate(`active-users-${routerId}`);
  mutate(`network-clients-${routerId}`);
  mutate(`batch-list-${routerId}`);
  mutate(`voucher-batches-${routerId}`);
  mutate(`voucher-profiles-${routerId}`);
  mutate(`router-profiles-${routerId}`);
  mutate((key: any) => typeof key === 'string' && key.includes(`batch-detail-${routerId}`), undefined, { revalidate: true });
};

export const deleteVouchersAPI = async (routerId: string, ids: string[], sync = false): Promise<void> => {
  if (!ids || ids.length === 0) return;
  await apiCall(sync ? '/vouchers/delete?sync=true' : '/vouchers/delete', {
    method: 'POST',
    body: { ids },
    routerId,
    timeoutMs: sync ? 120_000 : 30_000,
  });
};

export const enableVouchersAPI = async (routerId: string, names: string[]): Promise<{ success: boolean; enabledCount: number }> => {
  if (!names || names.length === 0) return { success: true, enabledCount: 0 };
  return apiCall<{ success: boolean; enabledCount: number }>('/vouchers/enable', {
    method: 'POST',
    body: { names },
    routerId,
  });
};

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

export const formatLoginDateDisplay = (rawStr: string): { displayDate: string; fullDate: string; relativeSince: string | null } => {
  if (!rawStr) return { displayDate: '', fullDate: '', relativeSince: null };

  const fullDate = rawStr.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
  const currentYear = new Date().getFullYear().toString();
  const displayDate = fullDate.replace(new RegExp(`[-/]${currentYear}|${currentYear}[-/]`, 'g'), '').trim();

  let dateObj: Date | null = null;
  const ts = Date.parse(rawStr);
  if (!isNaN(ts)) {
    dateObj = new Date(ts);
  } else {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    const m1 = rawStr.match(/([a-zA-Z]{3})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})/i);
    const m2 = rawStr.match(/(\d{1,2})\/([a-zA-Z]{3})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})/i);

    if (m1) {
      const monthIdx = months[m1[1].toLowerCase()];
      if (monthIdx !== undefined) {
        const day = parseInt(m1[2], 10);
        const year = m1[3] ? parseInt(m1[3], 10) : new Date().getFullYear();
        const hr = parseInt(m1[4], 10);
        const min = parseInt(m1[5], 10);
        dateObj = new Date(year, monthIdx, day, hr, min);
      }
    } else if (m2) {
      const monthIdx = months[m2[2].toLowerCase()];
      if (monthIdx !== undefined) {
        const day = parseInt(m2[1], 10);
        const year = m2[3] ? parseInt(m2[3], 10) : new Date().getFullYear();
        const hr = parseInt(m2[4], 10);
        const min = parseInt(m2[5], 10);
        dateObj = new Date(year, monthIdx, day, hr, min);
      }
    }
  }

  let relativeSince: string | null = null;
  if (dateObj && !isNaN(dateObj.getTime())) {
    const diffMs = Date.now() - dateObj.getTime();
    if (diffMs > 0) {
      const mins = Math.floor(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) relativeSince = `${days}d`;
      else if (hours > 0) relativeSince = `${hours}h`;
      else if (mins > 0) relativeSince = `${mins}m`;
      else relativeSince = 'now';
    }
  }

  return { displayDate, fullDate, relativeSince };
};

export const getLoginTimestampMs = (v: any): number => {
  if (!v) return 0;
  let rawDateStr: string | null = null;
  const rawComment = String(v.comment || v.remarks || '');
  if (rawComment.includes('login:')) {
    const match = rawComment.match(/login:\s*([^\s,;]+(?:\s+[^\s,;]+)?)/i);
    if (match && match[1]) {
      rawDateStr = match[1];
    }
  }
  if (!rawDateStr) {
    rawDateStr = v['first-login'] || v.loginDate || v.firstLogin || v.startTime || v['start-time'] || v.uptime || null;
  }
  if (!rawDateStr) return 0;

  const ts = Date.parse(rawDateStr);
  if (!isNaN(ts)) return ts;

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  const m1 = rawDateStr.match(/([a-zA-Z]{3})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})/i);
  const m2 = rawDateStr.match(/(\d{1,2})\/([a-zA-Z]{3})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})/i);

  if (m1) {
    const monthIdx = months[m1[1].toLowerCase()];
    if (monthIdx !== undefined) {
      const day = parseInt(m1[2], 10);
      const year = m1[3] ? parseInt(m1[3], 10) : new Date().getFullYear();
      const hr = parseInt(m1[4], 10);
      const min = parseInt(m1[5], 10);
      return new Date(year, monthIdx, day, hr, min).getTime();
    }
  } else if (m2) {
    const monthIdx = months[m2[2].toLowerCase()];
    if (monthIdx !== undefined) {
      const day = parseInt(m2[1], 10);
      const year = m2[3] ? parseInt(m2[3], 10) : new Date().getFullYear();
      const hr = parseInt(m2[4], 10);
      const min = parseInt(m2[5], 10);
      return new Date(year, monthIdx, day, hr, min).getTime();
    }
  }

  return 0;
};

export const sortByLoginDate = <T,>(vouchers: T[]): T[] => {
  return [...vouchers].sort((a, b) => getLoginTimestampMs(b) - getLoginTimestampMs(a));
};
