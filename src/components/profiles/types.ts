export interface Profile {
  '.id': string;
  id?: string;
  name: string;
  validity?: string;
  validityBadge?: string;
  limitMB?: number;
  dataBadge?: string;
  isUnlimited?: boolean;
  printLabel?: string;
  revenue?: number | string;
  price?: number | string;
  formattedPrice?: string;
  rateLimit?: string;
  vouchersCount?: number;
}

export interface ProfileWarningData {
  profileName: string;
  userCount: number;
  message?: string;
  profileObj?: Profile;
}
