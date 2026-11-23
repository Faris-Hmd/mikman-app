import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { fetchRevenueStatsAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import './Revenue.css';

import {
  Calendar, BarChart2, TrendingUp, Tag, Ticket, DollarSign,
  Clock, PieChart, Layers
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
  const { t, language, isRtl } = useLanguage();
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

  // Compute daily chart bars matching exact days of selected month
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
    const daysInMonth = new Date(year, month, 0).getDate();

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
  const avgDailyRev = chartDaily.length > 0 ? (totalRev / chartDaily.length) : 0;

  const periodData = revenue
    ? viewMode === 'daily'
      ? revenue.daily
      : viewMode === 'weekly'
      ? revenue.weekly
      : revenue.monthly
    : [];

  const profileColors = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4'];

  return (
    <div className={`responsive-container ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* ─── Page Header ─── */}
      <div className="page-header-card revenue-header-card">
        <div className="flex-row-center gap-8 min-w-0">
          <div className="page-header-icon">
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="page-header-title">
              {t('revenue.title')}
            </h2>
            <p className="page-header-subtitle">
              {t('revenue.subtitle') || 'Revenue Analytics & Sales Reports'}
            </p>
          </div>
        </div>

        {/* Compact Month Selector Dropdown */}
        <div className="revenue-month-select-wrapper">
          <Calendar size={12} className="text-accent flex-shrink-0" />
          <select
            value={selectedMonthValue}
            onChange={(e) => setSelectedMonthValue(e.target.value)}
            className="revenue-month-select"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Timeframe Quick Filter Buttons (Rule 1: Solid high-contrast) ─── */}
      <div className="revenue-quick-filters">
        {monthOptions.map((opt) => {
          const isActive = selectedMonthValue === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSelectedMonthValue(opt.value)}
              className={`revenue-filter-btn ${isActive ? 'active' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLoading && !revenue ? (
        <div className="responsive-card revenue-empty-box">
          <div className="spinner mx-auto mb-2" />
          <span className="text-xs text-muted">{language === 'ar' ? 'جاري تحميل تحليلات الإيرادات...' : 'Loading revenue analytics…'}</span>
        </div>
      ) : !revenue ? (
        <div className="responsive-card revenue-empty-box">
          <p className="m-0 text-xs text-muted">{language === 'ar' ? 'لا توجد سجلات إيرادات لهذه الفترة.' : 'No revenue records found for this period.'}</p>
        </div>
      ) : (
        <div className={`revenue-container ${isValidating ? 'opacity-80' : ''}`}>
          {/* ─── Standardized 4-KPI Grid ─── */}
          <div className="revenue-kpi-grid">
            {/* KPI 1: Total Revenue */}
            <div className="responsive-card revenue-kpi-card">
              <div className="revenue-kpi-icon blue">
                <DollarSign size={13} />
              </div>
              <div className="revenue-kpi-content">
                <div className="revenue-kpi-label">
                  {language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
                </div>
                <div className="revenue-kpi-val">
                  {formatCurrency(totalRev)}
                </div>
              </div>
            </div>

            {/* KPI 2: Total Vouchers */}
            <div className="responsive-card revenue-kpi-card">
              <div className="revenue-kpi-icon green">
                <Ticket size={13} />
              </div>
              <div className="revenue-kpi-content">
                <div className="revenue-kpi-label">
                  {language === 'ar' ? 'الكروت المباعة' : 'Total Vouchers'}
                </div>
                <div className="revenue-kpi-val">
                  {totalVouchers}
                </div>
              </div>
            </div>

            {/* KPI 3: Daily Average */}
            <div className="responsive-card revenue-kpi-card">
              <div className="revenue-kpi-icon purple">
                <BarChart2 size={13} />
              </div>
              <div className="revenue-kpi-content">
                <div className="revenue-kpi-label">
                  {language === 'ar' ? 'معدل اليوم' : 'Daily Avg'}
                </div>
                <div className="revenue-kpi-val">
                  {formatCurrency(avgDailyRev)}
                </div>
              </div>
            </div>

            {/* KPI 4: Avg Ticket Price */}
            <div className="responsive-card revenue-kpi-card">
              <div className="revenue-kpi-icon amber">
                <Tag size={13} />
              </div>
              <div className="revenue-kpi-content">
                <div className="revenue-kpi-label">
                  {language === 'ar' ? 'سعر الكرت' : 'Avg Ticket'}
                </div>
                <div className="revenue-kpi-val">
                  ${avgVoucherPrice}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Revenue Bar Chart Section ─── */}
          <div className="responsive-card revenue-chart-card">
            <div className="revenue-chart-header">
              <div className="revenue-chart-title">
                <BarChart2 size={15} className="text-accent" />
                <h3>{language === 'ar' ? 'الإيرادات اليومية' : 'Daily Revenue'}</h3>
              </div>
              <span className="revenue-chart-badge">
                {chartDaily.length} {language === 'ar' ? 'أيام' : 'days'}
              </span>
            </div>

            {chartDaily.length > 0 ? (
              <div className="revenue-chart-layout">
                {/* Y-Axis Tick Labels Column */}
                <div className={`revenue-chart-yaxis ${isRtl ? 'rtl' : 'ltr'}`}>
                  {yTicks.map((tick, i) => (
                    <span key={i} className="leading-none transform -translate-y-1/2">
                      {formatYAxisLabel(tick)}
                    </span>
                  ))}
                </div>

                {/* Chart Area */}
                <div className="revenue-chart-area">
                  {/* Active Tooltip overlay inside chart area */}
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
                      <div className="revenue-chart-tooltip" style={{ left: `${leftPercent}%` }}>
                        <div className="text-muted text-[9px] font-semibold">
                          {dayName} {activeTooltip.date}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-white font-extrabold text-xs">
                            {formatCurrency(activeTooltip.revenue)}
                          </span>
                          <span className="text-blue-400 font-bold text-[9.5px]">
                            ({activeTooltip.count} {language === 'ar' ? 'كرت' : 'vouchers'})
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Background Horizontal Gridlines */}
                  <div className="revenue-chart-gridlines">
                    {yTicks.map((_, i) => (
                      <div key={i} className="revenue-chart-gridline" />
                    ))}
                  </div>

                  {/* Bars flex box container */}
                  <div className="revenue-chart-bars">
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
                          className="revenue-chart-bar-col"
                        >
                          <div
                            className={`revenue-chart-bar-fill ${isHovered ? 'active' : item.revenue > 0 ? 'positive' : 'zero'}`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* X-Axis Labels */}
                  <div className="revenue-chart-xaxis">
                    {chartDaily.map((item, idx) => {
                      const totalBars = chartDaily.length;
                      const showLabel = idx === 0 || idx === totalBars - 1 || idx % Math.ceil(totalBars / 6) === 0;
                      const dayNum = item.date ? parseInt(item.date.split('-')[2], 10) : idx + 1;
                      return (
                        <span key={idx} className={`revenue-chart-xlabel ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
                          {dayNum}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted text-xs my-3 text-center">
                {language === 'ar' ? 'لا توجد بيانات يومية لهذه الفترة.' : 'No daily chart data for the selected period.'}
              </p>
            )}
          </div>

          {/* ─── Profile Revenue Breakdown Card ─── */}
          {revenue.profiles && revenue.profiles.length > 0 && (() => {
            const CIRCUMFERENCE = 2 * Math.PI * 30; // ~188.4
            let accumulatedPercent = 0;

            const totalProfileRev = revenue.profiles.reduce((acc, p) => acc + Number(p.revenue || 0), 0);
            const activeProfile = hoveredProfileIdx !== null ? revenue.profiles[hoveredProfileIdx] : null;

            return (
              <div className="responsive-card revenue-donut-card">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <PieChart size={15} className="text-accent" />
                    <h3 className="m-0 text-xs font-bold text-foreground">
                      {language === 'ar' ? 'الإيرادات حسب البروفايل' : 'Revenue by Profile'}
                    </h3>
                  </div>
                  <span className="text-[10px] text-muted font-semibold">
                    {revenue.profiles.length} {language === 'ar' ? 'بروفايلات' : 'profiles'}
                  </span>
                </div>

                {/* Donut Chart Visualization */}
                <div className="revenue-donut-wrapper">
                  <div className="revenue-donut-box">
                    <svg viewBox="0 0 80 80" className="revenue-donut-svg">
                      <circle
                        cx="40"
                        cy="40"
                        r="30"
                        fill="transparent"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="9"
                      />
                      {revenue.profiles.map((p, idx) => {
                        const color = profileColors[idx % profileColors.length];
                        const pct = Math.max(p.percentage || 0, 0);
                        const sliceLen = (pct / 100) * CIRCUMFERENCE;
                        const gap = revenue.profiles.length > 1 && pct > 2 ? 1 : 0;
                        const dashArray = `${Math.max(sliceLen - gap, 0)} ${CIRCUMFERENCE - Math.max(sliceLen - gap, 0)}`;
                        const dashOffset = -accumulatedPercent * CIRCUMFERENCE;
                        accumulatedPercent += pct / 100;
                        const isSelected = hoveredProfileIdx === idx;

                        return (
                          <circle
                            key={idx}
                            cx="40"
                            cy="40"
                            r="30"
                            fill="transparent"
                            stroke={color}
                            strokeWidth={isSelected ? '11' : '9'}
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            className="cursor-pointer transition-all duration-200 -rotate-90 origin-center"
                            style={{
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
                    <div className="revenue-donut-center">
                      {activeProfile ? (
                        <>
                          <span className="text-[9px] font-bold text-muted uppercase max-w-[70px] truncate">
                            {activeProfile.profile}
                          </span>
                          <span className="text-xs font-black leading-tight" style={{ color: profileColors[hoveredProfileIdx! % profileColors.length] }}>
                            {formatCurrency(Number(activeProfile.revenue))}
                          </span>
                          <span className="text-[9px] font-bold text-foreground">
                            {activeProfile.percentage.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[8.5px] font-bold text-muted">
                            {language === 'ar' ? 'الإجمالي' : 'Total'}
                          </span>
                          <span className="text-xs font-black text-foreground leading-tight">
                            {formatCurrency(totalProfileRev)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Profile List */}
                <div className="revenue-profile-list">
                  {revenue.profiles.map((p, idx) => {
                    const color = profileColors[idx % profileColors.length];
                    const isSelected = hoveredProfileIdx === idx;
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredProfileIdx(idx)}
                        onMouseLeave={() => setHoveredProfileIdx(null)}
                        onTouchStart={() => setHoveredProfileIdx(idx)}
                        className={`revenue-profile-row ${isSelected ? 'border-primary' : ''}`}
                      >
                        <div className="revenue-profile-meta">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span
                              className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
                            >
                              #{idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs text-foreground truncate">{p.profile}</div>
                              <div className="text-[10px] text-muted">
                                {p.count} {language === 'ar' ? 'كروت مباعة' : 'vouchers sold'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="font-extrabold text-xs text-foreground">
                              {formatCurrency(Number(p.revenue))}
                            </div>
                            <div className="text-[10px] font-bold" style={{ color }}>
                              {p.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="revenue-profile-bar-bg">
                          <div
                            className="revenue-profile-bar-fill"
                            style={{
                              width: `${Math.min(Math.max(p.percentage, 2), 100)}%`,
                              background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ─── Period Breakdown Records Section (Daily / Weekly / Monthly) ─── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Layers size={15} className="text-accent" />
                <h3 className="m-0 text-xs font-bold text-foreground">
                  {language === 'ar' ? 'السجلات التفصيلية' : 'Detailed Records'}
                </h3>
              </div>

              {/* Segmented Mode Selector Buttons (Rule 1: Solid styles) */}
              <div className="revenue-mode-selector">
                {(['daily', 'weekly', 'monthly'] as const).map((mode) => {
                  const isActive = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`revenue-mode-btn ${isActive ? 'active' : ''}`}
                    >
                      {mode === 'daily' ? (language === 'ar' ? 'يومي' : 'Daily') : mode === 'weekly' ? (language === 'ar' ? 'أسبوعي' : 'Weekly') : (language === 'ar' ? 'شهري' : 'Monthly')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical List of Record Cards */}
            {periodData && periodData.length > 0 ? (
              <div className="revenue-records-list">
                {periodData.map((entry: any, idx: number) => (
                  <div
                    key={idx}
                    className="responsive-card revenue-record-item"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="revenue-record-icon">
                        <Clock size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">
                          {entry.label || entry.date}
                        </div>
                        <div className="text-[10px] text-muted">
                          {entry.count} {language === 'ar' ? 'كروت' : 'vouchers'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-foreground">
                        {formatCurrency(Number(entry.revenue))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="responsive-card revenue-empty-box">
                <p className="m-0 text-xs text-muted">
                  {language === 'ar' ? `لا توجد سجلات ${viewMode === 'daily' ? 'يومية' : viewMode === 'weekly' ? 'أسبوعية' : 'شهرية'} لهذه الفترة.` : `No ${viewMode} records found for this period.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
