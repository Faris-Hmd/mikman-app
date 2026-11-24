import { Activity, Cpu, Thermometer, Users } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface SystemHealthGridProps {
  isConnected: boolean;
  cpuDisp: string | null;
  cpuLoad?: number | null;
  memUsed: number | null;
  memTotal: number | null;
  memPct: number | null;
  tmpDisp: string | null;
  temperature?: number | null;
  upDisp: string | null;
  activeUsers?: number | string | null;
  wifiName?: string | null;
}

export default function SystemHealthGrid({
  isConnected,
  cpuDisp,
  cpuLoad,
  memUsed,
  memTotal,
  memPct,
  tmpDisp,
  temperature,
  activeUsers,
  wifiName,
}: SystemHealthGridProps) {
  const { t } = useLanguage();

  const cpuVal = isConnected && cpuLoad != null ? Math.min(100, Math.max(0, Number(cpuLoad))) : 0;
  const cpuArcLen = Math.PI * 46; // Semi-circle r=46
  const cpuFill = (cpuVal / 100) * cpuArcLen;
  const cpuTier = cpuVal >= 80 ? 'crit' : cpuVal >= 60 ? 'warn' : 'normal';

  const ramVal = isConnected && memPct != null ? Math.min(100, Math.max(0, memPct)) : 0;
  const ramRadius = 36;
  const ramCirc = 2 * Math.PI * ramRadius;
  const ramFill = (ramVal / 100) * ramCirc;
  const ramTier = ramVal >= 90 ? 'crit' : ramVal >= 75 ? 'warn' : 'normal';

  const tempNum = isConnected && temperature != null ? Number(temperature) : 0;
  const tempBarPct = Math.min(100, Math.max(0, tempNum));
  const tempTier = tempNum >= 70 ? 'crit' : tempNum >= 55 ? 'warn' : 'normal';

  return (
    <section>
      <div className="dash-section-header">
        <Activity size={13} className="text-blue" />
        <span className="dash-section-title">
          {t('dashboard.systemHealth') || 'System Health'}
        </span>
      </div>

      <div className="dash-bento-grid">
        {/* CPU Arc Gauge Card */}
        <div className="responsive-card dash-gauge-card">
          <div className="dash-gauge-card-head">
            <span className="dash-gauge-label">{t('header.cpuLoad') || 'CPU'}</span>
            <Cpu size={15} className="dash-gauge-icon" />
          </div>
          <div className="dash-arc-wrap">
            <svg className="dash-arc-svg" viewBox="0 0 120 72" aria-hidden="true">
              <path className="dash-arc-track" d="M 14 60 A 46 46 0 0 1 106 60" />
              {cpuFill > 0 && (
                <path
                  className={`dash-arc-fill ${cpuTier}`}
                  d="M 14 60 A 46 46 0 0 1 106 60"
                  strokeDasharray={`${cpuFill} ${cpuArcLen}`}
                />
              )}
            </svg>
            <div className="dash-arc-value" dir="ltr">
              {isConnected && cpuDisp ? cpuDisp : '—'}
            </div>
          </div>
        </div>

        {/* RAM Ring Gauge Card */}
        <div className="responsive-card dash-gauge-card">
          <div className="dash-gauge-card-head">
            <span className="dash-gauge-label">{t('header.ram') || 'RAM'}</span>
            <Activity size={15} className="dash-gauge-icon" />
          </div>
          <div className="dash-ring-gauge-wrap">
            <svg className="dash-ring-gauge-svg" viewBox="0 0 92 92" aria-hidden="true">
              <circle className="dash-ring-gauge-track" cx={46} cy={46} r={ramRadius} />
              {ramFill > 0 && (
                <circle
                  className={`dash-ring-gauge-fill ${ramTier}`}
                  cx={46}
                  cy={46}
                  r={ramRadius}
                  strokeDasharray={`${ramFill} ${ramCirc}`}
                />
              )}
            </svg>
            <div className="dash-ring-gauge-center" dir="ltr">
              {isConnected && memPct != null ? `${memPct}%` : '—'}
            </div>
          </div>
          <div className="dash-gauge-sub" dir="ltr">
            {isConnected && memUsed != null && memTotal != null ? `${memUsed} / ${memTotal} MB` : '—'}
          </div>
        </div>

        {/* Active Sessions Hero Card */}
        <div className="responsive-card dash-gauge-card">
          <div className="dash-gauge-card-head">
            <span className="dash-gauge-label">{t('dashboard.activeSessions') || 'Users'}</span>
            <Users size={15} className="dash-gauge-icon" />
          </div>
          <div className="dash-hero-metric">
            <span className="dash-hero-metric-num" dir="ltr">
              {isConnected && activeUsers != null ? activeUsers : '—'}
            </span>
          </div>
          <div className="dash-gauge-sub" dir="ltr">
            {isConnected && wifiName ? wifiName : '—'}
          </div>
        </div>

        {/* Temperature Scale Card */}
        <div className="responsive-card dash-gauge-card">
          <div className="dash-gauge-card-head">
            <span className="dash-gauge-label">{t('header.temp') || 'Temp'}</span>
            <Thermometer size={15} className="dash-gauge-icon" />
          </div>
          <div className="dash-hero-metric">
            <span className="dash-hero-metric-num" dir="ltr">
              {isConnected && tmpDisp ? tmpDisp : '—'}
            </span>
          </div>
          <div className="dash-temp-scale-wrap">
            <svg className="dash-temp-svg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
              <rect className="dash-temp-track" x={0} y={0} width={100} height={8} rx={4} />
              {tempBarPct > 0 && (
                <rect
                  className={`dash-temp-fill ${tempTier}`}
                  x={0}
                  y={0}
                  width={tempBarPct}
                  height={8}
                  rx={4}
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
