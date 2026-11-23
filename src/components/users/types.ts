export interface NetworkClient {
  id: string;
  name: string;
  user?: string;
  voucherCode?: string;
  mac: string;
  ip: string;
  isOnline: boolean;
  isSignedIn: boolean;
  uptime?: string;
  timeLeft?: string;
  remainingTime?: string;
  rxBytes?: number;
  txBytes?: number;
  formattedRxBytes?: string;
  formattedTxBytes?: string;
  profile?: string;
  isWireless?: boolean;
  dhcpHostName?: string;
  dhcpServer?: string;
  agentCircuitId?: string;
  comment?: string;
  interface?: string;
  lastSeen?: string;
}

export interface ClientGroup {
  key: string;
  title: string;
  iconType: 'profile' | 'waiting';
  clients: NetworkClient[];
}
