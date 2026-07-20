import React from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchProfilesAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

interface Profile {
  id: string;
  name: string;
  validity: string;
  limitMB?: number;
  isUnlimited?: boolean;
  printLabel?: string;
  revenue?: number;
  count?: number;
}

export default function ProfilesPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: profiles, isLoading } = useSWR(
    routerId ? `router-profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const profileList: Profile[] = Array.isArray(profiles) ? profiles : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>{t('profiles.title')}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Router: {routerId}</p>
      {isLoading ? (
        <p>Loading profile data…</p>
      ) : profileList.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No profiles found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {profileList.map((profile) => (
            <div
              key={profile.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ fontSize: '16px' }}>{profile.name}</strong>
                <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Validity: {profile.validity}
                  {profile.isUnlimited ? ' • Unlimited' : profile.limitMB ? ` • ${profile.limitMB} MB` : ''}
                </div>
                {profile.printLabel && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Label: {profile.printLabel}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '14px' }}>
                {profile.revenue != null && (
                  <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    ${Number(profile.revenue).toFixed(2)}
                  </div>
                )}
                {profile.count != null && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {profile.count} vouchers
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}