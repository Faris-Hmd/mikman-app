import { useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import {
  fetchVoucherBatchDetailAPI,
  deleteVouchersAPI,
  searchVouchersAPI,
  getVoucherCodesAPI,
  getAllVouchersByStatusAPI,
  type VoucherBatchDetail,
  type VoucherSummary,
  type ActiveVoucher,
  type ExpiredVoucher,
  type VoucherSearchResult,
} from '../../api';
import {
  Trash2,
  Search,
  Printer,
  Copy,
  Check,
  ChevronLeft,
  X,
  Info,
} from 'lucide-react';

type StatusFilter = 'all' | 'unused' | 'active' | 'expired';

export default function BatchDetailPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const profile = searchParams.get('profile') || '';
  const comment = searchParams.get('comment') || undefined;
  const printLabel = searchParams.get('printLabel') || undefined;

  // Detail state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VoucherSearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAllModal, setShowAllModal] = useState<'unused' | 'active' | 'expired' | null>(null);
  const [allVouchers, setAllVouchers] = useState<(VoucherSummary | ActiveVoucher | ExpiredVoucher)[] | null>(null);
  const [allVouchersLoading, setAllVouchersLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Info modal
  const [infoVoucher, setInfoVoucher] = useState<ActiveVoucher | ExpiredVoucher | VoucherSummary | VoucherSearchResult | null>(null);
  const [infoStatus, setInfoStatus] = useState<'unused' | 'active' | 'expired'>('unused');

  // Print/export state
  const [printCodes, setPrintCodes] = useState<string[] | null>(null);
  const [printLoading, setPrintLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Selection for deletion
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch batch detail
  const { data: batchDetail, isLoading: detailLoading } = useSWR(
    routerId && profile
      ? `batch-detail-${routerId}-${profile}-${comment || 'none'}`
      : null,
    () => fetchVoucherBatchDetailAPI(routerId!, profile, comment, printLabel),
    { revalidateOnFocus: true }
  );

  // ── Helpers ──

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshDetail = () => {
    if (routerId && profile) {
      mutate(`batch-detail-${routerId}-${profile}-${comment || 'none'}`);
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toLocaleString();
    } catch {
      return d;
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes == null) return '—';
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  // ── Delete ──

  const handleDeleteSelected = async () => {
    if (!routerId || selectedCodes.size === 0) return;
    try {
      setDeleteLoading(true);
      await deleteVouchersAPI(routerId, Array.from(selectedCodes));
      setSelectedCodes(new Set());
      showToast(`Deleted ${selectedCodes.size} vouchers.`, 'success');
      refreshDetail();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete vouchers.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSingle = async (code: string) => {
    if (!routerId) return;
    try {
      await deleteVouchersAPI(routerId, [code]);
      showToast(`Deleted voucher "${code}".`, 'success');
      refreshDetail();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete voucher.', 'error');
    }
  };

  const toggleCodeSelection = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectAllInView = (codes: string[]) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const allSelected = codes.every((c) => next.has(c));
      if (allSelected) {
        codes.forEach((c) => next.delete(c));
      } else {
        codes.forEach((c) => next.add(c));
      }
      return next;
    });
  };

  // ── Search ──

  const handleSearch = useCallback(async () => {
    if (!routerId || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setSearchLoading(true);
      const result = await searchVouchersAPI(
        routerId,
        searchQuery.trim(),
        profile,
        comment,
        printLabel
      );
      setSearchResults(result.results);
    } catch (err: any) {
      showToast(err?.message || 'Search failed.', 'error');
    } finally {
      setSearchLoading(false);
    }
  }, [routerId, searchQuery, profile, comment, printLabel]);

  // ── Print / Export ──

  const handlePrintVouchers = async () => {
    if (!routerId) return;
    try {
      setPrintLoading(true);
      const result = await getVoucherCodesAPI(
        routerId,
        profile,
        comment,
        printLabel,
        'all'
      );
      const codes = result.codes || [];
      if (codes.length === 0) {
        showToast('No vouchers to print.', 'error');
        return;
      }
      const w = window.open('', '_blank', 'width=800,height=900');
      if (!w) {
        setPrintCodes(codes);
        setShowPrintModal(true);
        return;
      }
      const title = printLabel || profile;
      const cards = codes.map((code: string) => `
        <tr class="vn">
          <td class="vl">HOTSPOT VOUCHER</td>
          <td class="vc" rowspan="2">${code}</td>
        </tr>
        <tr class="vn">
          <td class="vm">${title}<br/><span style="font-size:7px;color:#aaa">${new Date().toLocaleDateString()}</span></td>
        </tr>`).join('\n');
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;color:#000;background:#fff;padding:20px}
  h2{text-align:center;font-size:16px;margin-bottom:2px}
  h3{text-align:center;font-size:10px;color:#666;font-weight:400;margin-bottom:16px;border-bottom:1px solid #ccc;padding-bottom:8px}
  table{width:100%;border-collapse:collapse}
  tr.vn{border-bottom:1px dashed #ccc}
  td.vl{font-size:7px;color:#999;text-transform:uppercase;letter-spacing:1px;padding:8px 8px 4px;vertical-align:top}
  td.vc{font-size:17px;font-weight:900;letter-spacing:2px;padding:8px 12px;vertical-align:middle;text-align:right;border-left:1px solid #e0e0e0;width:1%;white-space:nowrap}
  td.vm{font-size:8px;color:#666;padding:4px 8px 8px;vertical-align:bottom}
  @media print{
    body{padding:0}
    @page{margin:8mm}
  }
</style></head>
<body><h2>${title}</h2><h3>${codes.length} vouchers</h3><table>${cards}</table></body></html>`;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
    } catch (err: any) {
      showToast(err?.message || 'Failed to print.', 'error');
    } finally {
      setPrintLoading(false);
    }
  };

  const handleShowAll = async (status: 'unused' | 'active' | 'expired') => {
    if (!routerId) return;
    try {
      setAllVouchersLoading(true);
      setShowAllModal(status);
      const result = await getAllVouchersByStatusAPI(
        routerId,
        profile,
        status,
        comment,
        printLabel
      );
      setAllVouchers(result.vouchers);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load vouchers.', 'error');
    } finally {
      setAllVouchersLoading(false);
    }
  };

  const copyPrintCodes = () => {
    if (!printCodes) return;
    navigator.clipboard.writeText(printCodes.join('\n'));
    showToast(`Copied ${printCodes.length} codes!`, 'success');
  };

  const copySingleCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const backToList = () => {
    navigate(`/${routerId}/batch`);
  };

  // ── Styles ──

  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    padding: '16px',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px',
    border: 'none',
    borderRadius: '10px',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px',
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    background: 'transparent',
    color: 'var(--foreground)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  // ── Pie / Donut Chart ──

  const COLORS = {
    unused: '#22c55e',
    active: '#3b82f6',
    expired: '#94a3b8',
  };

  const renderDonutChart = (unused: number, active: number, expired: number) => {
    const total = unused + active + expired;
    if (total === 0) return null;

    const segments = [
      { value: unused, color: COLORS.unused, label: 'Unused' },
      { value: active, color: COLORS.active, label: 'Active' },
      { value: expired, color: COLORS.expired, label: 'Expired' },
    ].filter((s) => s.value > 0);

    const size = 130;
    const strokeWidth = 28;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    let dashOffset = 0;

    const arcs = segments.map((seg) => {
      const pct = seg.value / total;
      const dashLength = pct * circumference;
      const offset = dashOffset;
      dashOffset -= dashLength;

      return { ...seg, pct, dashLength, offset };
    });

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease' }}
            />
          ))}
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '20px', fontWeight: 800, fill: 'var(--foreground)' }}
          >
            {total}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {segments.map((seg) => {
            const pct = Math.round((seg.value / total) * 100);
            return (
              <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '3px',
                    backgroundColor: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', minWidth: '50px' }}>
                  {seg.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {seg.value}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>
                  ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: Voucher Card ──

  const renderVoucherCard = (
    voucher: VoucherSummary | ActiveVoucher | ExpiredVoucher,
    status: 'unused' | 'active' | 'expired'
  ) => {
    const name = voucher.name || (voucher as any)['.id'] || '';

    const active = voucher as ActiveVoucher;
    const isActive = status === 'active';
    const isExpired = status === 'expired';

    return (
      <div
        key={name}
        style={{
          ...cardStyle,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderColor: isExpired ? 'rgba(239, 68, 68, 0.25)' : 'var(--glass-border)',
          background: isExpired ? 'rgba(239, 68, 68, 0.06)' : 'var(--card-bg)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: isExpired ? 'var(--text-muted)' : 'var(--foreground)' }}>{name}</strong>
            <button
              onClick={() => copySingleCode(name)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: copiedCode === name ? 'var(--success)' : 'var(--text-muted)',
              }}
              title="Copy code"
            >
              {copiedCode === name ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          {isActive && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {active.deviceName && <span>Device: {active.deviceName}</span>}
              {active.ipAddress && <span>IP: {active.ipAddress}</span>}
              {active.timeLeftText && <span style={{ color: 'var(--accent)' }}>{active.timeLeftText}</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setInfoVoucher(voucher as any);
            setInfoStatus(status);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-muted)',
            borderRadius: '6px',
          }}
          title="View details"
        >
          <Info size={14} />
        </button>
        <button
          onClick={() => handleDeleteSingle(name)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-muted)',
            borderRadius: '6px',
          }}
          title="Delete voucher"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  // ── Render: Voucher Info Modal ──

  const renderInfoModal = () => {
    if (!infoVoucher) return null;

    const name = (infoVoucher as any).name || (infoVoucher as any)['.id'] || '';
    const v = infoVoucher as ActiveVoucher & ExpiredVoucher;
    const isActive = infoStatus === 'active';
    const isExpired = infoStatus === 'expired';

    const rows: { label: string; value: string }[] = [
      { label: 'Code', value: name },
      { label: 'Profile', value: (v as any).profile || '—' },
    ];

    if (isActive || isExpired) {
      rows.push({ label: 'Start Date', value: formatDate((v as any).startDate) });
      rows.push({ label: 'Start Time', value: (v as any).startTime || '—' });
      rows.push({ label: 'Expiry Date', value: formatDate((v as any).expDate) });
      rows.push({ label: 'Login Date', value: formatDate((v as any).loginDate) });
    }

    if (isActive) {
      rows.push({ label: 'Status', value: 'Active' });
      rows.push({ label: 'Time Left', value: v.timeLeftText || '—' });
      if (v.remainingSeconds != null) {
        const hrs = Math.floor(v.remainingSeconds / 3600);
        const mins = Math.floor((v.remainingSeconds % 3600) / 60);
        rows.push({ label: 'Remaining', value: `${hrs}h ${mins}m` });
      }
      rows.push({ label: 'Limit (Bytes)', value: formatBytes(v.limitBytesTotal) });
      if (v.remainingBytes != null) {
        rows.push({ label: 'Remaining Bytes', value: formatBytes(v.remainingBytes) });
      }
      rows.push({ label: 'Device', value: v.deviceName || '—' });
      rows.push({ label: 'IP Address', value: v.ipAddress || '—' });
      rows.push({ label: 'Uptime', value: v.uptime || '—' });
      rows.push({ label: 'Bytes In', value: v.bytesIn || '—' });
      rows.push({ label: 'Bytes Out', value: v.bytesOut || '—' });
      rows.push({ label: 'Session ID', value: v.sessionId || '—' });
    }

    if (isExpired) {
      rows.push({ label: 'Status', value: 'Expired' });
      rows.push({ label: 'Time Left', value: v.timeLeftText || '—' });
      rows.push({ label: 'Limit (Bytes)', value: formatBytes(v.limitBytesTotal) });
      if (v.remainingBytes != null) {
        rows.push({ label: 'Remaining Bytes', value: formatBytes(v.remainingBytes) });
      }
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={() => setInfoVoucher(null)}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            width: '90%',
            maxWidth: '440px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontFamily: 'monospace' }}>
              {statusFilter === 'active' || isActive
                ? <span style={{ color: 'var(--accent)' }}>●</span>
                : statusFilter === 'expired' || isExpired
                  ? <span style={{ color: 'var(--text-muted)' }}>●</span>
                  : <span style={{ color: 'var(--success)' }}>●</span>}{' '}
              {name}
            </h3>
            <button
              onClick={() => setInfoVoucher(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '8px 4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', width: '1%' }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '8px 4px', fontSize: '13px', color: 'var(--foreground)', textAlign: 'right', wordBreak: 'break-all' }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => { copySingleCode(name); }} style={{ ...btnSecondary, flex: 1 }}>
              <Copy size={14} /> Copy Code
            </button>
            <button
              onClick={() => { setInfoVoucher(null); }}
              style={{ ...btnPrimary, flex: 1 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Detail View ──

  const renderDetailView = () => {
    const detail: VoucherBatchDetail | undefined = batchDetail;
    const isEmpty = detail
      ? detail.unusedCount + detail.activeCount + detail.expiredCount === 0
      : true;

    const unusedVouchers = detail?.unusedVouchers || [];
    const activeVouchers = detail?.activeVouchers || [];
    const expiredVouchers = detail?.expiredVouchers || [];

    const getVisibleVouchers = () => {
      if (searchResults) return { search: searchResults };
      if (statusFilter === 'unused') return { unused: unusedVouchers };
      if (statusFilter === 'active') return { active: activeVouchers };
      if (statusFilter === 'expired') return { expired: expiredVouchers };
      return { unused: unusedVouchers, active: activeVouchers, expired: expiredVouchers };
    };

    const visible = getVisibleVouchers();
    const hasSearch = !!searchResults;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Unified Toolbar Block */}
        <div style={{
          ...cardStyle,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Row 1: Back + Title + Print */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={backToList} style={{ ...btnSecondary, padding: '8px 12px' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {printLabel || profile}
              </h2>
              {comment && (
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {comment}
                </p>
              )}
            </div>
            <button onClick={handlePrintVouchers} style={{ ...btnSecondary, padding: '8px 12px' }} disabled={printLoading}>
              <Printer size={16} />
            </button>
          </div>

          {/* Row 2: Stat counters */}
          {detail && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                  background: statusFilter === 'all' ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.05)',
                  cursor: 'pointer', transition: 'all 0.15s', minWidth: '60px',
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.1, color: statusFilter === 'all' ? '#fff' : 'var(--foreground)' }}>
                  {detail.originalCount}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px', color: statusFilter === 'all' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                  TOTAL
                </span>
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'unused' ? 'all' : 'unused')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                  background: statusFilter === 'unused' ? 'var(--success)' : 'rgba(34,197,94,0.06)',
                  cursor: 'pointer', transition: 'all 0.15s', minWidth: '60px',
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.1, color: statusFilter === 'unused' ? '#fff' : 'var(--success)' }}>
                  {detail.unusedCount}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px', color: statusFilter === 'unused' ? 'rgba(255,255,255,0.7)' : 'var(--success)' }}>
                  UNUSED
                </span>
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                  background: statusFilter === 'active' ? 'var(--accent)' : 'rgba(59,130,246,0.06)',
                  cursor: 'pointer', transition: 'all 0.15s', minWidth: '60px',
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.1, color: statusFilter === 'active' ? '#fff' : 'var(--accent)' }}>
                  {detail.activeCount}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px', color: statusFilter === 'active' ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }}>
                  ACTIVE
                </span>
              </button>
              <button
                onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                  background: statusFilter === 'expired' ? '#ef4444' : 'rgba(239,68,68,0.06)',
                  cursor: 'pointer', transition: 'all 0.15s', minWidth: '60px',
                }}
              >
                <span style={{ fontSize: '18px', fontWeight: 800, lineHeight: 1.1, color: statusFilter === 'expired' ? '#fff' : '#ef4444' }}>
                  {detail.expiredCount}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px', color: statusFilter === 'expired' ? 'rgba(255,255,255,0.7)' : '#ef4444' }}>
                  EXPIRED
                </span>
              </button>
            </div>
          )}

          {/* Pie Chart */}
          {detail && renderDonutChart(detail.unusedCount, detail.activeCount, detail.expiredCount)}

          {/* Row 3: Search */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search vouchers by code..."
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(var(--primary-rgb), 0.04)',
                  color: 'var(--foreground)', fontSize: '13px',
                }}
              />
            </div>
            {searchQuery.trim() && (
              <button onClick={handleSearch} style={btnPrimary} disabled={searchLoading}>
                {searchLoading ? '...' : 'Search'}
              </button>
            )}
            {searchResults && (
              <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} style={btnSecondary}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Voucher List */}
        {detailLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        ) : isEmpty && !hasSearch ? (
          <p style={{ color: 'var(--text-muted)' }}>No vouchers in this batch.</p>
        ) : hasSearch ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {searchResults!.length} result{searchResults!.length !== 1 ? 's' : ''}
            </p>
            {searchResults!.map((v) =>
              renderVoucherCard(
                { '.id': v.name, name: v.name, comment: v.comment || '', profile: v.profile || '', 'limit-bytes-total': String(v.limitBytesTotal || 0) },
                v.isExpired ? 'expired' : v.isInUse ? 'active' : 'unused'
              )
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {visible.unused && visible.unused.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--success)' }}>
                    Unused ({detail?.unusedCount || visible.unused.length})
                  </h3>
                  {statusFilter === 'unused' && (
                    <button
                      onClick={() => handleShowAll('unused')}
                      style={{ ...btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {visible.unused.slice(0, 50).map((v) => renderVoucherCard(v, 'unused'))}
                </div>
              </div>
            )}

            {visible.active && visible.active.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--accent)' }}>
                    Active ({detail?.activeCount || visible.active.length})
                  </h3>
                  {statusFilter === 'active' && (
                    <button
                      onClick={() => handleShowAll('active')}
                      style={{ ...btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {visible.active.slice(0, 50).map((v) => renderVoucherCard(v, 'active'))}
                </div>
              </div>
            )}

            {visible.expired && visible.expired.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                    Expired ({detail?.expiredCount || visible.expired.length})
                  </h3>
                  {statusFilter === 'expired' && (
                    <button
                      onClick={() => handleShowAll('expired')}
                      style={{ ...btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {visible.expired.slice(0, 50).map((v) => renderVoucherCard(v, 'expired'))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render: Show All Modal ──

  const renderShowAllModal = () => {
    if (!showAllModal) return null;

    const statusLabel = showAllModal === 'unused' ? 'Unused' : showAllModal === 'active' ? 'Active' : 'Expired';
    const statusColor =
      showAllModal === 'unused' ? 'var(--success)' : showAllModal === 'active' ? 'var(--accent)' : 'var(--text-muted)';

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={() => { setShowAllModal(null); setAllVouchers(null); }}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: statusColor }}>{statusLabel} Vouchers</h3>
            <button
              onClick={() => { setShowAllModal(null); setAllVouchers(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allVouchersLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : allVouchers && allVouchers.length > 0 ? (
              allVouchers.map((v) => {
                const name = v.name || (v as any)['.id'] || '';
                return (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'rgba(var(--primary-rgb), 0.04)',
                      borderRadius: '10px',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', flex: 1 }}>{name}</span>
                    <button
                      onClick={() => copySingleCode(name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: copiedCode === name ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {copiedCode === name ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        setInfoVoucher(v as any);
                        setInfoStatus(showAllModal);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)',
                      }}
                      title="View details"
                    >
                      <Info size={14} />
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteSingle(name);
                        setAllVouchers((prev) => prev?.filter((x) => (x.name || (x as any)['.id']) !== name) || null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No {showAllModal} vouchers found.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Print Modal ──

  const renderPrintModal = () => {
    if (!showPrintModal || !printCodes) return null;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}
        onClick={() => { setShowPrintModal(false); setPrintCodes(null); }}
      >
        <div
          style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Print / Export Codes</h3>
            <button
              onClick={() => { setShowPrintModal(false); setPrintCodes(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
            {printCodes.length} voucher codes ready for printing.
          </p>

          <div
            className="custom-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'rgba(var(--primary-rgb), 0.05)',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--foreground)',
              maxHeight: '300px',
              marginBottom: '12px',
            }}
          >
            {printCodes.join('\n')}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyPrintCodes} style={{ ...btnPrimary, flex: 1 }}>
              <Copy size={16} />
              Copy All
            </button>
            <button
              onClick={() => { setShowPrintModal(false); setPrintCodes(null); }}
              style={{ ...btnSecondary, flex: 1 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Redirect if missing params ──

  if (!profile) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: 'var(--text-muted)' }}>
          Invalid batch link.{' '}
          <button onClick={backToList} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            Go back to batches
          </button>
        </p>
      </div>
    );
  }

  // ── Main Render ──

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 300,
            padding: '12px 20px',
            borderRadius: '10px',
            background: toast.type === 'success' ? 'var(--success)' : '#ef4444',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Info Modal */}
      {renderInfoModal()}

      {/* Show All Modal */}
      {renderShowAllModal()}

      {/* Print Modal */}
      {renderPrintModal()}

      {/* Content */}
      {renderDetailView()}
    </div>
  );
}