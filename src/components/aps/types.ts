export type DeviceCategory = 'mobile' | 'laptop' | 'ap' | 'printer' | 'tv' | 'other';

export interface DeviceItem {
  id?: string;
  bindingId?: string;
  mac: string;
  ip?: string;
  isBypassed: boolean;
  category: DeviceCategory;
  comment?: string;
  name?: string;
  uptime?: string;
  isOnline: boolean;
  rawComment?: string;
}

export interface PortForwardRule {
  id?: string;
  '.id'?: string;
  comment?: string;
  dstPort?: string;
  toAddresses?: string;
  toPorts?: string;
  protocol?: string;
  disabled?: boolean;
}
