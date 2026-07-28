import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRevenueStatsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Calendar, BarChart2, TrendingUp, Tag, Ticket, DollarSign,
  Award, Clock, ArrowUpRight, PieChart, Layers
} from 'lucide-react';

interface MonthOption {
  value: string;
  label: string;
  startDate?: string;
  endDate?: string;
}

function formatYAxisLabel(val: number): string {
  if (val === 0) return '0';
  if (val >= 1000000) {
    const num = val / 1000000;
    return (num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)) + 'M';
  }
  if (val >= 1000) {
    const num = val / 1000;
    return (num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)) + 'k';
  }
  if (val >= 100) {
    return Math.round(val).toString();
  }
  if (val % 1 === 0) {
    return val.toString();
  }
  return val.toFixed(1);
}

function formatCurrency(val: number): string {
  if (isNaN(val) || val === 0) return '$0';
  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (absVal >= 1_000_000) {
    const num = absVal / 1_000_000;
    return `${sign}$${num % 1 === 0 ? num.toFixed(0) : num.toFixed(1)}M`;
  }
  if (absVal >= 1_000) {
    const num = absVal / 1_000;
    const formatted = num >= 10 ? num.toFixed(0) : (num % 1 === 0 ? num.toFixed(0) : num.toFixed(1));
    return `${sign}$${formatted}k`;
  }
  if (absVal >= 100) {
    return `${sign}$${Math.round(absVal)}`;
  }
  if (absVal % 1 === 0) {
    return `${sign}$${absVal.toFixed(0)}`;
  }
  return `${sign}$${absVal.toFixed(2)}`;
}

export default function RevenuePage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, language } = useLanguage();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // Selected month filter state: 'last30' | 'all' | 'YYYY-MM'
  const [selectedMonthValue, setSelectedMonthValue] = useState<string>('last30');
  const [activeTooltip, setActiveTooltip] = useState<{ date: string; revenue: number; count: number; index: number } | null>(null);
  const [hoveredProfileIdx, setHoveredProfileIdx] = useState<number | null>(null);

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
  const { data: revenue, isLoading, isValidating } = useSWR(
    routerId ? `router-revenue-${routerId}-${selectedMonthValue}` : null,
    () => fetchRevenueStatsAPI(routerId!, startDate, endDate),
    { revalidateOnFocus: true, keepPreviousData: true }
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

  const { niceMax, yTicks } = useMemo(() => {
    const rawMax = Math.max(...chartDaily.map(d => d.revenue), 0);
    if (rawMax <= 0) {
      return { niceMax: 10, yTicks: [10, 7.5, 5, 2.5, 0] };
    }
    const exponent = Math.floor(Math.log10(rawMax));
    const fraction = rawMax / Math.pow(10, exponent);
    let niceFraction: number;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 1.5) niceFraction = 1.5;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 2.5) niceFraction = 2.5;
    else if (fraction <= 4) niceFraction = 4;
    else if (fraction <= 5) niceFraction = 5;
    else if (fraction <= 8) niceFraction = 8;
    else niceFraction = 10;

    const nice = niceFraction * Math.pow(10, exponent);
    const ticks: number[] = [];
    const steps = 4;
    for (let i = steps; i >= 0; i--) {
      ticks.push((nice * i) / steps);
    }
    return { niceMax: nice, yTicks: ticks };
  }, [chartDaily]);

  // Derived KPI calculations
  const totalRev = Number(revenue?.totalRevenue || 0);
  const totalVouchers = Number(revenue?.totalVouchers || 0);
  const avgVoucherPrice = totalVouchers > 0 ? (totalRev / totalVouchers).toFixed(2) : '0.00';
  const activeDaysCount = chartDaily.filter(d => d.revenue > 0).length;
  const avgDailyRev = chartDaily.length > 0 ? (totalRev / chartDaily.length) : 0;

  const periodData = revenue
    ? viewMode === 'daily'
      ? revenue.daily
      : viewMode === 'weekly'
      ? revenue.weekly
      : revenue.monthly
    : [];

  // Accent color palette for profiles
  const profileColors = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4'];

  return (
    <div className="responsive-container">
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
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.4) 100%)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(59,130,246,0.3)',
            flexShrink: 0
          }}>
            <TrendingUp size={16} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('revenue.title')}
            </h2>
          </div>
        </div>

        {/* Dynamic Month Selector Dropdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'var(--secondary)',
          border: '1px solid var(--glass-border)',
          padding: '4px 8px',
          borderRadius: '8px',
          flexShrink: 0
        }}>
          <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <select
            value={selectedMonthValue}
            onChange={(e) => setSelectedMonthValue(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--foreground)',
              fontWeight: 700,
              fontSize: '11px',
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

      {/* ─── Auto-Generated Month List Pills ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calendar size={12} style={{ color: 'var(--accent)' }} />
          {language === 'ar' ? 'اختر الفترة الزمنية:' : 'Select Timeframe:'}
        </div>
        <div style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch'
        }}>
          {monthOptions.map((opt) => {
            const isActive = selectedMonthValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelectedMonthValue(opt.value)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                  background: isActive ? 'var(--accent)' : 'var(--card-bg)',
                  color: isActive ? '#fff' : 'var(--foreground)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && !revenue ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', borderColor: 'var(--accent) transparent transparent transparent' }} />
          {language === 'ar' ? 'جاري تحميل تحليلات الإيرادات...' : 'Loading revenue analytics…'}
        </div>
      ) : !revenue ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
          {language === 'ar' ? 'لا توجد سجلات إيرادات لهذه الفترة.' : 'No revenue records found for this period.'}
        </div>
      ) : (
        <div style={{ opacity: isValidating ? 0.75 : 1, transition: 'opacity 0.2s ease', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* ─── Compact KPI Cards Grid (2 Cards side-by-side in 1 row) ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {/* KPI 1: Total Revenue */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '10px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <DollarSign size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '1px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatCurrency(totalRev)}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <ArrowUpRight size={10} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatCurrency(avgDailyRev)}/{language === 'ar' ? 'يوم' : 'day'}</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Total Vouchers */}
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '10px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Ticket size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {language === 'ar' ? 'الكروت المباعة' : 'Total Vouchers'}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '1px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {totalVouchers}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chartDaily.length > 0 ? (totalVouchers / chartDaily.length).toFixed(1) : 0} {language === 'ar' ? 'كرت/يوم' : 'vouchers/day'}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Revenue Bar Chart Section ─── */}
          <div className="responsive-card" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart2 size={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ar' ? 'مخطط الإيرادات اليومية' : 'Daily Revenue Chart'}
                </h3>
              </div>
              <span style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                background: 'var(--secondary)',
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid var(--glass-border)',
                fontWeight: 600
              }}>
                {chartDaily.length} {language === 'ar' ? 'أيام' : 'days'}
              </span>
            </div>

            {chartDaily.length > 0 ? (
              <div style={{ position: 'relative', width: '100%' }}>
                {/* Main Layout Row: Y-Axis + Chart */}
                <div style={{ display: 'flex', gap: '6px', width: '100%', minWidth: 0 }}>
                  {/* Y-Axis Tick Labels Column */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '180px',
                    paddingTop: '16px',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textAlign: language === 'ar' ? 'left' : 'right',
                    width: '28px',
                    minWidth: '28px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    userSelect: 'none',
                    boxSizing: 'border-box'
                  }}>
                    {yTicks.map((tick, i) => (
                      <span key={i} style={{ lineHeight: '1', transform: 'translateY(-50%)' }}>
                        {formatYAxisLabel(tick)}
                      </span>
                    ))}
                  </div>

                  {/* Chart Area */}
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    {/* Active Tooltip overlay inside chart area to avoid card overflow clipping */}
                    {activeTooltip && (() => {
                      const dayName = (() => {
                        if (!activeTooltip.date) return '';
                        const d = new Date(activeTooltip.date + 'T00:00:00');
                        if (isNaN(d.getTime())) return '';
                        const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                        const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        return language === 'ar' ? daysAr[d.getDay()] : daysEn[d.getDay()];
                      })();

                      const leftPercent = Math.min(Math.max((activeTooltip.index / Math.max(chartDaily.length - 1, 1)) * 100, 22), 78);

                      return (
                        <div style={{
                          position: 'absolute',
                          top: '-12px',
                          left: `${leftPercent}%`,
                          transform: 'translateX(-50%)',
                          background: 'rgba(15, 23, 42, 0.95)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          pointerEvents: 'none',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          textAlign: 'center'
                        }}>
                          {/* Row 1: Day Name & Date */}
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.02em' }}>
                            {dayName} {activeTooltip.date}
                          </div>

                          {/* Row 2: Revenue & Voucher Count */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#fff', fontWeight: 900, fontSize: '13px' }}>
                              {formatCurrency(activeTooltip.revenue)}
                            </span>
                            <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '11px' }}>
                              ({activeTooltip.count} {language === 'ar' ? 'كرت' : 'vouchers'})
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Background Horizontal Gridlines */}
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      pointerEvents: 'none',
                      zIndex: 0
                    }}>
                      {yTicks.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: '100%',
                            borderTop: i === yTicks.length - 1 ? 'none' : '1px dashed rgba(255, 255, 255, 0.08)'
                          }}
                        />
                      ))}
                    </div>

                    {/* Bars flex box container */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: chartDaily.length > 25 ? '1.5px' : '3px',
                      height: '180px',
                      width: '100%',
                      paddingTop: '16px',
                      borderBottom: '1px solid var(--glass-border)',
                      boxSizing: 'border-box',
                      position: 'relative',
                      zIndex: 1,
                      overflow: 'hidden'
                    }}>
                      {chartDaily.map((item, idx) => {
                        const heightPercent = Math.min(
                          Math.max((item.revenue / niceMax) * 100, item.revenue > 0 ? 6 : 2),
                          100
                        );
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
                                borderRadius: '5px 5px 0 0',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: isHovered ? '0 0 12px rgba(59,130,246,0.7)' : 'none'
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* X-Axis Labels */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', width: '100%', minWidth: 0 }}>
                      {chartDaily.map((item, idx) => {
                        const totalBars = chartDaily.length;
                        const showLabel = idx === 0 || idx === totalBars - 1 || idx % Math.ceil(totalBars / 6) === 0;
                        const dayNum = item.date ? parseInt(item.date.split('-')[2], 10) : idx + 1;
                        return (
                          <span key={idx} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textAlign: 'center', opacity: showLabel ? 1 : 0, fontWeight: 600 }}>
                            {dayNum}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '20px 0', textAlign: 'center' }}>
                No daily chart data for the selected period.
              </p>
            )}
          </div>

          {/* ─── Profile Revenue Breakdown Card with Interactive Pie/Donut Chart ─── */}
          {revenue.profiles && revenue.profiles.length > 0 && (() => {
            const CIRCUMFERENCE = 2 * Math.PI * 38; // ~238.761
            let accumulatedPercent = 0;

            const totalProfileRev = revenue.profiles.reduce((acc, p) => acc + Number(p.revenue || 0), 0);
            const activeProfile = hoveredProfileIdx !== null ? revenue.profiles[hoveredProfileIdx] : null;

            return (
              <div className="responsive-card" style={{
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <PieChart size={20} style={{ color: 'var(--accent)' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
                      {language === 'ar' ? 'الإيرادات حسب البروفايل' : 'Revenue Breakdown by Profile'}
                    </h3>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {revenue.profiles.length} {language === 'ar' ? 'بروفايلات' : 'profiles'}
                  </span>
                </div>

                {/* Donut / Pie Chart Visualization */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 12px',
                  marginBottom: '18px',
                  background: 'var(--secondary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px',
                  position: 'relative'
                }}>
                  <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      {/* Base ring */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="12"
                      />
                      {/* Profile Segments */}
                      {revenue.profiles.map((p, idx) => {
                        const color = profileColors[idx % profileColors.length];
                        const pct = Math.max(p.percentage || 0, 0);
                        const sliceLen = (pct / 100) * CIRCUMFERENCE;
                        const gap = revenue.profiles.length > 1 && pct > 2 ? 1.5 : 0;
                        const dashArray = `${Math.max(sliceLen - gap, 0)} ${CIRCUMFERENCE - Math.max(sliceLen - gap, 0)}`;
                        const dashOffset = -accumulatedPercent * CIRCUMFERENCE;
                        accumulatedPercent += pct / 100;
                        const isSelected = hoveredProfileIdx === idx;

                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke={color}
                            strokeWidth={isSelected ? "15" : "12"}
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            style={{
                              transform: 'rotate(-90deg)',
                              transformOrigin: '50% 50%',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer',
                              filter: isSelected ? `drop-shadow(0 0 8px ${color})` : 'none',
                              opacity: hoveredProfileIdx === null || isSelected ? 1 : 0.45
                            }}
                            onMouseEnter={() => setHoveredProfileIdx(idx)}
                            onMouseLeave={() => setHoveredProfileIdx(null)}
                            onTouchStart={() => setHoveredProfileIdx(idx)}
                          />
                        );
                      })}
                    </svg>

                    {/* Donut Center Info */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      textAlign: 'center',
                      padding: '8px'
                    }}>
                      {activeProfile ? (
                        <>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeProfile.profile}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 900, color: profileColors[hoveredProfileIdx! % profileColors.length], lineHeight: '1.2' }}>
                            {formatCurrency(Number(activeProfile.revenue))}
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--foreground)' }}>
                            {activeProfile.percentage.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {language === 'ar' ? 'إجمالي البروفايل' : 'Total Profiles'}
                          </span>
                          <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--foreground)', lineHeight: '1.2' }}>
                            {formatCurrency(totalProfileRev)}
                          </span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)' }}>
                            {revenue.profiles.reduce((acc, p) => acc + (p.count || 0), 0)} {language === 'ar' ? 'كرت' : 'vouchers'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {revenue.profiles.map((p, idx) => {
                    const color = profileColors[idx % profileColors.length];
                    const isSelected = hoveredProfileIdx === idx;
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredProfileIdx(idx)}
                        onMouseLeave={() => setHoveredProfileIdx(null)}
                        onTouchStart={() => setHoveredProfileIdx(idx)}
                        style={{
                          background: isSelected ? `${color}14` : 'var(--secondary)',
                          border: `1px solid ${isSelected ? color : 'var(--glass-border)'}`,
                          borderRadius: '12px',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              color: color,
                              background: `${color}18`,
                              padding: '3px 8px',
                              borderRadius: '8px',
                              border: `1px solid ${color}30`
                            }}>
                              #{idx + 1}
                            </span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--foreground)' }}>{p.profile}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {p.count} {language === 'ar' ? 'كروت مباعة' : 'vouchers sold'}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: '16px', color: 'var(--foreground)' }}>
                              {formatCurrency(Number(p.revenue))}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: color, marginTop: '2px' }}>
                              {p.percentage.toFixed(1)}% {language === 'ar' ? 'من الإجمالي' : 'of total'}
                            </div>
                          </div>
                        </div>

                        {/* Styled Progress Bar */}
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(Math.max(p.percentage, 2), 100)}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
                            borderRadius: '4px',
                            transition: 'width 0.4s ease-out'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ─── Period Breakdown Records Section (Daily / Weekly / Monthly) ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--foreground)' }}>
                  {language === 'ar' ? 'سجلات السحب التفصيلية' : 'Detailed Revenue Records'}
                </h3>
              </div>

              {/* Segmented Mode Selector Buttons */}
              <div style={{ display: 'flex', background: 'var(--secondary)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '3px', gap: '3px' }}>
                {(['daily', 'weekly', 'monthly'] as const).map((mode) => {
                  const isActive = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '7px',
                        background: isActive ? 'var(--accent)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? '0 2px 6px rgba(59,130,246,0.25)' : 'none'
                      }}
                    >
                      {mode === 'daily' ? (language === 'ar' ? 'يومي' : 'Daily') : mode === 'weekly' ? (language === 'ar' ? 'أسبوعي' : 'Weekly') : (language === 'ar' ? 'شهري' : 'Monthly')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical List of Record Cards (1 item per row) */}
            {periodData && periodData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {periodData.map((entry: any, idx: number) => (
                  <div
                    key={idx}
                    className="bill-card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div className="item-icon" style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary)',
                      }}>
                        <Clock size={15} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="bill-title">
                          {entry.label || entry.date}
                        </div>
                        <div className="bill-subtext" style={{ marginTop: '1px' }}>
                          {entry.count} {language === 'ar' ? 'كروت' : 'vouchers'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="bill-value">
                        {formatCurrency(Number(entry.revenue))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                {language === 'ar' ? `لا توجد سجلات ${viewMode === 'daily' ? 'يومية' : viewMode === 'weekly' ? 'أسبوعية' : 'شهرية'} لهذه الفترة.` : `No ${viewMode} records found for this period.`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}