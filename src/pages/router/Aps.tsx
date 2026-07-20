import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchNetworkClientsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

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

  const { data: clients, isLoading } = useSWR(
    routerId ? `router-aps-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const apList: AccessPoint[] = Array.isArray(clients) ? clients : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>{t('aps.title')}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Router: {routerId}</p>
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