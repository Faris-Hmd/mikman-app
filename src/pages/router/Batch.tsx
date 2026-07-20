import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchVoucherBatchesAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

interface Batch {
  profile: string;
  comment: string;
  count: number;
  created_at: string;
}

export default function BatchPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: batches, isLoading } = useSWR(
    routerId ? `router-batches-${routerId}` : null,
    () => fetchVoucherBatchesAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const batchList: Batch[] = Array.isArray(batches) ? batches : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>{t('batch.title')}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Router: {routerId}</p>
      {isLoading ? (
        <p>Loading batch data…</p>
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
                <strong style={{ fontSize: '16px' }}>{batch.profile}</strong>
                <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {batch.comment || 'No comment'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{batch.count} vouchers</div>
                {batch.created_at && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(batch.created_at).toLocaleDateString()}
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