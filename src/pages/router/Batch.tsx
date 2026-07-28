import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchVoucherBatchesAPI,
  type VoucherBatch,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Plus,
  Layers,
  Ticket,
  CheckCircle2,
  Zap,
  Clock,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Filter,
  PackageOpen,
  Printer
} from 'lucide-react';

export default function BatchPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();

  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Fetch batches
  const { data: batches, isLoading: batchesLoading } = useSWR(
    routerId ? `batch-list-${routerId}` : null,
    () => fetchVoucherBatchesAPI(routerId!),
    { revalidateOnFocus: false, dedupingInterval: 15000, keepPreviousData: true }
  );
  const batchList: VoucherBatch[] = Array.isArray(batches) ? batches : [];

  // Extract unique profiles for filter dropdown
  const uniqueProfiles = useMemo(() => {
    const profiles = new Set<string>();
    batchList.forEach((b) => {
      if (b.profile) profiles.add(b.profile);
    });
    return Array.from(profiles);
  }, [batchList]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalVouchers = 0;
    let totalUnused = 0;
    let totalActive = 0;
    let totalExpired = 0;

    batchList.forEach((b) => {
      totalVouchers += b.originalCount || 0;
      totalUnused += b.unusedCount || 0;
      totalActive += b.activeCount || 0;
      totalExpired += b.expiredCount || 0;
    });

    return {
      totalBatches: batchList.length,
      totalVouchers,
      totalUnused,
      totalActive,
      totalExpired,
    };
  }, [batchList]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batchList.filter((b) => {
      // Profile filter
      if (selectedProfile !== 'all' && b.profile !== selectedProfile) {
        return false;
      }
      return true;
    });
  }, [batchList, selectedProfile]);

  // ── Navigation ──

  const openBatchDetail = (batch: VoucherBatch) => {
    const params = new URLSearchParams();
    params.set('profile', batch.profile);
    if (batch.batchId) params.set('batchId', batch.batchId);
    if (batch.comment) params.set('comment', batch.comment);
    if (batch.printLabel) params.set('printLabel', batch.printLabel);
    navigate(`/${routerId}/batch/detail?${params.toString()}`);
  };

  const goToCreate = () => {
    navigate(`/${routerId}/vouchers`);
  };

  // ── Styles ──

  const cardGlassStyle: React.CSSProperties = {
    background: 'var(--card-bg, rgba(255, 255, 255, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '10px',
    padding: '10px 12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    padding: '7px 13px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--input-bg, rgba(0, 0, 0, 0.2))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '8px',
    padding: '6px 10px 6px 30px',
    color: 'var(--foreground)',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--card-bg, rgba(0, 0, 0, 0.2))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
    borderRadius: '8px',
    padding: '6px 10px',
    color: 'var(--foreground)',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* ─── Page Header ─── */}
      <div className="responsive-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '8px 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.4) 100%)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(99,102,241,0.3)',
            flexShrink: 0
          }}>
            <Printer size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('batch.title')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {routerId && !routerId.startsWith('cloud_') && (
                <>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'rgba(var(--primary-rgb), 0.1)',
                    padding: '1px 5px',
                    borderRadius: '5px',
                    flexShrink: 0
                  }}>
                    {routerId}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
                </>
              )}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats.totalBatches} {t('batch.totalBatches') || 'batches'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={goToCreate}
          style={{
            background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 6px rgba(59,130,246,0.3)',
            flexShrink: 0
          }}
        >
          <Plus size={13} />
          <span style={{ whiteSpace: 'nowrap' }}>{t('batch.createBatch') || 'إنشاء كروت'}</span>
        </button>
      </div>

      {/* Summary Statistics Cards */}
      <div className="batch-stat-grid">
        {/* Card 1: Total Batches */}
        <div className="batch-stat-card" style={cardGlassStyle}>
          <div
            className="batch-stat-card-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
              flexShrink: 0,
            }}
          >
            <Layers size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="batch-stat-card-label" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('batch.totalBatches')}
            </span>
            <strong className="batch-stat-card-val" style={{ color: 'var(--foreground)' }}>
              {stats.totalBatches}
            </strong>
          </div>
        </div>

        {/* Card 2: Total Vouchers */}
        <div className="batch-stat-card" style={cardGlassStyle}>
          <div
            className="batch-stat-card-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(14, 165, 233, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0ea5e9',
              flexShrink: 0,
            }}
          >
            <Ticket size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="batch-stat-card-label" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('batch.totalVouchers')}
            </span>
            <strong className="batch-stat-card-val" style={{ color: 'var(--foreground)' }}>
              {stats.totalVouchers}
            </strong>
          </div>
        </div>

        {/* Card 3: Unused Vouchers */}
        <div className="batch-stat-card" style={cardGlassStyle}>
          <div
            className="batch-stat-card-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="batch-stat-card-label" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('batch.unusedVouchers')}
            </span>
            <strong className="batch-stat-card-val" style={{ color: '#22c55e' }}>
              {stats.totalUnused}
            </strong>
          </div>
        </div>

        {/* Card 4: Active Vouchers */}
        <div className="batch-stat-card" style={cardGlassStyle}>
          <div
            className="batch-stat-card-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
              flexShrink: 0,
            }}
          >
            <Zap size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="batch-stat-card-label" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('batch.activeVouchers')}
            </span>
            <strong className="batch-stat-card-val" style={{ color: '#3b82f6' }}>
              {stats.totalActive}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        {/* Profile Filter Dropdown with Embedded Icon */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Filter
            size={14}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              [isRtl ? 'right' : 'left']: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            style={{
              ...selectStyle,
              paddingLeft: isRtl ? '12px' : '30px',
              paddingRight: isRtl ? '30px' : '12px',
            }}
          >
            <option value="all">{t('batch.allProfiles')}</option>
            {uniqueProfiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle (Grid vs List) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '3px',
            gap: '2px',
          }}
        >
          <button
            onClick={() => setViewMode('grid')}
            title={t('batch.viewGrid')}
            style={{
              background: viewMode === 'grid' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title={t('batch.viewList')}
            style={{
              background: viewMode === 'list' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '7px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {batchesLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr',
            gap: '14px',
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...cardGlassStyle,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="skeleton" style={{ width: '120px', height: '14px' }} />
                    <div className="skeleton" style={{ width: '80px', height: '11px' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '6px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div className="skeleton" style={{ height: '32px', borderRadius: '8px' }} />
                <div className="skeleton" style={{ height: '32px', borderRadius: '8px' }} />
                <div className="skeleton" style={{ height: '32px', borderRadius: '8px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBatches.length === 0 ? (
        <div
          style={{
            ...cardGlassStyle,
            textAlign: 'center',
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <PackageOpen size={28} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--foreground)' }}>
              {t('batch.noBatchesFound')}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', maxWidth: '380px' }}>
              {t('batch.noBatchesDesc')}
            </p>
          </div>
          <button onClick={goToCreate} style={{ ...btnPrimaryStyle, marginTop: '8px' }}>
            <Plus size={15} />
            <span>{t('batch.generateBtn')}</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '14px',
          }}
        >
          {filteredBatches.map((batch, idx) => {
            const unusedPct = batch.originalCount ? (batch.unusedCount / batch.originalCount) * 100 : 0;
            const activePct = batch.originalCount ? (batch.activeCount / batch.originalCount) * 100 : 0;
            const expiredPct = batch.originalCount ? (batch.expiredCount / batch.originalCount) * 100 : 0;

            return (
              <div
                key={idx}
                onClick={() => openBatchDetail(batch)}
                style={{
                  ...cardGlassStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary, #3b82f6)';
                  e.currentTarget.style.background = 'var(--card-bg-hover, rgba(255, 255, 255, 0.08))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border, rgba(255, 255, 255, 0.1))';
                  e.currentTarget.style.background = 'var(--card-bg, rgba(255, 255, 255, 0.05))';
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--foreground)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {batch.printLabel || batch.profile}
                    </h4>
                    {batch.comment && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {batch.comment}
                      </span>
                    )}
                  </div>
                  <ChevronIcon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                </div>

                {/* Profile Chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: '#818cf8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {batch.profile}
                  </span>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    height: '6px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    display: 'flex',
                    width: '100%',
                  }}
                >
                  <div style={{ width: `${unusedPct}%`, background: '#22c55e', height: '100%' }} title={`Unused: ${batch.unusedCount}`} />
                  <div style={{ width: `${activePct}%`, background: '#3b82f6', height: '100%' }} title={`Active: ${batch.activeCount}`} />
                  <div style={{ width: `${expiredPct}%`, background: 'rgba(255, 255, 255, 0.25)', height: '100%' }} title={`Expired: ${batch.expiredCount}`} />
                </div>

                {/* Footer Metrics */}
                <div
                  className="batch-footer-metrics"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '4px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--glass-border, rgba(255, 255, 255, 0.05))',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                      {t('batch.total')}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                      {batch.originalCount}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                      {t('batch.statusUnused')}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#22c55e' }}>
                      {batch.unusedCount}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                      {t('batch.statusActive')}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#3b82f6' }}>
                      {batch.activeCount}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                      {t('batch.statusExpired')}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {batch.expiredCount}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredBatches.map((batch, idx) => (
            <div
              key={idx}
              onClick={() => openBatchDetail(batch)}
              style={{
                ...cardGlassStyle,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '12px',
                flexWrap: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary, #3b82f6)';
                e.currentTarget.style.background = 'var(--card-bg-hover, rgba(255, 255, 255, 0.08))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border, rgba(255, 255, 255, 0.1))';
                e.currentTarget.style.background = 'var(--card-bg, rgba(255, 255, 255, 0.05))';
              }}
            >
              {/* Left Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {batch.printLabel || batch.profile}
                  </strong>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: '#818cf8',
                      flexShrink: 0,
                    }}
                  >
                    {batch.profile}
                  </span>
                </div>
                {batch.comment && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {batch.comment}
                  </div>
                )}
              </div>

              {/* Right Metrics - Responsive Grid (3 cols on mobile, 4 cols on desktop) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div
                  className="batch-metrics-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(52px, 68px))',
                    gap: '4px',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', lineHeight: 1.1 }}>
                      {t('batch.total')}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--foreground)', lineHeight: 1.4 }}>
                      {batch.originalCount}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', lineHeight: 1.1 }}>
                      {t('batch.statusUnused')}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#22c55e', lineHeight: 1.4 }}>
                      {batch.unusedCount}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', lineHeight: 1.1 }}>
                      {t('batch.statusActive')}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#3b82f6', lineHeight: 1.4 }}>
                      {batch.activeCount}
                    </strong>
                  </div>
                  <div className="hide-on-mobile">
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', lineHeight: 1.1 }}>
                      {t('batch.statusExpired')}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {batch.expiredCount}
                    </strong>
                  </div>
                </div>
                <ChevronIcon size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}