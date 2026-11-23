export interface RouterConfig {
  id?: string;
  name?: string;
  ip?: string;
  user: string;
  password: string;
  wifiName?: string;
  supportName?: string;
  supportPhone?: string;
  vpnIp?: string;
  useVpn?: boolean;
  isCloudManaged?: boolean;
  wgClientPrivateKey?: string;
  wgClientIp?: string;
  wgServerPublicKey?: string;
  wgEndpointHost?: string;
  wgEndpointPort?: string;
  wgServerListenPort?: string | number;
  wgAllowedIps?: string;
  model?: 'hap-ax2' | 'l009' | 'hap-lite' | 'hap-ac2' | 'hap-ax3' | 'hap-ac3' | 'hap-ax-lite' | 'chr' | 'other';
  owner?: string;
  owners?: string[];
  timezone?: string;
  hotspotWifiName?: string;
  cardPrintLabel?: string;
  useCustomHotspotName?: boolean;
  useCustomPrintLabel?: boolean;
}

const CONFIG_KEY = '@router_config';
const SERVER_URL_KEY = '@server_url';

export const saveConfig = async (config: RouterConfig) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config', e);
  }
};

export const loadConfig = async (): Promise<RouterConfig | null> => {
  try {
    const jsonValue = localStorage.getItem(CONFIG_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Failed to load config', e);
    return null;
  }
};

export const saveServerUrl = async (url: string) => {
  try {
    localStorage.setItem(SERVER_URL_KEY, url);
  } catch (e) {
    console.error('Failed to save server URL', e);
  }
};

export const loadServerUrl = async (): Promise<string | null> => {
  try {
    return localStorage.getItem(SERVER_URL_KEY);
  } catch (e) {
    console.error('Failed to load server URL', e);
    return null;
  }
};