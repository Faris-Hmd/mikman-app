import React from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { Server } from 'lucide-react';
import { fetchRouterProfilesAPI, fetchSingleRouterStatusAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function RouterDashboardPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: status, isLoading: isStatusLoading } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 30000, revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  const isConnected = !!(status?.online || status?.status === 'online');

  const { data: profileData } = useSWR(
    routerId ? `router-profile-${routerId}` : null,
    async () => {
      const profiles = await fetchRouterProfilesAPI();
      return profiles.find((item: any) => item.id === routerId) || null;
    },
    { revalidateOnFocus: true }
  );
  const activeRouter = profileData;

  return (
    <div style={{ padding: '16px', paddingBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>
        {activeRouter?.name || t('sidebar.dashboard')}
      </h2>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>MikroTik Gateway</p>
      <p>Welcome to the per-router dashboard. Status: {isConnected ? 'Online' : 'Offline'}</p>
    </div>
  );
}