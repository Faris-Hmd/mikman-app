import React from 'react';
import {
  Clock,
  Cpu,
  HardDrive,
  Activity,
  Wifi,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getRouterImage } from '../../lib/helpers';
import WireguardIcon from '../ui/WireguardIcon';

interface RouterHardwareCardProps {
  routerStatus: any;
  infoForm: {
    name: string;
    model: string;
  };
  liveSsid?: string;
  onOpenVpnModal: () => void;
}

export const RouterHardwareCard: React.FC<RouterHardwareCardProps> = ({
  routerStatus,
  infoForm,
  liveSsid,
  onOpenVpnModal,
}) => {
  const { t } = useLanguage();

  const isOnline = routerStatus?.isOnline ?? false;
  const cpuVal = routerStatus?.cpu != null ? `${routerStatus.cpu}%` : '--';
  const ramVal = routerStatus?.freeMemory != null && routerStatus?.totalMemory != null
    ? `${Math.round(((routerStatus.totalMemory - routerStatus.freeMemory) / routerStatus.totalMemory) * 100)}%`
    : '--';
  const tempVal = routerStatus?.temperature != null ? `${routerStatus.temperature}°C` : '--';
  const uptimeVal = routerStatus?.uptime || '--';

  return (
    <div className="settings-card">
      <div className="settings-hw-header">
        <div className="settings-hw-info-group">
          <div className="settings-hw-avatar">
            <img
              src={getRouterImage(infoForm.model)}
              alt="Router"
              className="settings-hw-img"
            />
          </div>
          <div className="settings-hw-titles">
            <div className="settings-hw-model">
              {infoForm.name || routerStatus?.identity || 'MikroTik Router'}
            </div>
            <div className="settings-hw-sn">
              {infoForm.model?.toUpperCase()} • {routerStatus?.version || 'RouterOS'}
            </div>
          </div>
        </div>

        {/* WireGuard Status Trigger Button */}
        <button
          type="button"
          onClick={onOpenVpnModal}
          className="settings-btn-secondary aps-btn-compact"
        >
          <WireguardIcon size={14} />
          <span>WireGuard VPN</span>
          <span className={`settings-hw-dot ${isOnline ? 'online' : 'offline'}`} />
        </button>
      </div>

      {/* Hardware Telemetry Strip */}
      <div className="settings-hardware-strip">
        <div className="settings-stat-badge">
          <div className="settings-stat-icon blue">
            <Clock size={14} />
          </div>
          <div className="settings-stat-info">
            <div className="settings-stat-label">{t('header.uptime')}</div>
            <div className="settings-stat-value">{uptimeVal}</div>
          </div>
        </div>

        <div className="settings-stat-badge">
          <div className="settings-stat-icon amber">
            <Cpu size={14} />
          </div>
          <div className="settings-stat-info">
            <div className="settings-stat-label">{t('header.cpu')}</div>
            <div className="settings-stat-value">{cpuVal}</div>
          </div>
        </div>

        <div className="settings-stat-badge">
          <div className="settings-stat-icon purple">
            <HardDrive size={14} />
          </div>
          <div className="settings-stat-info">
            <div className="settings-stat-label">{t('header.ram')}</div>
            <div className="settings-stat-value">{ramVal}</div>
          </div>
        </div>

        <div className="settings-stat-badge">
          <div className="settings-stat-icon red">
            <Activity size={14} />
          </div>
          <div className="settings-stat-info">
            <div className="settings-stat-label">{t('header.temp')}</div>
            <div className="settings-stat-value">{tempVal}</div>
          </div>
        </div>

        <div className="settings-stat-badge">
          <div className="settings-stat-icon green">
            <Wifi size={14} />
          </div>
          <div className="settings-stat-info">
            <div className="settings-stat-label">{t('header.ssid')}</div>
            <div className="settings-stat-value">{liveSsid || '--'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
