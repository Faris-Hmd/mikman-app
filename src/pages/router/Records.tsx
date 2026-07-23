import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRecordsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

interface Record {
  id?: string;
  user?: string;
  mac?: string;
  ip?: string;
  profile?: string;
  startTime?: string;
  endTime?: string;
  uptime?: string;
  rxBytes?: number;
  txBytes?: number;
  rxPackets?: number;
  txPackets?: number;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
};

export default function RecordsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t } = useLanguage();

  const { data: records, isLoading } = useSWR(
    routerId ? `router-records-${routerId}` : null,
    () => fetchRecordsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const recordList: Record[] = Array.isArray(records) ? records : [];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('records.title')}
          </h2>
          <p className="hide-sm" style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            Router: {routerId}
          </p>
        </div>
      </div>
      {isLoading ? (
        <p>Loading records…</p>
      ) : recordList.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No records found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recordList.map((record, idx) => (
            <div
              key={record.id || idx}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '16px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '16px' }}>{record.user || record.mac || 'Unknown'}</strong>
                {record.profile && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'var(--glass-bg)', padding: '4px 10px', borderRadius: '8px' }}>
                    {record.profile}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {record.ip && <span>IP: {record.ip}</span>}
                {record.mac && <span>MAC: {record.mac}</span>}
                {record.uptime && <span>Duration: {record.uptime}</span>}
                {record.rxBytes != null && record.txBytes != null && (
                  <span>Traffic: ↓{formatBytes(record.rxBytes)} / ↑{formatBytes(record.txBytes)}</span>
                )}
              </div>
              {record.startTime && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Started: {new Date(record.startTime).toLocaleString()}
                  {record.endTime && ` — Ended: ${new Date(record.endTime).toLocaleString()}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}