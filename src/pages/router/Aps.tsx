import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchNetworkClientsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

import { Radio, RefreshCw } from 'lucide-react';

interface AccessPoint {
  id?: string;
  name?: string;
  mac?: string;
  ip?: string;
  ssid?: string;
  channel?: number;
  signal?: number;
  uptime?: string;
}

export default function ApsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: clients, isLoading, mutate } = useSWR(
    routerId ? `router-aps-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const apList: AccessPoint[] = Array.isArray(clients) ? clients : [];

  return (
    <div className="responsive-container">
      {/* ─── Page Header ─── */}
      <div className="responsive-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.4) 100%)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(16,185,129,0.3)',
            flexShrink: 0
          }}>
            <Radio size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('aps.title')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {routerId && !routerId.startsWith('cloud_') && (
                <>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'rgba(var(--primary-rgb), 0.1)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    flexShrink: 0
                  }}>
                    {routerId}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>•</span>
                </>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {apList.length} {t('aps.totalAps') || 'access points'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '10px',
            border: '1px solid var(--glass-border)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>{t('common.refresh') || 'Refresh'}</span>
        </button>
      </div>
      {isLoading ? (
        <p>Loading access point data…</p>
      ) : apList.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No access points found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {apList.map((ap, idx) => (
            <div
              key={ap.id || idx}
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
                <strong style={{ fontSize: '16px' }}>{ap.name || ap.ssid || 'Unnamed AP'}</strong>
                <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {ap.mac && <span>MAC: {ap.mac}</span>}
                  {ap.ip && <span> • IP: {ap.ip}</span>}
                  {ap.ssid && <span> • SSID: {ap.ssid}</span>}
                </div>
                {ap.channel != null && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Channel: {ap.channel}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px' }}>
                {ap.uptime && (
                  <div style={{ color: 'var(--text-muted)' }}>Up: {ap.uptime}</div>
                )}
                {ap.signal != null && (
                  <div style={{ fontWeight: 600 }}>
                    Signal: {ap.signal}%
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