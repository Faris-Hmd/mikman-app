import { useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRevenueStatsAPI, RevenueStatsPayload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function RevenuePage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const { data: revenue, isLoading } = useSWR(
    routerId ? `router-revenue-page-${routerId}` : null,
    () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return fetchRevenueStatsAPI(routerId!, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    },
    { revalidateOnFocus: true }
  );

  const periodData = revenue
    ? viewMode === 'daily'
      ? revenue.daily
      : viewMode === 'weekly'
      ? revenue.weekly
      : revenue.monthly
    : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>{t('revenue.title')}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Router: {routerId}</p>

      {isLoading ? (
        <p>Loading revenue data…</p>
      ) : !revenue ? (
        <p style={{ color: 'var(--text-muted)' }}>No revenue data available.</p>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Revenue</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
                ${Number(revenue.totalRevenue).toFixed(2)}
              </div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Vouchers</div>
              <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
                {revenue.totalVouchers}
              </div>
            </div>
          </div>

          {/* Profile breakdown */}
          {revenue.profiles && revenue.profiles.length > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px' }}>
              <strong style={{ fontSize: '15px' }}>By Profile</strong>
              {revenue.profiles.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: idx < revenue.profiles.length - 1 ? '1px solid var(--glass-border)' : 'none',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{p.profile}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      ({p.count} vouchers)
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>${Number(p.revenue).toFixed(2)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Period toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '10px',
                  background: viewMode === mode ? 'var(--accent)' : 'var(--card-bg)',
                  color: viewMode === mode ? '#fff' : 'var(--foreground)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Period data list */}
          {periodData && periodData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {periodData.map((entry: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px' }}>{entry.label || entry.date}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{entry.count} vouchers</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>
                    ${Number(entry.revenue).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No {viewMode} data for this period.</p>
          )}
        </>
      )}
    </div>
  );
}