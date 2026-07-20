import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { Server, Cpu, Activity, Clock, Users, TrendingUp, Ticket, Settings, ArrowRight, ShieldCheck, Wifi, WifiOff, RefreshCcw, Layers, Laptop, ClipboardList, Thermometer, ChevronRight, Lock, Globe } from 'lucide-react';
import { fetchRouterProfilesAPI, fetchRevenueStatsAPI, formatUptimeAPI, fetchRouterHistoryAPI, fetchSingleRouterStatusAPI } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useSpeedUnit } from '../../lib/speedUnit';

export default function RouterDashboardPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { language } = useLanguage();

  const { data: status, error: statusError, isLoading: isStatusLoading, mutate: mutateStatus } = useSWR(
    routerId ? `router-status-${routerId}` : null,
    () => fetchSingleRouterStatusAPI(routerId!),
    { refreshInterval: 30000, revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  const isConnected = !!(status?.online || status?.status === 'online');

  const { t, isRtl } = useLanguage();
  const [speedUnit, setSpeedUnit] = useSpeedUnit();

  const { data: profileData } = useSWR(
    routerId ? `router-profile-${routerId}` : null,
    async () => {
      const profiles = await fetchRouterProfilesAPI();
      return profiles.find((item: any) => item.id === routerId) || null;
    },
    { revalidateOnFocus: true }
  );
  const activeRouter = profileData;

  const { data: revenue } = useSWR(
    routerId ? `router-revenue-${routerId}` : null,
    () => {
      const end = new Date();
      const start = new Date(); start.setDate(start.getDate() - 30);
      return fetchRevenueStatsAPI(routerId!, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    },
    { revalidateOnFocus: true }
  );

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<number>(24);
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'ram' | 'users' | 'temp'>('users');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!routerId) return;
    let active = true;
    setIsHistoryLoading(true);
    fetchRouterHistoryAPI(routerId, timeRange, 500)
      .then(data => {
        if (active) { setHistoryData([...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())); setIsHistoryLoading(false); }
      })
      .catch(err => { console.error('Error fetching history:', err); if (active) setIsHistoryLoading(false); });
    return () => { active = false; };
  }, [routerId, timeRange]);

  const getChartParams = () => {
    if (historyData.length === 0) return { points: [], areaPath: '', linePath: '', minVal: 0, maxVal: 100, chartWidth: 450, chartHeight: 145, paddingLeft: 40, paddingTop: 15 };
    const values = historyData.map(d => selectedMetric === 'cpu' ? d.cpu_load : selectedMetric === 'ram' ? d.ram_used_mb : selectedMetric === 'users' ? d.active_users : d.temperature);
    const minVal = 0;
    let maxVal = Math.max(...values);
    if (selectedMetric === 'cpu') maxVal = 100;
    else if (selectedMetric === 'users') maxVal = Math.max(5, maxVal * 1.2);
    else if (selectedMetric === 'temp') maxVal = Math.max(40, maxVal * 1.2);
    const valRange = maxVal - minVal || 1;
    const width = 500, height = 180, paddingLeft = 40, paddingRight = 10, paddingTop = 15, paddingBottom = 20;
    const chartWidth = width - paddingLeft - paddingRight, chartHeight = height - paddingTop - paddingBottom;
    const points = historyData.map((d, index) => {
      const x = paddingLeft + (index / (historyData.length - 1 || 1)) * chartWidth;
      const y = paddingTop + chartHeight - ((values[index] - minVal) / valRange) * chartHeight;
      return { x, y, value: values[index], time: new Date(d.recorded_at), raw: d };
    });
    if (points.length === 0) return { points: [], areaPath: '', linePath: '', minVal, maxVal, chartWidth, chartHeight, paddingLeft, paddingTop };
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    return { points, areaPath, linePath, minVal, maxVal, chartWidth, chartHeight, paddingLeft, paddingTop };
  };

  const getTemperature = (): number | null => {
    if (status?.temperature !== undefined && status?.temperature !== null) return status.temperature;
    const health = (status as any)?.health;
    if (health == null) return null;
    if (Array.isArray(health)) { const entry = health.find((i: any) => i.name === 'temperature'); return entry?.value ?? null; }
    if (typeof health === 'object') { const val = health.temperature ?? null; return val !== null ? Number(val) : null; }
    return null;
  };

  const ramPercent = status?.totalMemory && status?.freeMemory ? Math.min(100, Math.round(((Number(status.totalMemory) - Number(status.freeMemory)) / Number(status.totalMemory)) * 100)) : 0;
  const ramUsedMB = status?.totalMemory && status?.freeMemory ? Math.round((Number(status.totalMemory) - Number(status.freeMemory)) / (1024 * 1024)) : 0;
  const ramTotalMB = status?.totalMemory ? Math.round(Number(status.totalMemory) / (1024 * 1024)) : 0;
  const temp = getTemperature();

  return (
    <div style={{ padding: '16px', paddingBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--foreground)', margin: 0 }}>
        {activeRouter?.name || t('sidebar.dashboard')}
      </h2>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>MikroTik Gateway</p>
      <p>Welcome to the per-router dashboard. Status: {isConnected ? 'Online' : 'Offline'}</p>
    </div>
  );
}