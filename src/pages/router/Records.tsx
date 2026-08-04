import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRecordsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

import {
  FileText,
  RefreshCw,
  Search,
  X,
  PlusCircle,
  Trash2,
  Edit3,
  Clock,
  User,
  Copy,
  Check,
  Shield,
  Layers,
  UserCheck,
  Code,
  List,
  Info,
  Tag
} from 'lucide-react';

interface AuditRecord {
  id: string;
  routerId?: string;
  action: string;
  operator?: string;
  details?: string | any;
  timestamp?: string;
}

interface ParsedChip {
  key: string;
  label: string;
  value: string;
  color?: string;
}

interface ParsedLog {
  rawJson: string;
  summaryText: string;
  chips: ParsedChip[];
  parsedObject: Record<string, any> | null;
  isParsed: boolean;
}

const formatDate = (isoString: string | undefined): string => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
};

const formatDetails = (details: string | any): string => {
  if (!details) return '—';
  if (typeof details === 'object') {
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }
  if (typeof details === 'string') {
    if (details.trim().startsWith('{') || details.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(details);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return details;
      }
    }
    return details;
  }
  return String(details);
};

const parseRecordDetails = (details: string | any, action: string, t: (k: string) => string): ParsedLog => {
  const rawStr = formatDetails(details);
  if (!details || rawStr === '—') {
    return {
      rawJson: '—',
      summaryText: '—',
      chips: [],
      parsedObject: null,
      isParsed: false
    };
  }

  let obj: any = null;
  if (typeof details === 'object' && details !== null) {
    obj = details;
  } else if (typeof details === 'string') {
    const trimmed = details.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        obj = JSON.parse(trimmed);
      } catch {
        obj = null;
      }
    }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return {
      rawJson: rawStr,
      summaryText: rawStr,
      chips: [],
      parsedObject: null,
      isParsed: false
    };
  }

  const chips: ParsedChip[] = [];
  const act = action.toUpperCase();

  // Known key mappings for pretty chips
  if (obj.count !== undefined) {
    chips.push({ key: 'count', label: t('records.keyCount') || 'Count', value: String(obj.count), color: '#10b981' });
  }
  if (obj.profile) {
    chips.push({ key: 'profile', label: t('records.keyProfile') || 'Profile', value: String(obj.profile), color: '#a855f7' });
  }
  if (obj.comment) {
    chips.push({ key: 'comment', label: t('records.keyComment') || 'Group', value: String(obj.comment), color: '#3b82f6' });
  }
  if (obj.batchId) {
    chips.push({ key: 'batchId', label: t('records.keyBatchId') || 'Batch ID', value: String(obj.batchId), color: '#6366f1' });
  }
  if (obj.price) {
    chips.push({ key: 'price', label: t('records.keyPrice') || 'Price', value: String(obj.price), color: '#f59e0b' });
  }
  if (obj.rateLimit) {
    chips.push({ key: 'rateLimit', label: t('records.keyRateLimit') || 'Speed', value: String(obj.rateLimit), color: '#06b6d4' });
  }
  if (obj.uptimeLimit) {
    chips.push({ key: 'uptimeLimit', label: t('records.keyUptimeLimit') || 'Time Limit', value: String(obj.uptimeLimit), color: '#ec4899' });
  }
  if (obj.limitBytesTotal) {
    const mb = Math.round(Number(obj.limitBytesTotal) / (1024 * 1024));
    chips.push({ key: 'limitBytesTotal', label: t('records.keyLimitBytesTotal') || 'Data Limit', value: mb > 0 ? `${mb} MB` : String(obj.limitBytesTotal), color: '#3b82f6' });
  }
  if (obj.macAddress || obj.mac) {
    chips.push({ key: 'macAddress', label: t('records.keyMacAddress') || 'MAC', value: String(obj.macAddress || obj.mac), color: '#14b8a6' });
  }
  if (obj.ipAddress || obj.ip) {
    chips.push({ key: 'ipAddress', label: t('records.keyIpAddress') || 'IP', value: String(obj.ipAddress || obj.ip), color: '#8b5cf6' });
  }
  if (obj.pins && Array.isArray(obj.pins)) {
    chips.push({ key: 'pins', label: t('records.keyPins') || 'Vouchers', value: `${obj.pins.length} items`, color: '#ef4444' });
  }
  if (obj.name) {
    chips.push({ key: 'name', label: t('records.keyName') || 'Name', value: String(obj.name), color: '#3b82f6' });
  }

  // Generic key-value fallback for unmapped keys
  const knownKeys = ['count', 'profile', 'comment', 'batchId', 'price', 'rateLimit', 'uptimeLimit', 'limitBytesTotal', 'macAddress', 'mac', 'ipAddress', 'ip', 'pins', 'name'];
  Object.keys(obj).forEach(k => {
    if (!knownKeys.includes(k)) {
      const val = obj[k];
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        chips.push({ key: k, label: k, value: String(val) });
      }
    }
  });

  // Compose localized summary sentence
  let summaryText = '';
  if (act.includes('CREATE_BATCH') || (act.includes('CREATE') && obj.count)) {
    const groupStr = obj.comment ? ` (${obj.comment})` : '';
    const profStr = obj.profile ? ` • ${obj.profile}` : '';
    summaryText = `${obj.count} vouchers generated${profStr}${groupStr}`;
  } else if (act.includes('DELETE_BATCH') || (act.includes('DELETE') && obj.count)) {
    const countVal = obj.count || (obj.pins ? obj.pins.length : '');
    summaryText = `Bulk deletion of ${countVal} vouchers`;
  } else if (act.includes('PROFILE')) {
    summaryText = `Profile configuration update for "${obj.name || obj.profile || 'Profile'}"`;
  } else if (act.includes('BYPASS') || act.includes('BINDING')) {
    summaryText = `IP Binding configured for device (${obj.macAddress || obj.ipAddress || 'MAC/IP'})`;
  } else {
    summaryText = chips.map(c => `${c.label}: ${c.value}`).join(' • ') || rawStr;
  }

  return {
    rawJson: rawStr,
    summaryText,
    chips,
    parsedObject: obj,
    isParsed: true
  };
};

export default function RecordsPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'create' | 'delete' | 'other'>('all');
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: recordsData, isLoading, mutate } = useSWR(
    routerId ? `router-records-${routerId}` : null,
    () => fetchRecordsAPI(routerId!),
    { revalidateOnFocus: true }
  );

  const recordList: AuditRecord[] = useMemo(() => {
    if (!Array.isArray(recordsData)) return [];
    return recordsData.map((item: any, index: number) => ({
      id: String(item.id || item._id || item['.id'] || `log-${index}`),
      routerId: item.routerId || item.router_id || routerId,
      action: String(item.action || item.type || item.event || 'UNKNOWN').toUpperCase(),
      operator: item.operator || item.user || item.username || item.admin || 'System',
      details: item.details || item.data || item.description || '',
      timestamp: item.timestamp || item.created_at || item.createdAt || item.date || '',
    }));
  }, [recordsData, routerId]);

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter records
  const filteredRecords = useMemo(() => {
    return recordList.filter(rec => {
      const q = searchQuery.toLowerCase().trim();
      const detailsStr = formatDetails(rec.details).toLowerCase();
      const matchesSearch =
        !q ||
        rec.action.toLowerCase().includes(q) ||
        (rec.operator && rec.operator.toLowerCase().includes(q)) ||
        detailsStr.includes(q) ||
        rec.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (activeTab === 'create') {
        return rec.action.includes('CREATE') || rec.action.includes('ADD') || rec.action.includes('GENERATE');
      }
      if (activeTab === 'delete') {
        return rec.action.includes('DELETE') || rec.action.includes('REMOVE') || rec.action.includes('CLEAR');
      }
      if (activeTab === 'other') {
        const isCreate = rec.action.includes('CREATE') || rec.action.includes('ADD') || rec.action.includes('GENERATE');
        const isDelete = rec.action.includes('DELETE') || rec.action.includes('REMOVE') || rec.action.includes('CLEAR');
        return !isCreate && !isDelete;
      }

      return true;
    });
  }, [recordList, searchQuery, activeTab]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let creationsCount = 0;
    let deletionsCount = 0;
    const operatorsSet = new Set<string>();

    recordList.forEach(r => {
      if (r.action.includes('CREATE') || r.action.includes('ADD') || r.action.includes('GENERATE')) {
        creationsCount++;
      } else if (r.action.includes('DELETE') || r.action.includes('REMOVE') || r.action.includes('CLEAR')) {
        deletionsCount++;
      }
      if (r.operator) operatorsSet.add(r.operator);
    });

    return {
      totalRecords: recordList.length,
      creationsCount,
      deletionsCount,
      operatorsCount: operatorsSet.size,
    };
  }, [recordList]);

  const getActionBadgeStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('CLEAR')) {
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        icon: <Trash2 size={13} />,
      };
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('GENERATE')) {
      return {
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        icon: <PlusCircle size={13} />,
      };
    }
    if (act.includes('BYPASS') || act.includes('BINDING')) {
      return {
        bg: 'rgba(168, 85, 247, 0.15)',
        color: '#a855f7',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        icon: <Shield size={13} />,
      };
    }
    return {
      bg: 'rgba(59, 130, 246, 0.15)',
      color: '#3b82f6',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      icon: <Edit3 size={13} />,
    };
  };

  const selectedParsedLog = useMemo(() => {
    if (!selectedRecord) return null;
    return parseRecordDetails(selectedRecord.details, selectedRecord.action, t);
  }, [selectedRecord, t]);

  return (
    <div className="responsive-container" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ─── Page Header ─── */}
      <div
        className="responsive-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
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
            }}
          >
            <FileText size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 800,
                color: 'var(--foreground)',
                letterSpacing: '-0.2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {t('records.title')}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {t('records.subtitle')}
            </p>
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

      {/* ─── Summary Stat Header Grid ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '4px'
        }}
      >
        {/* Total Operations */}
        <div
          className="responsive-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Layers size={14} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('records.totalRecords')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
              {stats.totalRecords}
            </div>
          </div>
        </div>

        {/* Creations */}
        <div
          className="responsive-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <PlusCircle size={14} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('records.creations')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>
              {stats.creationsCount}
            </div>
          </div>
        </div>

        {/* Deletions */}
        <div
          className="responsive-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Trash2 size={14} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('records.deletions')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>
              {stats.deletionsCount}
            </div>
          </div>
        </div>

        {/* Unique Operators */}
        <div
          className="responsive-card"
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <UserCheck size={14} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('records.operators')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
              {stats.operatorsCount}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search and Tabs Controls ─── */}
      <div
        className="responsive-card"
        style={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              [isRtl ? 'right' : 'left']: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('records.searchPlaceholder')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              paddingTop: '8px',
              paddingBottom: '8px',
              paddingLeft: isRtl ? '10px' : '32px',
              paddingRight: isRtl ? '32px' : '10px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--foreground)',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                [isRtl ? 'left' : 'right']: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: activeTab === 'all' ? '1px solid #a855f7' : '1px solid var(--glass-border)',
              background: activeTab === 'all' ? 'rgba(168,85,247,0.15)' : 'var(--glass-bg)',
              color: activeTab === 'all' ? '#a855f7' : 'var(--foreground)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t('records.allRecords')} ({recordList.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: activeTab === 'create' ? '1px solid #10b981' : '1px solid var(--glass-border)',
              background: activeTab === 'create' ? 'rgba(16,185,129,0.15)' : 'var(--glass-bg)',
              color: activeTab === 'create' ? '#10b981' : 'var(--foreground)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t('records.filterCreate')} ({stats.creationsCount})
          </button>
          <button
            onClick={() => setActiveTab('delete')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: activeTab === 'delete' ? '1px solid #ef4444' : '1px solid var(--glass-border)',
              background: activeTab === 'delete' ? 'rgba(239,68,68,0.15)' : 'var(--glass-bg)',
              color: activeTab === 'delete' ? '#ef4444' : 'var(--foreground)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t('records.filterDelete')} ({stats.deletionsCount})
          </button>
          <button
            onClick={() => setActiveTab('other')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: activeTab === 'other' ? '1px solid #3b82f6' : '1px solid var(--glass-border)',
              background: activeTab === 'other' ? 'rgba(59,130,246,0.15)' : 'var(--glass-bg)',
              color: activeTab === 'other' ? '#3b82f6' : 'var(--foreground)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {t('records.filterOther')}
          </button>
        </div>
      </div>

      {/* ─── Record Items List ─── */}
      {isLoading ? (
        <div
          className="responsive-card"
          style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
          <p style={{ margin: 0, fontSize: '13px' }}>{t('records.loadingRecords')}</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div
          className="responsive-card"
          style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}
        >
          <Shield size={32} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--foreground)' }}>
            {t('records.noRecordsFound')}
          </h3>
          <p style={{ margin: 0, fontSize: '12px' }}>{t('records.noRecordsDesc')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredRecords.map(record => {
            const badge = getActionBadgeStyle(record.action);
            const parsedLog = parseRecordDetails(record.details, record.action, t);

            return (
              <div
                key={record.id}
                onClick={() => {
                  setSelectedRecord(record);
                  setShowRawJson(false);
                }}
                className="list-item-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Top row: Action Badge & Timestamp */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: badge.bg,
                        color: badge.color,
                        border: badge.border,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {badge.icon}
                      <span>{record.action}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <User size={12} />
                      <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{record.operator}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <Clock size={11} />
                    <span>{formatDate(record.timestamp)}</span>
                  </div>
                </div>

                {/* Parsed Log Summary & Chips */}
                {parsedLog.summaryText && parsedLog.summaryText !== '—' && (
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.15)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--foreground)' }}>
                      <Info size={13} style={{ color: badge.color, flexShrink: 0 }} />
                      <span>{parsedLog.summaryText}</span>
                    </div>

                    {parsedLog.chips.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                        {parsedLog.chips.map(chip => (
                          <span
                            key={chip.key}
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: chip.color ? `${chip.color}15` : 'var(--glass-bg)',
                              color: chip.color || 'var(--foreground)',
                              border: `1px solid ${chip.color ? `${chip.color}35` : 'var(--glass-border)'}`
                            }}
                          >
                            {chip.label}: <strong style={{ fontWeight: 800 }}>{chip.value}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Detailed Record Glassmorphism Modal ─── */}
      {selectedRecord && selectedParsedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="responsive-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: getActionBadgeStyle(selectedRecord.action).bg,
                    color: getActionBadgeStyle(selectedRecord.action).color,
                    border: getActionBadgeStyle(selectedRecord.action).border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                    {t('records.recordDetails')}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ID: {selectedRecord.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* View Mode Toggle: Structured vs Raw JSON */}
            <div
              style={{
                display: 'flex',
                background: 'var(--glass-bg)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)'
              }}
            >
              <button
                onClick={() => setShowRawJson(false)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: !showRawJson ? 'rgba(168,85,247,0.2)' : 'transparent',
                  color: !showRawJson ? '#a855f7' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <List size={13} />
                <span>{t('records.viewStructured') || 'Structured View'}</span>
              </button>
              <button
                onClick={() => setShowRawJson(true)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: showRawJson ? 'rgba(168,85,247,0.2)' : 'transparent',
                  color: showRawJson ? '#a855f7' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Code size={13} />
                <span>{t('records.viewRawJson') || 'Raw JSON'}</span>
              </button>
            </div>

            {/* Metadata Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('records.action')}</span>
                <span style={{ fontWeight: 800, color: getActionBadgeStyle(selectedRecord.action).color }}>
                  {selectedRecord.action}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('records.operator')}</span>
                <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                  {selectedRecord.operator || 'System'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('records.timestamp')}</span>
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                  {formatDate(selectedRecord.timestamp)}
                </span>
              </div>
            </div>

            {/* Structured Parameters Panel */}
            {!showRawJson ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Summary Banner */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: getActionBadgeStyle(selectedRecord.action).bg,
                    border: getActionBadgeStyle(selectedRecord.action).border,
                    color: 'var(--foreground)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  <Info size={15} style={{ color: getActionBadgeStyle(selectedRecord.action).color, flexShrink: 0 }} />
                  <span>{selectedParsedLog.summaryText}</span>
                </div>

                {/* Parsed Chips / Parameters Grid */}
                {selectedParsedLog.chips.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px' }}>
                      {t('records.parsedKeys')}
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      {selectedParsedLog.chips.map(chip => (
                        <div
                          key={chip.key}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                        >
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {chip.label}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: chip.color || 'var(--foreground)', wordBreak: 'break-all' }}>
                            {chip.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Array of Pins / Vouchers list preview if available */}
                {selectedParsedLog.parsedObject?.pins && Array.isArray(selectedParsedLog.parsedObject.pins) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      <Tag size={12} />
                      <span>{t('records.keyPins')} ({selectedParsedLog.parsedObject.pins.length})</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        maxHeight: '100px',
                        overflowY: 'auto',
                        padding: '8px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      {selectedParsedLog.parsedObject.pins.map((pin: string, idx: number) => (
                        <span
                          key={idx}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          {pin}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Raw JSON Panel */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px' }}>
                  {t('records.rawJson')}
                </span>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: 'var(--foreground)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}
                >
                  {selectedParsedLog.rawJson}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => handleCopy(selectedRecord.id, 'id')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--foreground)',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {copiedField === 'id' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedField === 'id' ? t('records.copied') : t('records.copyId')}</span>
              </button>

              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-color, #a855f7)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('records.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}