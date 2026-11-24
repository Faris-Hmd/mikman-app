import { apiCall, logError } from './client';
import type { RevenueStatsPayload, SubscriptionHistoryEntry, PlanCatalogItem } from './types';

export const registerUserAPI = async (): Promise<{ success: boolean; message: string }> => {
  return apiCall('/users/register', { method: 'POST' });
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

export const fetchPlansCatalogAPI = async (): Promise<PlanCatalogItem[]> => {
  try {
    const res = await apiCall<{ plans: PlanCatalogItem[] }>('/users/plans');
    return res.plans || [];
  } catch (e) {
    logError('Fetch plans catalog error:', e);
    return [];
  }
};
