import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRecordsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import RecordDetailModal, { AuditRecord, ParsedChip, ParsedLog } from '../../components/records/RecordDetailModal';
import './Records.css';

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
  Shield,
  Layers,
  Info
} from 'lucide-react';

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
    chips.push({ key: 'count', label: t('records.keyCount') || 'Count', value: String(obj.count), color: 'var(--success)' });
  }
  if (obj.profile) {
    chips.push({ key: 'profile', label: t('records.keyProfile') || 'Profile', value: String(obj.profile), color: 'var(--primary)' });
  }
  if (obj.comment) {
    chips.push({ key: 'comment', label: t('records.keyComment') || 'Group', value: String(obj.comment), color: 'var(--primary-text)' });
  }
  if (obj.batchId) {
    chips.push({ key: 'batchId', label: t('records.keyBatchId') || 'Batch ID', value: String(obj.batchId), color: 'var(--primary)' });
  }
  if (obj.price) {
    chips.push({ key: 'price', label: t('records.keyPrice') || 'Price', value: String(obj.price), color: 'var(--warning)' });
  }
  if (obj.rateLimit) {
    chips.push({ key: 'rateLimit', label: t('records.keyRateLimit') || 'Speed', value: String(obj.rateLimit), color: 'var(--primary)' });
  }
  if (obj.uptimeLimit) {
    chips.push({ key: 'uptimeLimit', label: t('records.keyUptimeLimit') || 'Time Limit', value: String(obj.uptimeLimit), color: 'var(--warning)' });
  }
  if (obj.limitBytesTotal) {
    const mb = Math.round(Number(obj.limitBytesTotal) / (1024 * 1024));
    chips.push({ key: 'limitBytesTotal', label: t('records.keyLimitBytesTotal') || 'Data Limit', value: mb > 0 ? `${mb} MB` : String(obj.limitBytesTotal), color: 'var(--primary-text)' });
  }
  if (obj.macAddress || obj.mac) {
    chips.push({ key: 'macAddress', label: t('records.keyMacAddress') || 'MAC', value: String(obj.macAddress || obj.mac), color: 'var(--text-muted)' });
  }
  if (obj.ipAddress || obj.ip) {
    chips.push({ key: 'ipAddress', label: t('records.keyIpAddress') || 'IP', value: String(obj.ipAddress || obj.ip), color: 'var(--text-muted)' });
  }
  if (obj.pins && Array.isArray(obj.pins)) {
    chips.push({ key: 'pins', label: t('records.keyPins') || 'Vouchers', value: `${obj.pins.length} items`, color: 'var(--danger)' });
  }
  if (obj.name) {
    chips.push({ key: 'name', label: t('records.keyName') || 'Name', value: String(obj.name), color: 'var(--primary-text)' });
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
  const [displayLimit, setDisplayLimit] = useState(50);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setDisplayLimit(50);
  }, [searchQuery, activeTab]);

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

    const otherCount = recordList.length - creationsCount - deletionsCount;

    return {
      totalRecords: recordList.length,
      creationsCount,
      deletionsCount,
      otherCount,
      operatorsCount: operatorsSet.size,
    };
  }, [recordList]);

  const getActionBadgeStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('CLEAR')) {
      return {
        bg: 'var(--danger-bg-subtle)',
        color: 'var(--danger)',
        border: '1px solid var(--danger-border-subtle)',
        icon: <Trash2 size={13} />,
        type: 'delete',
      };
    }
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('GENERATE')) {
      return {
        bg: 'var(--success-bg-subtle)',
        color: 'var(--success)',
        border: '1px solid var(--success-border-subtle)',
        icon: <PlusCircle size={13} />,
        type: 'create',
      };
    }
    if (act.includes('BYPASS') || act.includes('BINDING')) {
      return {
        bg: 'var(--primary-bg-subtle)',
        color: 'var(--primary)',
        border: '1px solid var(--primary-border-subtle)',
        icon: <Shield size={13} />,
        type: 'bypass',
      };
    }
    return {
      bg: 'var(--primary-bg-subtle)',
      color: 'var(--primary-text)',
      border: '1px solid var(--primary-border-subtle)',
      icon: <Edit3 size={13} />,
      type: 'other',
    };
  };

  const selectedParsedLog = useMemo(() => {
    if (!selectedRecord) return null;
    return parseRecordDetails(selectedRecord.details, selectedRecord.action, t);
  }, [selectedRecord, t]);

  return (
    <div className={`responsive-container ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* ─── Page Header ─── */}
      <div className="page-header-card">
        <div className="flex-row-center gap-10 min-w-0">
          <div className="page-header-icon">
            <FileText />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="page-header-title">
              {t('records.title')}
            </h2>
            <p className="page-header-subtitle">
              {t('records.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={() => mutate()}
          className="page-header-btn records-btn-solid records-btn-blue"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hide-sm-only">{t('common.refresh') || 'Refresh'}</span>
        </button>
      </div>

      {/* ─── 2. Overview Stat Cards / Interactive Group Tabs ─── */}
      <div className="records-stat-grid">
        {/* Total Operations */}
        <div
          onClick={() => setActiveTab('all')}
          className={`records-stat-tab ${activeTab === 'all' ? 'active-all' : ''}`}
        >
          <div className="records-stat-icon">
            <Layers size={14} />
          </div>
          <div className="records-stat-content">
            <div className="records-stat-label">
              {t('records.totalRecords')}
            </div>
            <div className="records-stat-val">
              {isLoading ? '—' : stats.totalRecords}
            </div>
          </div>
        </div>

        {/* Creations */}
        <div
          onClick={() => setActiveTab('create')}
          className={`records-stat-tab ${activeTab === 'create' ? 'active-create' : ''}`}
        >
          <div className="records-stat-icon">
            <PlusCircle size={14} />
          </div>
          <div className="records-stat-content">
            <div className="records-stat-label">
              {t('records.creations')}
            </div>
            <div className="records-stat-val text-emerald-500">
              {isLoading ? '—' : stats.creationsCount}
            </div>
          </div>
        </div>

        {/* Deletions */}
        <div
          onClick={() => setActiveTab('delete')}
          className={`records-stat-tab ${activeTab === 'delete' ? 'active-delete' : ''}`}
        >
          <div className="records-stat-icon">
            <Trash2 size={14} />
          </div>
          <div className="records-stat-content">
            <div className="records-stat-label">
              {t('records.deletions')}
            </div>
            <div className="records-stat-val text-red-500">
              {isLoading ? '—' : stats.deletionsCount}
            </div>
          </div>
        </div>

        {/* Other Operations */}
        <div
          onClick={() => setActiveTab('other')}
          className={`records-stat-tab ${activeTab === 'other' ? 'active-other' : ''}`}
        >
          <div className="records-stat-icon">
            <Edit3 size={14} />
          </div>
          <div className="records-stat-content">
            <div className="records-stat-label">
              {t('records.filterOther') || 'Other'}
            </div>
            <div className="records-stat-val text-blue-500">
              {isLoading ? '—' : stats.otherCount}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search Input Filter Bar ─── */}
      <div className="records-search-wrapper">
        <Search
          size={14}
          className={`records-search-icon ${isRtl ? 'rtl' : 'ltr'}`}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('records.searchPlaceholder')}
          className={`records-search-input ${isRtl ? 'rtl' : 'ltr'}`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className={`records-search-clear ${isRtl ? 'rtl' : 'ltr'}`}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ─── Record Items List ─── */}
      {isLoading ? (
        <div className="responsive-card records-empty-box">
          <RefreshCw size={24} className="spin mx-auto mb-2 block" />
          <p className="m-0 text-sm">{t('records.loadingRecords')}</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="responsive-card records-empty-box">
          <Shield size={32} className="mx-auto mb-2 block opacity-50" />
          <h3 className="m-0 text-sm font-bold text-foreground">
            {t('records.noRecordsFound')}
          </h3>
          <p className="m-0 text-xs text-muted">{t('records.noRecordsDesc')}</p>
        </div>
      ) : (
        <div className="records-list">
          {filteredRecords.slice(0, displayLimit).map(record => {
            const badge = getActionBadgeStyle(record.action);
            const parsedLog = parseRecordDetails(record.details, record.action, t);

            return (
              <div
                key={record.id}
                onClick={() => {
                  setSelectedRecord(record);
                  setShowRawJson(false);
                }}
                className="records-item-card"
              >
                {/* Top row: Action Badge & Timestamp */}
                <div className="records-item-header">
                  <div className="records-item-meta">
                    <div className={`records-action-tag ${badge.type}`}>
                      {badge.icon}
                      <span>{record.action}</span>
                    </div>

                    <div className="records-operator-info">
                      <User size={12} />
                      <span className="font-semibold text-foreground">{record.operator}</span>
                    </div>
                  </div>

                  <div className="records-timestamp-info">
                    <Clock size={11} />
                    <span>{formatDate(record.timestamp)}</span>
                  </div>
                </div>

                {/* Parsed Log Summary & Chips */}
                {parsedLog.summaryText && parsedLog.summaryText !== '—' && (
                  <div className="records-summary-box">
                    <div className="records-summary-title">
                      <Info size={13} color={badge.color} />
                      <span>{parsedLog.summaryText}</span>
                    </div>

                    {parsedLog.chips.length > 0 && (
                      <div className="records-chips-row">
                        {parsedLog.chips.map(chip => (
                          <span
                            key={chip.key}
                            className="records-chip-item"
                            style={{ ['--chip-color' as any]: chip.color }}
                          >
                            {chip.label}: <strong>{chip.value}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredRecords.length > displayLimit && (
            <button
              onClick={() => setDisplayLimit(prev => prev + 50)}
              className="records-load-more-btn"
            >
              {t('batch.loadMoreRemaining')?.replace('{count}', String(filteredRecords.length - displayLimit)) ||
                `Load More Remaining (${filteredRecords.length - displayLimit})`}
            </button>
          )}
        </div>
      )}

      {/* ─── Detailed Record Glassmorphism Modal ─── */}
      {selectedRecord && selectedParsedLog && (
        <RecordDetailModal
          record={selectedRecord}
          parsedLog={selectedParsedLog}
          onClose={() => setSelectedRecord(null)}
          onCopy={handleCopy}
          copiedField={copiedField}
          showRawJson={showRawJson}
          setShowRawJson={setShowRawJson}
          formatDate={formatDate}
          getActionBadgeStyle={getActionBadgeStyle}
        />
      )}
    </div>
  );
}
