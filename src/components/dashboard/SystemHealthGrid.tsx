import React from 'react';
import { Activity, Cpu, Thermometer, Clock, Users, Wifi } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface SystemHealthGridProps {
  isConnected: boolean;
  cpuDisp: string | null;
  cpuLoad?: number | null;
  memUsed: number | null;
  memTotal: number | null;
  memPct: number | null;
  tmpDisp: string | null;
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
  upDisp,
  activeUsers,
  wifiName,
}: SystemHealthGridProps) {
  const { t } = useLanguage();

  return (
    <div>
      <div className="dash-section-header">
        <Activity size={13} className="text-blue" />
        <span className="dash-section-title">
          {t('dashboard.systemHealth') || 'System Health'}
        </span>
      </div>
      <div className="stat-summary-grid">
        <div className="responsive-card dash-stat-row">
          <div className="dash-stat-icon-wrap text-blue">
            <Cpu size={13} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-label">{t('header.cpuLoad') || 'CPU'}</span>
            <strong className="dash-stat-value">
              <span className={cpuLoad != null && cpuLoad >= 80 ? 'text-danger' : ''}>
                {isConnected && cpuDisp ? cpuDisp : '—'}
              </span>
            </strong>
          </div>
        </div>

        <div className="responsive-card dash-stat-row">
          <div className="dash-stat-icon-wrap text-blue">
            <Activity size={13} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-label">{t('header.ram') || 'RAM'}</span>
            {isConnected && memUsed != null && memTotal != null ? (
              <div>
                <strong className="dash-stat-value">
                  {memUsed} / {memTotal} MB
                </strong>
                <div className="dash-ram-bar-bg">
                  <div
                    className={`dash-ram-bar-fill ${(memPct || 0) >= 90 ? 'crit' : (memPct || 0) >= 75 ? 'warn' : 'normal'}`}
                    style={{ width: `${Math.min(100, memPct || 0)}%` }}
                  />
                </div>
              </div>
            ) : (
              <strong className="dash-stat-value">—</strong>
            )}
          </div>
        </div>

        <div className="responsive-card dash-stat-row">
          <div className="dash-stat-icon-wrap text-amber">
            <Thermometer size={13} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-label">{t('header.temp') || 'Temp'}</span>
            <strong className="dash-stat-value">{isConnected && tmpDisp ? tmpDisp : '—'}</strong>
          </div>
        </div>

        <div className="responsive-card dash-stat-row">
          <div className="dash-stat-icon-wrap text-purple">
            <Clock size={13} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-label">{t('header.uptime') || 'Uptime'}</span>
            <strong className="dash-stat-value">{isConnected && upDisp ? upDisp : '—'}</strong>
          </div>
        </div>

        <div className="responsive-card dash-stat-row">
          <div className="dash-stat-icon-wrap text-blue">
            <Users size={13} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-label">{t('dashboard.activeSessions') || 'Users'}</span>
            <strong className="dash-stat-value">
              {isConnected && activeUsers != null ? activeUsers : '—'}
            </strong>
          </div>
        </div>

        <div className="responsive-card dash-stat-row" title={wifiName || undefined}>
          <div className="dash-stat-icon-wrap text-cyan">
            <Wifi size={13} />
          </div>
          <div className="dash-stat-info">
            <span className="dash-stat-label">{t('header.ssid') || 'SSID'}</span>
            <strong className="dash-stat-value">
              {isConnected && wifiName ? wifiName : '—'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
