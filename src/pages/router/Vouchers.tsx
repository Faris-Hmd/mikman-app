import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchProfilesAPI, fetchVoucherBatchesAPI, type VoucherBatch } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

interface Profile {
  id: string;
  name: string;
  validity: string;
  limitMB?: number;
  isUnlimited?: boolean;
}

export default function VouchersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'profiles' | 'batches'>('profiles');

  const { data: profiles, isLoading: profilesLoading } = useSWR(
    routerId ? `voucher-profiles-${routerId}` : null,
    () => fetchProfilesAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const { data: batches, isLoading: batchesLoading } = useSWR(
    routerId ? `voucher-batches-${routerId}` : null,
    () => fetchVoucherBatchesAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const profileList: Profile[] = Array.isArray(profiles) ? profiles : [];
  const batchList: VoucherBatch[] = Array.isArray(batches) ? batches : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>{t('vouchers.title')}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Router: {routerId}</p>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('profiles')}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'profiles' ? 'var(--accent)' : 'var(--card-bg)',
            color: activeTab === 'profiles' ? '#fff' : 'var(--foreground)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Profiles ({profileList.length})
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: 'none',
            borderRadius: '12px',
            background: activeTab === 'batches' ? 'var(--accent)' : 'var(--card-bg)',
            color: activeTab === 'batches' ? '#fff' : 'var(--foreground)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Batches ({batchList.length})
        </button>
      </div>

      {profilesLoading || batchesLoading ? (
        <p>Loading voucher data…</p>
      ) : activeTab === 'profiles' ? (
        profileList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No profiles available.</p>
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
                </div>
              </div>
            ))}
          </div>
        )
      ) : batchList.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No batches found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {batchList.map((batch, idx) => (
            <div
              key={idx}
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
                <strong style={{ fontSize: '16px' }}>
                  {batch.printLabel || batch.profile}
                </strong>
                <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {batch.comment || 'No comment'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>
                  {batch.originalCount} vouchers
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--success)' }}>{batch.unusedCount} unused</span>
                  <span style={{ color: 'var(--accent)' }}>{batch.activeCount} active</span>
                  <span style={{ color: 'var(--text-muted)' }}>{batch.expiredCount} expired</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}