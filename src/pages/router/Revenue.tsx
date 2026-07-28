import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRevenueStatsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { Calendar, BarChart2, TrendingUp, Tag, Ticket } from 'lucide-react';

interface MonthOption {
  value: string;
  label: string;
  startDate?: string;
  endDate?: string;
}

export default function RevenuePage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, language } = useLanguage();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // Selected month filter state: 'last30' | 'all' | 'YYYY-MM'
  const [selectedMonthValue, setSelectedMonthValue] = useState<string>('last30');
  const [activeTooltip, setActiveTooltip] = useState<{ date: string; revenue: number; count: number; index: number } | null>(null);

  // Fetch overall all-time data to extract earliest and latest record dates (pure client-side)
  const { data: allTimeRevenue } = useSWR(
    routerId ? `router-revenue-alltime-${routerId}` : null,
    () => fetchRevenueStatsAPI(routerId!),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Derive date bounds from selected month option
  const { startDate, endDate } = useMemo(() => {
    if (selectedMonthValue === 'all') {
      return { startDate: undefined, endDate: undefined };
    }
    if (selectedMonthValue === 'last30') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    }
    // Format "YYYY-MM"
    const [yStr, mStr] = selectedMonthValue.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // last day of month
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }, [selectedMonthValue]);

  // Fetch filtered data for selected date range
  const { data: revenue, isLoading } = useSWR(
    routerId ? `router-revenue-${routerId}-${selectedMonthValue}` : null,
    () => fetchRevenueStatsAPI(routerId!, startDate, endDate),
    { revalidateOnFocus: true }
  );

  // Pure client-side month list generation based on span between earliest and latest record dates
  const monthOptions = useMemo<MonthOption[]>(() => {
    const options: MonthOption[] = [
      { value: 'last30', label: language === 'ar' ? 'آخر 30 يوم' : 'Last 30 Days' },
      { value: 'all', label: language === 'ar' ? 'جميع الأوقات' : 'All Time' }
    ];

    const targetSource = allTimeRevenue || revenue;
    const allDates: string[] = [];

    if (targetSource?.daily) {
      targetSource.daily.forEach(d => {
        if (d.date) allDates.push(d.date);
      });
    }

    if (allDates.length === 0 && targetSource?.monthly) {
      targetSource.monthly.forEach(m => {
        if (m.label) {
          const match = m.label.match(/\b(20\d\d)\b/);
          if (match) allDates.push(`${match[1]}-01-01`);
        }
      });
    }

    let firstDate: Date | null = null;
    let lastDate: Date | null = null;

    if (allDates.length > 0) {
      allDates.sort();
      firstDate = new Date(allDates[0]);
      lastDate = new Date(allDates[allDates.length - 1]);
    }

    if (!lastDate || isNaN(lastDate.getTime())) {
      lastDate = new Date();
    }
    if (!firstDate || isNaN(firstDate.getTime())) {
      firstDate = new Date();
      firstDate.setMonth(firstDate.getMonth() - 5);
    }

    const startYear = firstDate.getFullYear();
    const startMonth = firstDate.getMonth();
    const endYear = lastDate.getFullYear();
    const endMonth = lastDate.getMonth();

    const monthFormatter = new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'long',
      year: 'numeric'
    });

    let current = new Date(endYear, endMonth, 1);
    const minMonth = new Date(startYear, startMonth, 1);

    while (current >= minMonth) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const valKey = `${yyyy}-${mm}`;
      const monthName = monthFormatter.format(current);

      options.push({
        value: valKey,
        label: monthName
      });

      current.setMonth(current.getMonth() - 1);
    }

    return options;
  }, [allTimeRevenue, revenue, language]);

  // Compute daily chart bars matching exact days of selected month (28, 29, 30, or 31 bars)
  const chartDaily = useMemo(() => {
    if (!revenue) return [];

    if (selectedMonthValue === 'last30') {
      const result: Array<{ date: string; revenue: number; count: number }> = [];
      const dailyMap = new Map((revenue.daily || []).map(d => [d.date, d]));
      const end = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(end.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dayStr = `${yyyy}-${mm}-${dd}`;
        const match = dailyMap.get(dayStr);
        result.push({
          date: dayStr,
          revenue: match ? match.revenue : 0,
          count: match ? match.count : 0
        });
      }
      return result;
    }

    if (selectedMonthValue === 'all') {
      return (revenue.daily || []).slice(-30);
    }

    // Specific Month YYYY-MM
    const [yStr, mStr] = selectedMonthValue.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31 days

    const dailyMap = new Map((revenue.daily || []).map(d => [d.date, d]));
    const result: Array<{ date: string; revenue: number; count: number }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dayStr = `${year}-${mm}-${dd}`;
      const match = dailyMap.get(dayStr);
      result.push({
        date: dayStr,
        revenue: match ? match.revenue : 0,
        count: match ? match.count : 0
      });
    }

    return result;
  }, [revenue, selectedMonthValue]);

  const maxRevenue = useMemo(() => {
    if (chartDaily.length === 0) return 1;
    return Math.max(...chartDaily.map(d => d.revenue), 1);
  }, [chartDaily]);

  const periodData = revenue
    ? viewMode === 'daily'
      ? revenue.daily
      : viewMode === 'weekly'
      ? revenue.weekly
      : revenue.monthly
    : [];

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header section with Router ID and Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={22} style={{ color: 'var(--accent)' }} />
            {t('revenue.title')}
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Router: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{routerId}</span>
          </p>
        </div>

        {/* Dynamic Month Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '12px' }}>
          <Calendar size={16} style={{ color: 'var(--accent)' }} />
          <select
            value={selectedMonthValue}
            onChange={(e) => setSelectedMonthValue(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--foreground)',
              fontWeight: 600,
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading revenue analytics…
        </div>
      ) : !revenue ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No revenue records found for this period.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '2px', color: 'var(--foreground)' }}>
                  ${Number(revenue.totalRevenue).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ticket size={24} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {language === 'ar' ? 'إجمالي الكروت المباعة' : 'Total Vouchers Sold'}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '2px', color: 'var(--foreground)' }}>
                  {revenue.totalVouchers}
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Bar Chart (Capped to exact days of month: 28, 29, 30, or 31 bars) */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>
                  {language === 'ar' ? 'مخطط الإيرادات اليومية' : 'Daily Revenue Chart'}
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                {chartDaily.length} {language === 'ar' ? 'أيام' : 'days'}
              </span>
            </div>

            {chartDaily.length > 0 ? (
              <div style={{ position: 'relative', width: '100%' }}>
                {/* Active Tooltip overlay */}
                {activeTooltip && (
                  <div style={{
                    position: 'absolute',
                    top: '-32px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid var(--accent)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    {activeTooltip.date}: ${activeTooltip.revenue.toFixed(2)} ({activeTooltip.count} {language === 'ar' ? 'كرت' : 'vouchers'})
                  </div>
                )}

                {/* Bars flex box container: exact days of month fit cleanly */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '3px',
                  height: '180px',
                  width: '100%',
                  paddingTop: '20px',
                  borderBottom: '1px solid var(--glass-border)',
                  boxSizing: 'border-box'
                }}>
                  {chartDaily.map((item, idx) => {
                    const heightPercent = Math.max((item.revenue / maxRevenue) * 100, item.revenue > 0 ? 6 : 2);
                    const isHovered = activeTooltip?.index === idx;

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setActiveTooltip({ date: item.date, revenue: item.revenue, count: item.count, index: idx })}
                        onMouseLeave={() => setActiveTooltip(null)}
                        onTouchStart={() => setActiveTooltip({ date: item.date, revenue: item.revenue, count: item.count, index: idx })}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            background: item.revenue > 0
                              ? isHovered
                                ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)'
                                : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                              : 'var(--glass-border)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.2s ease',
                            boxShadow: isHovered ? '0 0 10px rgba(59,130,246,0.6)' : 'none'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Non-overlapping X-Axis Labels (spaced every ~5 bars) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {chartDaily.map((item, idx) => {
                    const totalBars = chartDaily.length;
                    const showLabel = idx === 0 || idx === totalBars - 1 || idx % Math.ceil(totalBars / 6) === 0;
                    const dayNum = item.date ? parseInt(item.date.split('-')[2], 10) : idx + 1;
                    return (
                      <span key={idx} style={{ flex: 1, textAlign: 'center', opacity: showLabel ? 1 : 0 }}>
                        {dayNum}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '20px 0', textAlign: 'center' }}>
                No daily chart data for the selected period.
              </p>
            )}
          </div>

          {/* Profile Breakdown */}
          {revenue.profiles && revenue.profiles.length > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '18px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Tag size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--foreground)' }}>
                  {language === 'ar' ? 'الإيرادات حسب البروفايل' : 'Revenue by Profile'}
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {revenue.profiles.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{p.profile}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          ({p.count} {language === 'ar' ? 'كروت' : 'vouchers'})
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>${Number(p.revenue).toFixed(2)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({p.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(Math.max(p.percentage, 2), 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period Toggle & Data List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: 'none',
                    borderRadius: '12px',
                    background: viewMode === mode ? 'var(--accent)' : 'var(--card-bg)',
                    color: viewMode === mode ? '#fff' : 'var(--foreground)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s ease',
                    boxShadow: viewMode === mode ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'
                  }}
                >
                  {mode === 'daily' ? (language === 'ar' ? 'يومي' : 'Daily') : mode === 'weekly' ? (language === 'ar' ? 'أسبوعي' : 'Weekly') : (language === 'ar' ? 'شهري' : 'Monthly')}
                </button>
              ))}
            </div>

            {periodData && periodData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                {periodData.map((entry: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '14px',
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--foreground)' }}>{entry.label || entry.date}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {entry.count} {language === 'ar' ? 'كروت' : 'vouchers'}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--foreground)' }}>
                      ${Number(entry.revenue).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                No {viewMode} records for this period.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}