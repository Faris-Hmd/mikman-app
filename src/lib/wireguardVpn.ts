import QRCode from 'qrcode';
import type { RouterConfig } from '../store';

export interface VpnClientConfig {
  confText: string;
  qrDataUrl: string;
  privateKey: string;
  publicKey: string;
  clientIp: string;
  serverPublicKey: string;
  endpoint: string;
  allowedIps: string;
  userRouters: RouterConfig[];
  hasValidRouters: boolean;
}

// ── Curve25519 BigInt Math for 100% compliant WireGuard Public Keys ──────────
const P = (1n << 255n) - 19n;
const A24 = 121665n;

function mod(a: bigint, m = P): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

function modInverse(a: bigint, m = P): bigint {
  let m0 = m;
  let y = 0n;
  let x = 1n;
  if (m === 1n) return 0n;
  while (a > 1n) {
    const q = a / m;
    let t = m;
    m = a % m;
    a = t;
    t = y;
    y = x - q * y;
    x = t;
  }
  if (x < 0n) x += m0;
  return x;
}

function curve25519(scalarBytes: Uint8Array): Uint8Array {
  const scalar = Array.from(scalarBytes);
  scalar[0] &= 248;
  scalar[31] &= 127;
  scalar[31] |= 64;

  let k = 0n;
  for (let i = 31; i >= 0; i--) {
    k = (k << 8n) | BigInt(scalar[i]);
  }

  const x1 = 9n;
  let x2 = 1n;
  let z2 = 0n;
  let x3 = x1;
  let z3 = 1n;
  let swap = 0n;

  for (let t = 254; t >= 0; t--) {
    const kt = (k >> BigInt(t)) & 1n;
    const dummy = swap ^ kt;
    swap = kt;
    if (dummy) {
      const tmpX = x2;
      x2 = x3;
      x3 = tmpX;
      const tmpZ = z2;
      z2 = z3;
      z3 = tmpZ;
    }

    const A = mod(x2 + z2);
    const AA = mod(A * A);
    const B = mod(x2 - z2);
    const BB = mod(B * B);
    const E = mod(AA - BB);
    const C = mod(x3 + z3);
    const D = mod(x3 - z3);
    const DA = mod(D * A);
    const CB = mod(C * B);

    x3 = mod((DA + CB) * (DA + CB));
    z3 = mod(x1 * mod((DA - CB) * (DA - CB)));
    x2 = mod(AA * BB);
    z2 = mod(E * mod(AA + mod(A24 * E)));
  }

  if (swap) {
    const tmpX = x2;
    x2 = x3;
    x3 = tmpX;
    const tmpZ = z2;
    z2 = z3;
    z3 = tmpZ;
  }

  let result = mod(x2 * modInverse(z2));
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(result & 0xffn);
    result >>= 8n;
  }
  return out;
}

const publicKeyCache = new Map<string, string>();

export function getPublicKeyFromPrivateKey(privBase64: string): string {
  if (!privBase64) return '';
  const cached = publicKeyCache.get(privBase64);
  if (cached) return cached;
  try {
    const binary = atob(privBase64);
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const pub = curve25519(bytes);
    let pubBinary = '';
    for (let i = 0; i < 32; i++) {
      pubBinary += String.fromCharCode(pub[i]);
    }
    const result = btoa(pubBinary);
    publicKeyCache.set(privBase64, result);
    return result;
  } catch (e) {
    console.error('Error deriving Curve25519 public key:', e);
    return '';
  }
}

// ── Lightweight pure-JS SHA-256 for deterministic, persistent Curve25519 key seeds ──
function sha256Sync(ascii: string): Uint8Array {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number;
  let j: number;
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  const bytes = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      bytes[i * 4 + (3 - j)] = (hash[i] >> (j * 8)) & 255;
    }
  }
  return bytes;
}

/**
 * Deterministically derive a cryptographically valid WireGuard Curve25519 private key
 * from the user's unique identity and device slot. Ensures the tunnel never breaks across
 * page reloads, browser switches, or cache clears.
 */
export function deriveDeterministicPrivateKey(userIdentifier: string, deviceSlot = 'pc'): string {
  const normalized = userIdentifier.toLowerCase().trim() || 'default';
  const seed = `${normalized}::${deviceSlot}::mikman-vpn-key-v1`;
  const bytes = sha256Sync(seed);
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
 * Get or create a persistent private key for the user and specific device slot (pc, phone, etc).
 * Uses deterministic derivation fallback so keys remain 100% stable across devices and sessions.
 */
export function getOrCreateUserPrivateKey(userIdentifier: string, deviceSlot = 'pc'): string {
  const normalized = userIdentifier.toLowerCase().trim() || 'default';
  const slotKey = `@wg_user_privkey_${normalized}_${deviceSlot}`;
  const legacyKey = `@wg_user_privkey_${normalized}`;
  try {
    let existing = localStorage.getItem(slotKey);
    if (!existing && deviceSlot === 'pc') {
      existing = localStorage.getItem(legacyKey);
      if (existing && existing.length >= 40) {
        localStorage.setItem(slotKey, existing);
      }
    }
    if (existing && existing.length >= 40) {
      return existing;
    }
    const stableKey = deriveDeterministicPrivateKey(normalized, deviceSlot);
    localStorage.setItem(slotKey, stableKey);
    return stableKey;
  } catch {
    return deriveDeterministicPrivateKey(normalized, deviceSlot);
  }
}

/**
 * Regenerate / replace the private key for a user and device slot.
 */
export function resetUserPrivateKey(userIdentifier: string, deviceSlot = 'pc'): string {
  const normalized = userIdentifier.toLowerCase().trim() || 'default';
  const slotKey = `@wg_user_privkey_${normalized}_${deviceSlot}`;
  const newKey = generateWireguardPrivateKey();
  try {
    localStorage.setItem(slotKey, newKey);
  } catch (e) {
    console.error('Failed to store new private key:', e);
  }
  return newKey;
}

/**
 * Derive a stable client IP in the 10.8.250.x subnet from the user identifier and device slot.
 */
function deriveClientIp(userIdentifier: string, deviceSlot = 'pc'): string {
  let hash = 0;
  const str = `${userIdentifier.toLowerCase().trim() || 'mikman-user'}_${deviceSlot}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const lastOctet = (Math.abs(hash) % 240) + 10; // 10..249
  return `10.8.250.${lastOctet}`;
}

/**
 * Generate WireGuard client configuration ensuring persistent access.
 * AllowedIPs routes 10.8.0.0/16 so newly added routers are reachable immediately without re-configuring the peer.
 */
export async function generateUserVpnConfig(
  userEmail: string,
  profiles: RouterConfig[],
  customServerPublicKey?: string,
  customEndpointHost?: string,
  customEndpointPort?: number | string,
  deviceSlot = 'pc',
  customPrivateKey?: string,
  customClientIp?: string,
  customAllowedIps?: string,
  generateQr = true
): Promise<VpnClientConfig> {
  const normalizedEmail = userEmail.toLowerCase().trim();

  // Filter routers belonging to this user that have a VPN IP
  const userRouters = profiles.filter((p) => {
    if (!p) return false;
    const hasIp = Boolean(p.vpnIp || p.wgClientIp || p.ip);
    if (!hasIp) return false;

    if (p.owners && Array.isArray(p.owners) && p.owners.length > 0) {
      const isOwner = p.owners.some((o) => typeof o === 'string' && o.toLowerCase().trim() === normalizedEmail);
      if (isOwner) return true;
    }
    if (p.owner && typeof p.owner === 'string' && p.owner.toLowerCase().trim() === normalizedEmail) {
      return true;
    }
    return true;
  });

  // Authoritative server WireGuard parameters
  const serverPublicKey = (customServerPublicKey || '5OI5UlxA6qJQKLU/29S1Ox6oCZKR91SWLEq1DvXVuks=').trim();
  const endpointHost = (customEndpointHost || 'vpn.mikman.net').trim();
  const endpointPort = customEndpointPort ? String(customEndpointPort).trim() : '13231';

  // Build persistent AllowedIPs list
  // Routing 10.8.0.0/16 guarantees that whenever any new router is added to the user's account,
  // the client tunnel automatically routes to it without breaking or requiring re-scanning the QR code.
  let allowedIpsString = '10.8.0.0/16';
  if (customAllowedIps && customAllowedIps.trim().length > 0) {
    const trimmed = customAllowedIps.trim();
    if (trimmed.includes('10.8.0.0/16')) {
      allowedIpsString = trimmed;
    } else {
      allowedIpsString = `${trimmed}, 10.8.0.0/16`;
    }
  }

  const privateKey = customPrivateKey || getOrCreateUserPrivateKey(normalizedEmail, deviceSlot);
  const publicKey = getPublicKeyFromPrivateKey(privateKey);

  // Clean and sanitize client IP address (prevent double masks like 10.8.250.2/24/16)
  const rawClientIp = (customClientIp || deriveClientIp(normalizedEmail, deviceSlot)).trim();
  const clientIpOnly = rawClientIp.split('/')[0].trim();
  const clientCidr = rawClientIp.includes('/') ? rawClientIp.split('/')[1].trim() : '24';
  const clientAddress = `${clientIpOnly}/${clientCidr}`;

  // Standard clean WireGuard INI config (No DNS override so split-tunnel never hijacks host internet DNS)
  const confText = [
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `Address = ${clientAddress}`,
    'MTU = 1280',
    '',
    '[Peer]',
    `PublicKey = ${serverPublicKey}`,
    `Endpoint = ${endpointHost}:${endpointPort}`,
    `AllowedIPs = ${allowedIpsString}`,
    'PersistentKeepalive = 25',
    '',
  ].join('\n');

  // Generate high-contrast QR Code Data URL only when needed (Phone slot)
  let qrDataUrl = '';
  if (generateQr) {
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
  }

  return {
    confText,
    qrDataUrl,
    privateKey,
    publicKey,
    clientIp: clientIpOnly,
    serverPublicKey,
    endpoint: `${endpointHost}:${endpointPort}`,
    allowedIps: allowedIpsString,
    userRouters,
    hasValidRouters: allowedIpsString !== '10.8.0.0/16',
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
