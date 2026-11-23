import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  fetchNetworkClientsAPI,
  removeActiveSessionAPI,
} from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import {
  NetworkClient,
  ClientGroup,
} from '../../components/users/types';
import { ClientDetailModal } from '../../components/users/ClientDetailModal';
import {
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  ArrowUpRight,
  Clock,
  Layers,
  Smartphone,
  Shield,
} from 'lucide-react';
import './Users.css';

export default function UsersPage() {
  const { routerId } = useParams<{ routerId: string }>();
  const { t, isRtl } = useLanguage();

  const [activeTab, setActiveTab] = useState<'signedIn' | 'waiting' | 'all'>('signedIn');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<NetworkClient | null>(null);

  // Fetch normalized network clients directly from server
  const { data: clientsRaw, isLoading, mutate } = useSWR<NetworkClient[]>(
    routerId ? `router-clients-${routerId}` : null,
    () => fetchNetworkClientsAPI(routerId!) as Promise<NetworkClient[]>,
    { revalidateOnFocus: true }
  );

  const clientList: NetworkClient[] = useMemo(() => {
    return Array.isArray(clientsRaw)
      ? clientsRaw
      : (clientsRaw as any)?.clients || (clientsRaw as any)?.data || [];
  }, [clientsRaw]);

  // Filtered by tab
  const signedInClients = useMemo(() => clientList.filter((c) => c.isSignedIn), [clientList]);
  const waitingClients = useMemo(() => clientList.filter((c) => !c.isSignedIn), [clientList]);

  const currentTabList = useMemo(() => {
    if (activeTab === 'signedIn') return signedInClients;
    if (activeTab === 'waiting') return waitingClients;
    return clientList;
  }, [activeTab, signedInClients, waitingClients, clientList]);

  // Filtered by search
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return currentTabList;
    const term = searchTerm.toLowerCase().trim();
    return currentTabList.filter((c) => {
      const nameMatch = (c.dhcpHostName || c.name || '').toLowerCase().includes(term);
      const ipMatch = (c.ip || '').toLowerCase().includes(term);
      const macMatch = (c.mac || '').toLowerCase().includes(term);
      const profileMatch = (c.profile || '').toLowerCase().includes(term);
      return nameMatch || ipMatch || macMatch || profileMatch;
    });
  }, [currentTabList, searchTerm]);

  // Grouped clients by profile
  const clientGroups: ClientGroup[] = useMemo(() => {
    const map = new Map<string, ClientGroup>();

    filteredClients.forEach((client) => {
      const groupKey = client.profile
        ? client.profile
        : client.isSignedIn
        ? t('users.defaultProfile') || 'Default Profile'
        : t('users.waiting') || 'Waiting';

      const isWaiting = !client.isSignedIn && !client.profile;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          title: groupKey,
          iconType: isWaiting ? 'waiting' : 'profile',
          clients: [],
        });
      }
      map.get(groupKey)!.clients.push(client);
    });

    const waitingStr = (t('users.waiting') || 'Waiting').toLowerCase();
    return Array.from(map.values()).sort((a, b) => {
      if (a.title.toLowerCase() === waitingStr) return 1;
      if (b.title.toLowerCase() === waitingStr) return -1;
      return a.title.localeCompare(b.title);
    });
  }, [filteredClients, t]);

  const handleDisconnectClient = async (client: NetworkClient) => {
    if (!routerId || !client) return;
    try {
      const targetUser = client.user || client.name || client.mac || client.ip;
      await removeActiveSessionAPI(routerId, targetUser);
      await mutate();
      setSelectedClient(null);
    } catch (e) {
      console.error('Failed to disconnect client:', e);
    }
  };

  return (
    <div className="responsive-container users-container" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ─── Page Header Card ─── */}
      <div className="page-header-card users-header">
        <div className="users-header-info">
          <h2 className="page-header-title users-header-title">
            {t('sidebar.users') || 'Connected Users'}
          </h2>
          <p className="page-header-subtitle users-header-subtitle">
            {t('users.subtitle') || 'Monitor and manage connected hotspot clients and waiting devices'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => mutate()}
          disabled={isLoading}
          className="users-refresh-btn"
          title={t('common.refresh')}
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {/* ─── Client Metric KPI Cards ─── */}
      <div className="stat-summary-grid users-stat-grid">
        <div
          className={`responsive-card user-stat-card ${activeTab === 'signedIn' ? 'active' : ''}`}
          onClick={() => setActiveTab('signedIn')}
        >
          <div className="user-stat-icon-box signed">
            <UserCheck size={14} />
          </div>
          <div className="user-stat-info">
            <span className="user-stat-label">{t('users.signedIn')}</span>
            <strong className="user-stat-value">{signedInClients.length}</strong>
          </div>
        </div>

        <div
          className={`responsive-card user-stat-card ${activeTab === 'waiting' ? 'active' : ''}`}
          onClick={() => setActiveTab('waiting')}
        >
          <div className="user-stat-icon-box waiting">
            <UserX size={14} />
          </div>
          <div className="user-stat-info">
            <span className="user-stat-label">{t('users.waiting')}</span>
            <strong className="user-stat-value">{waitingClients.length}</strong>
          </div>
        </div>

        <div
          className={`responsive-card user-stat-card ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <div className="user-stat-icon-box all">
            <Users size={14} />
          </div>
          <div className="user-stat-info">
            <span className="user-stat-label">{t('users.all')}</span>
            <strong className="user-stat-value">{clientList.length}</strong>
          </div>
        </div>
      </div>

      {/* ─── Search Bar ─── */}
      <div className="users-controls-card">
        <div className="users-search-row">
          <div className="users-search-wrapper">
            <Search size={14} className="users-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('users.searchPlaceholder') || 'Search by name, IP, MAC, or profile...'}
              className="users-search-input"
            />
          </div>
        </div>
      </div>

      {/* ─── Client Groups List ─── */}
      {isLoading ? (
        <div className="profiles-list-stack">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton user-skeleton-item"
            />
          ))}
        </div>
      ) : clientGroups.length === 0 ? (
        <div className="profiles-empty-state">
          <Shield size={24} className="profiles-empty-icon" />
          <h4 className="profiles-empty-title">{t('users.noClientsFound') || 'No users found'}</h4>
          <p className="profiles-empty-desc">{t('users.noClientsDesc') || 'No connected clients match your current filters'}</p>
        </div>
      ) : (
        <div className="users-groups-container">
          {clientGroups.map((group) => (
            <div key={group.key} className="users-group-card">
              <div className="users-group-header">
                <div className="users-group-header-left">
                  <Layers size={14} className="text-purple" />
                  <h4 className="users-group-title">{group.title}</h4>
                </div>
                <span className="users-group-count-badge">
                  {group.clients.length}
                </span>
              </div>

              <div className="users-group-list">
                {group.clients.map((client) => {
                  const devName = client.dhcpHostName || client.name || client.ip || 'Device';

                  return (
                    <div
                      key={client.id || client.mac}
                      className="user-client-row"
                      onClick={() => setSelectedClient(client)}
                    >
                      <div className="user-client-left">
                        <div className={`user-client-icon ${client.isSignedIn ? 'signed' : 'waiting'}`}>
                          <Smartphone size={13} />
                        </div>
                        <div className="user-client-info">
                          <div className="user-client-name-row">
                            <span className="user-client-name" title={devName}>
                              {devName}
                            </span>
                          </div>
                          <span className="user-client-ip">{client.ip}</span>
                        </div>
                      </div>

                      <div className="user-badges-row">
                        {client.profile && (
                          <span className="user-meta-badge profile">
                            <Layers size={9.5} />
                            <span>{client.profile}</span>
                          </span>
                        )}

                        {client.remainingTime && client.remainingTime !== '0s' && (
                          <span className="user-meta-badge time">
                            <Clock size={9.5} />
                            <span>{client.remainingTime}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Client Detail Modal ─── */}
      <ClientDetailModal
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
        onDisconnect={handleDisconnectClient}
      />
    </div>
  );
}
