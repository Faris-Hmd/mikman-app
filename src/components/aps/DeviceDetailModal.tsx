import React, { useState } from 'react';
import {
  X,
  Globe,
  Radio,
  Copy,
  Check,
  Lock,
  ArrowUpRight,
  Loader2,
  HardDrive,
  Activity,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useVpnModal } from '../../context/VpnModalContext';
import WireguardIcon from '../ui/WireguardIcon';
import { DeviceItem, PortForwardRule } from './types';

interface DeviceDetailModalProps {
  device: DeviceItem | null;
  onClose: () => void;
  portForwardMap: Map<string, PortForwardRule>;
  onToggleBypass: (device: DeviceItem) => Promise<void>;
  onTogglePortForward: (device: DeviceItem, rule?: PortForwardRule) => Promise<void>;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  device,
  onClose,
  portForwardMap,
  onToggleBypass,
  onTogglePortForward,
}) => {
  const { t, isRtl } = useLanguage();
  const { openVpnModal } = useVpnModal();

  const [copiedField, setCopiedField] = useState<'ip' | 'mac' | null>(null);
  const [isBypassSubmitting, setIsBypassSubmitting] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);
  const [isPfSubmitting, setIsPfSubmitting] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);

  if (!device) return null;

  const handleCopy = (val: string, field: 'ip' | 'mac') => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleBypassClick = async () => {
    if (isBypassSubmitting) return;
    setIsBypassSubmitting(true);
    setBypassError(null);

    try {
      await onToggleBypass(device);
      onClose();
    } catch (err: any) {
      setBypassError(err?.message || 'Failed to update bypass');
    } finally {
      setIsBypassSubmitting(false);
    }
  };

  const handleTogglePortForwardClick = async (rule?: PortForwardRule) => {
    if (!device.ip || isPfSubmitting) return;
    setIsPfSubmitting(true);
    setPfError(null);

    try {
      await onTogglePortForward(device, rule);
    } catch (err: any) {
      setPfError(err?.message || 'Failed to update port forwarding');
    } finally {
      setIsPfSubmitting(false);
    }
  };

  const existingPf = device.ip ? portForwardMap.get(device.ip) : undefined;

  return (
    <div
      className="aps-modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="aps-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="aps-modal-header">
          <div className="aps-modal-header-left">
            <div className="aps-modal-icon">
              <Radio size={16} />
            </div>
            <div className="aps-modal-header-text">
              <h3 className="aps-modal-title">
                {device.name || device.comment || device.ip || 'Device'}
              </h3>
              <div className="aps-modal-subtitle">
                {device.isBypassed ? t('aps.bypassed') : t('aps.regular')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="aps-modal-close-btn"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body Details */}
        <div className="aps-modal-body">
          {/* IP Address */}
          {device.ip && (
            <div className="aps-detail-row">
              <div className="aps-detail-label">
                <Globe size={13} className="text-emerald" />
                <span>{t('aps.ipAddress')}</span>
              </div>
              <div className="aps-detail-value-wrapper">
                <span className="aps-detail-value font-mono">
                  {device.ip}
                </span>
                <button
                  type="button"
                  className={`aps-copy-btn ${copiedField === 'ip' ? 'copied' : ''}`}
                  onClick={() => handleCopy(device.ip!, 'ip')}
                  title={copiedField === 'ip' ? t('users.copied') : t('users.copyIp')}
                >
                  {copiedField === 'ip' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          )}

          {/* MAC Address */}
          {device.mac && (
            <div className="aps-detail-row">
              <div className="aps-detail-label">
                <Activity size={13} className="text-indigo" />
                <span>{t('aps.macAddress')}</span>
              </div>
              <div className="aps-detail-value-wrapper">
                <span className="aps-detail-value font-mono">
                  {device.mac}
                </span>
                <button
                  type="button"
                  className={`aps-copy-btn ${copiedField === 'mac' ? 'copied' : ''}`}
                  onClick={() => handleCopy(device.mac, 'mac')}
                  title={copiedField === 'mac' ? t('users.copied') : t('users.copyMac')}
                >
                  {copiedField === 'mac' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          )}

          {/* Device Type / Category */}
          <div className="aps-detail-row">
            <div className="aps-detail-label">
              <Layers size={13} className="text-purple" />
              <span>{t('aps.bindingType')}</span>
            </div>
            <span className="aps-detail-value text-capitalize">
              {device.category}
            </span>
          </div>

          {/* Bypass Status Toggle */}
          <div className="aps-detail-row">
            <div className="aps-detail-label">
              <Lock size={13} className={device.isBypassed ? 'text-emerald' : 'text-amber'} />
              <span>{t('aps.bypassed')}</span>
            </div>
            <button
              type="button"
              className={`${device.isBypassed ? 'aps-btn-danger' : 'aps-btn-primary'} aps-btn-compact`}
              onClick={handleToggleBypassClick}
              disabled={isBypassSubmitting}
            >
              {isBypassSubmitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : device.isBypassed ? (
                <span>{t('aps.removeBypass')}</span>
              ) : (
                <span>{t('aps.enableBypass')}</span>
              )}
            </button>
          </div>
          {bypassError && (
            <div className="aps-error-msg">
              {bypassError}
            </div>
          )}

          {/* Web Access / Port Forwarding Section */}
          {device.ip && (
            <div className="aps-pf-section">
              <div className="aps-pf-header">
                <h4 className="aps-pf-title">
                  <HardDrive size={13} />
                  <span>{t('aps.webAccess')}</span>
                </h4>
                {existingPf?.dstPort && (
                  <span className="aps-pf-port-badge">
                    Port: {existingPf.dstPort}
                  </span>
                )}
              </div>

              <div className="aps-pf-actions">
                {existingPf ? (
                  <>
                    <button
                      type="button"
                      className="aps-btn-primary flex-1"
                      onClick={() => {
                        const port = existingPf.dstPort || '80';
                        const url = `http://${window.location.hostname}:${port}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <ArrowUpRight size={13} />
                      <span>{t('aps.openDashboard')}</span>
                    </button>
                    <button
                      type="button"
                      className="aps-btn-danger aps-btn-icon-pad"
                      onClick={() => handleTogglePortForwardClick(existingPf)}
                      disabled={isPfSubmitting}
                    >
                      {isPfSubmitting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="aps-btn-primary flex-1"
                    onClick={() => handleTogglePortForwardClick()}
                    disabled={isPfSubmitting}
                  >
                    {isPfSubmitting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <span>{t('aps.enableWebAccess')}</span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  className="aps-btn-secondary aps-btn-vpn-pad"
                  onClick={() => openVpnModal()}
                  title="WireGuard VPN"
                >
                  <WireguardIcon size={14} />
                </button>
              </div>
              {pfError && (
                <div className="aps-error-msg">
                  {pfError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
