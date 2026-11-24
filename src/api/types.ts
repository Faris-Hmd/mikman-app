import type { RouterConfig } from '../store';

export interface UserData {
  email: string;
  approved: boolean;
  expiresAt: string | null;
  remainingDays?: number | null;
  isExpired?: boolean;
  maxRouters: number;
  quota: string;
  hasPassword: boolean;
  name: string | null;
}

export interface RouterProfilesResponse {
  profiles: RouterConfig[];
  userData: UserData | null;
}

export interface RouterProvisionStatus {
  online: boolean;
  timezone: string;
  wifiName: string;
  routerTime?: string | null;
  uptime?: string;
  uptime_display?: string;
  cpuLoad?: number | null;
  cpuLoad_display?: string;
  totalMemory?: number | null;
  freeMemory?: number | null;
  activeUsers?: number;
  status?: 'online' | 'offline';
  temperature?: number | null;
  temperature_display?: string;
}

export interface RevenueStatsPayload {
  totalRevenue: number;
  totalVouchers: number;
  daily: Array<{
    date: string;
    revenue: number;
    count: number;
    profiles: Record<string, { count: number; revenue: number }>;
  }>;
  weekly: Array<{
    label: string;
    revenue: number;
    count: number;
    profiles: Record<string, { count: number; revenue: number }>;
  }>;
  monthly: Array<{
    label: string;
    revenue: number;
    count: number;
    profiles: Record<string, { count: number; revenue: number }>;
  }>;
  profiles: Array<{
    profile: string;
    revenue: number;
    count: number;
    percentage: number;
  }>;
  firstRecordDate?: string;
  lastRecordDate?: string;
}

export interface VoucherBatch {
  batchId?: string;
  profile: string;
  printLabel: string;
  comment: string;
  cleanComment?: string;
  createdAt?: string;
  originalCount: number;
  unusedCount: number;
  activeCount: number;
  expiredCount: number;
  price?: number;
  revenue?: number;
  formattedPrice?: string;
  validity?: string;
  validityBadge?: string;
  dataBadge?: string;
  dataLimitMB?: number;
  limitMB?: number;
  limitBytesTotal?: number;
  rateLimit?: string;
  isUnlimited?: boolean;
}

export interface VoucherSummary {
  '.id': string;
  id?: string;
  name: string;
  comment: string;
  cleanComment?: string;
  profile: string;
  'limit-bytes-total'?: string;
  limitBytesTotal?: number;
  remainingBytes?: number | null;
  remainingSeconds?: number | null;
  timeLeftText?: string;
  dataLeft?: string | null;
  dataPercent?: number | null;
  timeLeft?: string | null;
  timePercent?: number | null;
  deviceName?: string | null;
  loginDate?: string | null;
  status?: string;
  inUse?: boolean;
  isExpired?: boolean;
  disabled?: boolean;
}

export interface ActiveVoucher extends VoucherSummary {
  startDate?: string | null;
  startTime?: string | null;
  expDate?: string | null;
  loginDate: string | null;
  remainingSeconds: number | null;
  remainingBytes: number | null;
  limitBytesTotal?: number;
  timeLeftText: string;
  deviceName: string | null;
  isOnline?: boolean;
  sessionId?: string | null;
  ipAddress?: string | null;
  uptime?: string | null;
  bytesIn?: string | number | null;
  bytesOut?: string | number | null;
}

export interface ExpiredVoucher extends VoucherSummary {
  expDate?: string | null;
  loginDate: string | null;
  remainingBytes: number | null;
  limitBytesTotal?: number;
  timeLeftText: string;
}

export interface VoucherBatchDetail {
  batchId?: string;
  profile: string;
  printLabel: string;
  comment: string;
  cleanComment?: string;
  createdAt?: string;
  price?: number;
  revenue?: number;
  formattedPrice?: string;
  validity?: string;
  validityBadge?: string;
  dataBadge?: string;
  originalCount: number;
  totalCount?: number;
  total?: number;
  unusedCount: number;
  activeCount: number;
  expiredCount: number;
  limitMB?: number;
  dataLimitMB?: number;
  limitBytesTotal?: number;
  rateLimit?: string;
  isUnlimited?: boolean;
  isProfileGroup: boolean;
  unusedVouchers: VoucherSummary[];
  activeVouchers: ActiveVoucher[];
  expiredVouchers: ExpiredVoucher[];
}

export interface VoucherSearchResult extends ActiveVoucher {
  isExpired: boolean;
  isInUse: boolean;
}

export interface VoucherJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total?: number;
  error?: string | null;
}

export interface RouterInterfaceItem {
  id: string;
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  comment?: string;
  macAddress?: string;
}

export interface RouterInterfacesResponse {
  interfaces: RouterInterfaceItem[];
}

export interface UploadJobStatus {
  id: string;
  routerId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

export interface PortForwardRule {
  id: string;
  dstPort: string | number;
  toAddress: string;
  toPort: string | number;
  protocol: string;
  comment?: string;
  rawComment?: string;
  disabled?: boolean;
}

export interface PortForwardsResponse {
  portForwards: PortForwardRule[];
  routerVpnIp?: string;
}

export interface GenerateScriptParams {
  id: string;
  name: string;
  model: string;
  wifiName: string;
  user: string;
  password?: string;
  supportName?: string;
  supportPhone?: string;
  owners?: string[];
  timezone?: string;
}

export interface ServerVpnConfigResponse {
  success: boolean;
  confText?: string;
  clientIp?: string;
  serverPublicKey?: string;
  endpointHost?: string;
  endpointPort?: number;
  allowedIps?: string;
  routers?: Array<{ id: string; name: string; vpnIp: string; model?: string }>;
}

export interface UserPeerStatusItem {
  publicKey: string;
  clientIp: string;
  name: string;
  deviceType: 'pc' | 'phone' | 'device';
  endpoint?: string;
  latestHandshake: number;
  lastHandshakeHuman: string;
  isOnline: boolean;
  transferRx: number;
  transferTx: number;
}

export interface SubscriptionHistoryEntry {
  id?: string;
  action: string;
  created_at?: string;
  timestamp?: string;
  details?: {
    plan?: string;
    max_routers?: number;
    days_added?: number;
    expires_at?: string;
  };
}

export interface PlanCatalogItem {
  id: string;
  name: string;
  nameAr?: string;
  priceSdg?: number;
  priceUsd?: number;
  days: number;
  maxRouters: number;
  description?: string;
}
