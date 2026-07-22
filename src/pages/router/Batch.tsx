import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchVoucherBatchesAPI,
  type VoucherBatch,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { Plus } from 'lucide-react';

export default function BatchPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Fetch batches
  const { data: batches, isLoading: batchesLoading } = useSWR(
    routerId ? `batch-list-${routerId}` : null,
    () => fetchVoucherBatchesAPI(routerId!),
    { revalidateOnFocus: true }
  );
  const batchList: VoucherBatch[] = Array.isArray(batches) ? batches : [];

  // ── Navigate ──

  const openBatchDetail = (batch: VoucherBatch) => {
    const params = new URLSearchParams();
    params.set('profile', batch.profile);
    if (batch.comment) params.set('comment', batch.comment);
    if (batch.printLabel) params.set('printLabel', batch.printLabel);
    navigate(`/${routerId}/batch/detail?${params.toString()}`);
  };

  const goToCreate = () => {
    navigate(`/${routerId}/vouchers`);
  };

  // ── Styles ──

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    padding: '16px',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '10px',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  // ── Render ──

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{t('batch.title')}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {t('batch.subtitle')}
          </p>
        </div>
        <button onClick={goToCreate} style={btnPrimary}>
          <Plus size={16} />
          {t('vouchers.generateVouchers') || 'Generate Vouchers'}
        </button>
      </div>

      {batchesLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : batchList.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No batches found. Generate your first batch!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {batchList.map((batch, idx) => (
            <div
              key={idx}
              onClick={() => openBatchDetail(batch)}
              style={{
                ...cardStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '15px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {batch.printLabel || batch.profile}
                </strong>
                <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {batch.comment || batch.profile}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--foreground)' }}>
                  {batch.originalCount} total
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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