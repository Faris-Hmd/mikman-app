import React from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchSingleRouterStatusAPI, RouterProvisionStatus } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function SettingsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: status, isLoading } = useSWR(
    routerId ? `router-settings-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { revalidateOnFocus: true }
  );

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2>{t('settings.title')}</h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Router: {routerId}</p>
      {isLoading ? (
        <p>Loading router settings…</p>
      ) : !status ? (
        <p style={{ color: 'var(--text-muted)' }}>Unable to load router status.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Status card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '15px' }}>Connection Status</strong>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: (status.online || status.status === 'online') ? '#16a34a20' : '#dc262620',
                  color: (status.online || status.status === 'online') ? '#16a34a' : '#dc2626',
                }}
              >
                {(status.online || status.status === 'online') ? 'Online' : 'Offline'}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>Timezone:</strong> {status.timezone || 'Not set'}</div>
              <div><strong>WiFi Name:</strong> {status.wifiName || 'Not set'}</div>
              {status.uptime_display && <div><strong>Uptime:</strong> {status.uptime_display}</div>}
              {status.uptime && !status.uptime_display && <div><strong>Uptime:</strong> {status.uptime}</div>}
              {status.activeUsers != null && <div><strong>Active Users:</strong> {status.activeUsers}</div>}
              {status.temperature_display && <div><strong>Temperature:</strong> {status.temperature_display}</div>}
              {status.temperature != null && !status.temperature_display && <div><strong>Temperature:</strong> {status.temperature}°C</div>}
              {status.cpuLoad_display && <div><strong>CPU Load:</strong> {status.cpuLoad_display}</div>}
              {status.cpuLoad != null && !status.cpuLoad_display && <div><strong>CPU Load:</strong> {status.cpuLoad}%</div>}
            </div>
          </div>

          {/* Hardware info */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '16px' }}>
            <strong style={{ fontSize: '15px' }}>Resource Usage</strong>
            {status.totalMemory != null && status.freeMemory != null ? (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Memory</span>
                  <span>
                    {Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024))} / {Math.round(Number(status.totalMemory) / (1024 * 1024))} MB
                  </span>
                </div>
                <div style={{ height: '8px', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(((Number(status.totalMemory) - Number(status.freeMemory)) / Number(status.totalMemory)) * 100))}%`,
                      background: 'var(--accent)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ) : (
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>Memory data unavailable.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}