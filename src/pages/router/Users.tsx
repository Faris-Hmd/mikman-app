import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchNetworkClientsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

interface NetworkClient {
  id?: string;
  name?: string;
  mac?: string;
  ip?: string;
  uptime?: string;
  signal?: number;
}

export default function UsersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: clients, isLoading } = useSWR(
    routerId ? `router-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const clientList: NetworkClient[] = Array.isArray(clients) ? clients : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('users.title')}
          </h2>
          <p className="hide-sm" style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            Router: {routerId}
          </p>
        </div>
      </div>
      {isLoading ? (
        <p>Loading users…</p>
      ) : clientList.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No connected clients.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clientList.map((client, idx) => (
            <div
              key={client.id || idx}
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
                <strong style={{ fontSize: '16px' }}>{client.name || 'Unnamed'}</strong>
                <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {client.mac && <span>MAC: {client.mac}</span>}
                  {client.ip && <span> • IP: {client.ip}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px' }}>
                {client.uptime && (
                  <div style={{ color: 'var(--text-muted)' }}>Up: {client.uptime}</div>
                )}
                {client.signal != null && (
                  <div style={{ fontWeight: 600 }}>
                    Signal: {client.signal}%
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