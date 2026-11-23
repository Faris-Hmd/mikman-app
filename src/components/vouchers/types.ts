export interface Profile {
  id: string;
  name?: string;
  validity?: string;
  limitMB?: number;
  isUnlimited?: boolean;
  price?: number | string;
  revenue?: number | string;
  'rate-limit'?: string;
  'limit-bytes-total'?: string;
  comment?: string;
  'on-login'?: string;
}
