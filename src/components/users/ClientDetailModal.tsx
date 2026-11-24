import React, { useState } from 'react';
import {
  Smartphone,
  X,
  Layers,
  Clock,
  HardDrive,
  Database,
  Globe,
  Activity,
  MessageSquare,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatBytes, formatRemainingTime } from '../../lib/helpers';
import { NetworkClient } from './types';

interface ClientDetailModalProps {
  client: NetworkClient | null;
  onClose: () => void;
  onDisconnect?: (client: NetworkClient) => Promise<void>;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  onClose,
  onDisconnect,
}) => {
  const { t, isRtl } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  if (!client) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDisconnect = async () => {
    if (!client || !onDisconnect) return;

    setIsDisconnecting(true);
    try {
      await onDisconnect(client);
      setShowDisconnectConfirm(false);
      onClose();
    } catch (err) {
      console.error('Failed to disconnect session:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div
      className="user-modal-overlay"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="user-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="user-modal-header">
          <div className="user-modal-header-left">
            <div className="user-modal-icon">
              <Smartphone size={16} />
            </div>
            <div className="user-modal-header-text">
              <h3 className="user-modal-title">
                {client.dhcpHostName || client.name || client.ip || 'Device'}
              </h3>
              <div className="user-modal-subtitle">
                {t('users.clientDetails')}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="user-modal-close-btn"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Details List */}
        <div className="user-modal-body">
          {/* Profile Row */}
          {client.profile && (
            <div className="user-detail-row">
              <div className="user-detail-label">
                <Layers size={13} className="text-purple" />
                <span>{t('users.profile')}</span>
              </div>
              <span className="user-detail-value text-blue">
                {client.profile}
              </span>
            </div>
          )}

          {/* Remaining Time Row */}
          {(() => {
            const clientTime =
              client.remainingTime ||
              client.timeLeft ||
              (client as any).timeLeftText ||
              (client.remainingSeconds != null ? formatRemainingTime(client.remainingSeconds) : null);
            if (!clientTime || clientTime === '0s') return null;
            return (
              <div className="user-detail-row">
                <div className="user-detail-label">
                  <Clock size={13} className="text-amber" />
                  <span>{t('users.remainingTime')}</span>
                </div>
                <span className="user-detail-value text-amber">
                  {clientTime}
                </span>
              </div>
            );
          })()}

          {/* Remaining Data Row */}
          {(client.dataLeft || (client as any).remainingData || (client.remainingBytes != null ? formatBytes(client.remainingBytes) : null)) &&
            (client.dataLeft || (client as any).remainingData) !== '0 MB' && (
            <div className="user-detail-row">
              <div className="user-detail-label">
                <HardDrive size={13} className="text-purple" />
                <span>{t('users.remainingData')}</span>
              </div>
              <span className="user-detail-value text-purple font-mono">
                {client.dataLeft || (client as any).remainingData || formatBytes(client.remainingBytes)}
              </span>
            </div>
          )}

          {/* IP Address Row */}
          {client.ip && (
            <div className="user-detail-row">
              <div className="user-detail-label">
                <Globe size={13} className="text-emerald" />
                <span>{t('users.ipAddress')}</span>
              </div>
              <div className="user-detail-value-wrapper">
                <span className="user-detail-value font-mono">
                  {client.ip}
                </span>
                <button
                  type="button"
                  className={`user-copy-btn ${copiedField === 'ip' ? 'copied' : ''}`}
                  onClick={() => handleCopy(client.ip, 'ip')}
                  title={copiedField === 'ip' ? t('users.copied') : t('users.copyIp')}
                >
                  {copiedField === 'ip' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          )}

          {/* MAC Address Row */}
          {client.mac && (
            <div className="user-detail-row">
              <div className="user-detail-label">
                <Activity size={13} className="text-indigo" />
                <span>{t('users.macAddress')}</span>
              </div>
              <div className="user-detail-value-wrapper">
                <span className="user-detail-value font-mono">
                  {client.mac}
                </span>
                <button
                  type="button"
                  className={`user-copy-btn ${copiedField === 'mac' ? 'copied' : ''}`}
                  onClick={() => handleCopy(client.mac, 'mac')}
                  title={copiedField === 'mac' ? t('users.copied') : t('users.copyMac')}
                >
                  {copiedField === 'mac' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          )}



          {/* DHCP Server Row */}
          {client.dhcpServer && (
            <div className="user-detail-row">
              <div className="user-detail-label">
                <Database size={13} className="text-cyan" />
                <span>{t('users.dhcpServer')}</span>
              </div>
              <span className="user-detail-value font-mono">
                {client.dhcpServer}
              </span>
            </div>
          )}

          {/* Comment Row */}
          {client.comment && (
            <div className="user-detail-row">
              <div className="user-detail-label">
                <MessageSquare size={13} className="text-amber" />
                <span>{t('users.comment')}</span>
              </div>
              <span className="user-detail-value">
                {client.comment}
              </span>
            </div>
          )}

          {/* Traffic Used */}
          {(client.formattedRxBytes || client.formattedTxBytes) && (
            <div className="user-traffic-grid">
              <div className="user-traffic-card rx">
                <ArrowDownRight size={15} />
                <div className="user-traffic-info">
                  <div className="user-traffic-label">{t('users.rxBytes')}</div>
                  <div className="user-traffic-value">
                    {client.formattedRxBytes || '0 B'}
                  </div>
                </div>
              </div>

              <div className="user-traffic-card tx">
                <ArrowUpRight size={15} />
                <div className="user-traffic-info">
                  <div className="user-traffic-label">{t('users.txBytes')}</div>
                  <div className="user-traffic-value">
                    {client.formattedTxBytes || '0 B'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Disconnect Action Footer */}
        {client.isSignedIn && (
          <div className="user-modal-actions">
            {showDisconnectConfirm ? (
              <div className="user-confirm-box">
                <div className="user-confirm-warning">
                  <AlertTriangle size={14} />
                  <span>{t('users.confirmDisconnect')}</span>
                </div>
                <div className="user-confirm-actions">
                  <button
                    type="button"
                    onClick={() => setShowDisconnectConfirm(false)}
                    disabled={isDisconnecting}
                    className="user-confirm-cancel-btn"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="user-confirm-delete-btn"
                  >
                    {isDisconnecting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>{t('users.disconnecting')}</span>
                      </>
                    ) : (
                      <span>{t('users.disconnectUser')}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="user-disconnect-btn"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <span>{t('users.disconnectUser')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
