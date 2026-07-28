import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRecordsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

import { FileText, RefreshCw } from 'lucide-react';

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

  const { data: records, isLoading, mutate } = useSWR(
    routerId ? `router-records-${routerId}` : null,
    () => fetchRecordsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const recordList: Record[] = Array.isArray(records) ? records : [];

  return (
    <div className="responsive-container">
      {/* ─── Page Header ─── */}
      <div className="responsive-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '8px',
        padding: '8px 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(147,51,234,0.4) 100%)',
            color: '#a855f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(168,85,247,0.3)',
            flexShrink: 0
          }}>
            <FileText size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('records.title')}
            </h2>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid var(--glass-border)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>{t('common.refresh') || 'Refresh'}</span>
        </button>
      </div>
      {isLoading ? (
        <p>Loading records…</p>
      ) : recordList.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No records found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recordList.map((record, idx) => (
            <div
              key={record.id || idx}
              className="list-item-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                alignItems: 'stretch'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong className="item-title">{record.user || record.mac || 'Unknown'}</strong>
                {record.profile && (
                  <span className="item-badge" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>
                    {record.profile}
                  </span>
                )}
              </div>
              <div className="item-subtext" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {record.ip && <span>IP: {record.ip}</span>}
                {record.mac && <span>MAC: {record.mac}</span>}
                {record.uptime && <span>Duration: {record.uptime}</span>}
                {record.rxBytes != null && record.txBytes != null && (
                  <span>Traffic: ↓{formatBytes(record.rxBytes)} / ↑{formatBytes(record.txBytes)}</span>
                )}
              </div>
              {record.startTime && (
                <div className="item-subtext" style={{ marginTop: '1px' }}>
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