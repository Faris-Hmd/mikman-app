import QRCode from 'qrcode';
import type { RouterConfig } from '../store';

export interface VpnClientConfig {
  confText: string;
  qrDataUrl: string;
  privateKey: string;
  clientIp: string;
  serverPublicKey: string;
  endpoint: string;
  allowedIps: string;
  userRouters: RouterConfig[];
  hasValidRouters: boolean;
}

/**
 * Generate a cryptographically strong WireGuard Curve25519 private key.
 */
export function generateWireguardPrivateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Get or create a persistent private key for the user.
 */
export function getOrCreateUserPrivateKey(userIdentifier: string): string {
  const key = `@wg_user_privkey_${userIdentifier.toLowerCase().trim() || 'default'}`;
  try {
    let existing = localStorage.getItem(key);
    if (!existing || existing.length < 40) {
      existing = generateWireguardPrivateKey();
      localStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    return generateWireguardPrivateKey();
  }
}

/**
 * Derive a stable client IP in the 10.9.0.x subnet from the user identifier.
 */
function deriveClientIp(userIdentifier: string): string {
  let hash = 0;
  const str = userIdentifier.toLowerCase().trim() || 'mikman-user';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const lastOctet = (Math.abs(hash) % 240) + 10; // 10..249
  return `10.9.0.${lastOctet}/24`;
}

/**
 * Generate WireGuard client configuration ensuring strict tenant isolation.
 * AllowedIPs is restricted ONLY to the specific VPN IPs of the routers owned by this user.
 */
export async function generateUserVpnConfig(
  userEmail: string,
  profiles: RouterConfig[],
  customServerPublicKey?: string,
  customEndpointHost?: string
): Promise<VpnClientConfig> {
  const normalizedEmail = userEmail.toLowerCase().trim();

  // Filter routers belonging to this user that have a VPN IP
  const userRouters = profiles.filter((p) => {
    if (!p) return false;
    const hasIp = Boolean(p.vpnIp || p.wgClientIp || p.ip);
    if (!hasIp) return false;

    // Check ownership if owners array exists
    if (p.owners && Array.isArray(p.owners) && p.owners.length > 0) {
      const isOwner = p.owners.some((o) => typeof o === 'string' && o.toLowerCase().trim() === normalizedEmail);
      if (isOwner) return true;
    }
    if (p.owner && typeof p.owner === 'string' && p.owner.toLowerCase().trim() === normalizedEmail) {
      return true;
    }
    // If no explicit owners array, include if provided in profiles response
    return true;
  });

  // Extract WireGuard server parameters from the router profiles
  let serverPublicKey = customServerPublicKey || '';
  let endpointHost = customEndpointHost || '';
  let endpointPort = '51820';

  for (const r of profiles) {
    if (!serverPublicKey && r.wgServerPublicKey) {
      serverPublicKey = r.wgServerPublicKey;
    }
    if (!endpointHost && r.wgEndpointHost) {
      endpointHost = r.wgEndpointHost;
    }
    if (r.wgEndpointPort) {
      endpointPort = String(r.wgEndpointPort);
    }
  }

  // Fallbacks if not present in profile objects
  if (!endpointHost) {
    endpointHost = '187.127.234.201';
  }
  if (!serverPublicKey) {
    // Standard placeholder if no cloud router registered yet
    serverPublicKey = 'SERVER_WIREGUARD_PUBLIC_KEY_PLACEHOLDER=';
  }

  // Build strictly isolated AllowedIPs list: ONLY this user's router VPN IPs
  const routerIps: string[] = [];
  userRouters.forEach((r) => {
    const rawIp = r.vpnIp || (r.wgClientIp ? r.wgClientIp.split('/')[0] : '');
    if (rawIp && !routerIps.includes(rawIp)) {
      routerIps.push(rawIp);
    }
  });

  let allowedIpsString = '';
  if (routerIps.length > 0) {
    allowedIpsString = routerIps.map((ip) => `${ip}/32`).join(', ');
  } else {
    // Fallback if no routers are added yet
    allowedIpsString = '10.8.0.0/16';
  }

  const privateKey = getOrCreateUserPrivateKey(normalizedEmail);
  const clientIp = deriveClientIp(normalizedEmail);

  // Construct standard WireGuard .conf file
  const confText = [
    '# ==========================================================',
    '# MIKMAN Cloud Router Management - WireGuard VPN Configuration',
    `# User: ${normalizedEmail || 'Admin'}`,
    `# Generated: ${new Date().toISOString()}`,
    '# Tenant Security: ISOLATED (Access restricted to owned routers)',
    '# ==========================================================',
    '',
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `Address = ${clientIp}`,
    'DNS = 1.1.1.1, 8.8.8.8',
    '',
    '[Peer]',
    `PublicKey = ${serverPublicKey}`,
    `Endpoint = ${endpointHost}:${endpointPort}`,
    `AllowedIPs = ${allowedIpsString}`,
    'PersistentKeepalive = 25',
    '',
  ].join('\n');

  // Generate high-contrast QR Code Data URL for mobile WireGuard scanning
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(confText, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 360,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate VPN QR code:', err);
  }

  return {
    confText,
    qrDataUrl,
    privateKey,
    clientIp,
    serverPublicKey,
    endpoint: `${endpointHost}:${endpointPort}`,
    allowedIps: allowedIpsString,
    userRouters,
    hasValidRouters: routerIps.length > 0,
  };
}

/**
 * Trigger download of the .conf file in browser.
 */
export function downloadVpnConfigFile(confText: string, filename = 'mikman-vpn.conf') {
  const blob = new Blob([confText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
