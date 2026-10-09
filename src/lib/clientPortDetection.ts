export interface NetworkClient {
  id?: string;
  name?: string;
  user?: string;
  mac?: string;
  ip?: string;
  uptime?: string;
  sessionTimeLeft?: string;
  timeLeft?: string;
  remainingTime?: string;
  session_time_left?: string;
  limitUptime?: string;
  signal?: number;
  profile?: string;
  rxBytes?: number;
  txBytes?: number;
  bytesIn?: number;
  bytesOut?: number;
  bytesTotal?: number;
  limitBytesTotal?: number;
  limitBytesIn?: number;
  limitBytesOut?: number;
  bytesLeft?: number;
  comment?: string;
  hostName?: string;
  port?: string;
  bridgePort?: string;
  isWireless?: boolean;
  signalStrength?: string | number;
  apName?: string;
  server?: string;
  dhcpServer?: string;
  dhcpHostName?: string;
  agentCircuitId?: string;
  agentRemoteId?: string;
  leaseInterface?: string;
  detectionSource?: string;
}

export interface ClientPortResolution {
  port: string;
  apName: string;
  detectionSource:
    | 'override'
    | 'binding'
    | 'wireless'
    | 'bridge-port'
    | 'option82'
    | 'dhcp-server'
    | 'hostname-match'
    | 'interface-match'
    | 'subnet-match'
    | 'ap-match'
    | 'unassigned';
  dhcpServer?: string;
  dhcpHostName?: string;
  agentCircuitId?: string;
}

/**
 * Format bytes into readable metric units
 */
export const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
};

/**
 * Signal strength color and style helper
 */
export const getSignalColor = (signal?: number) => {
  if (signal === undefined || signal === null) {
    return { text: '#9ca3af', bg: 'rgba(156, 163, 175, 0.12)', border: 'rgba(156, 163, 175, 0.25)' };
  }
  if (signal >= 70) {
    return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
  }
  if (signal >= 40) {
    return { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' };
  }
  return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' };
};

/**
 * Extract human-readable device hostname from DHCP lease or client comment
 */
export const getLeaseDeviceName = (client: NetworkClient | any, defaultLabel = 'Device'): string => {
  if (!client) return defaultLabel;

  const rawDevName = (
    client.hostName ||
    client['host-name'] ||
    client.dhcpName ||
    client['dhcp-name'] ||
    client.dhcpHostName ||
    client['dhcp-host-name'] ||
    client.name ||
    client.comment ||
    ''
  ).trim();

  if (rawDevName) {
    const lowerDev = rawDevName.toLowerCase();
    const lowerMac = (client.mac || '').toLowerCase();
    const lowerIp = (client.ip || '').toLowerCase();
    const lowerUser = (client.user || client.voucherCode || '').toLowerCase();

    if (
      lowerDev !== lowerMac &&
      lowerDev !== lowerIp &&
      lowerDev !== lowerUser &&
      lowerDev !== 'active client' &&
      lowerDev !== 'offline client' &&
      lowerDev !== 'unnamed client'
    ) {
      return rawDevName;
    }
  }

  return client.ip || client.comment || defaultLabel;
};

/**
 * Helper to extract remaining time (NOT uptime)
 */
export const getRemainingTime = (client: NetworkClient | any): string | null => {
  if (!client) return null;
  const t =
    client.sessionTimeLeft ||
    client.timeLeft ||
    client.remainingTime ||
    client.session_time_left ||
    client['session-time-left'] ||
    client['time-left'] ||
    client['limit-uptime'];

  if (!t || t === '0s' || t === 'none' || String(t).toLowerCase() === 'unlimited') return null;
  return String(t);
};

/**
 * Parse data quota (e.g. "12 ساعة 2 جيجا", "2 جيجا", "2GB", "500MB") from profile name or comment text
 */
export const parseQuotaFromText = (text?: string): number | null => {
  if (!text) return null;
  const str = text.trim();

  // Match Arabic gigabytes: "2 جيجا", "2 قيقا", "2 غيغا", "1.5 جيجابايت", "2GB", "2G"
  const arGbMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:جيجا|قيقا|غيغا|جيجابايت|قيقابايت|غيغابايت|GB|G\b|gb|Giga|gigabyte|gigabytes)/i);
  if (arGbMatch) {
    const gb = parseFloat(arGbMatch[1]);
    if (!isNaN(gb) && gb > 0) return Math.round(gb * 1024 * 1024 * 1024);
  }

  // Match Arabic megabytes: "500 ميجا", "500 ميقا", "500 ميغا", "500 ميجابايت", "500MB", "500M"
  const arMbMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ميجا|ميقا|ميغا|ميجابايت|ميقابايت|ميغابايت|MB|M\b|mb|Mega|megabyte|megabytes)/i);
  if (arMbMatch) {
    const mb = parseFloat(arMbMatch[1]);
    if (!isNaN(mb) && mb > 0) return Math.round(mb * 1024 * 1024);
  }

  // Match English 2GB, 500MB, 1.5GB, 1024KB, 1TB
  const enMatch = str.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB|G|M|K)\b/i);
  if (enMatch) {
    const val = parseFloat(enMatch[1]);
    const unit = enMatch[2].toUpperCase();
    if (!isNaN(val) && val > 0) {
      if (unit === 'TB') return Math.round(val * 1024 * 1024 * 1024 * 1024);
      if (unit === 'GB' || unit === 'G') return Math.round(val * 1024 * 1024 * 1024);
      if (unit === 'MB' || unit === 'M') return Math.round(val * 1024 * 1024);
      if (unit === 'KB' || unit === 'K') return Math.round(val * 1024);
    }
  }

  return null;
};

/**
 * Helper to extract remaining data bytes
 */
export const getRemainingBytes = (client: NetworkClient | any): number | null => {
  if (!client) return null;
  const used =
    Number(client.rxBytes || client.bytesIn || client['bytes-in'] || client['bytes_in'] || 0) +
    Number(client.txBytes || client.bytesOut || client['bytes-out'] || client['bytes_out'] || 0);

  let limitTotal: number | null = null;

  const rawLimit =
    client.limitBytesTotal ||
    client['limit-bytes-total'] ||
    client['limit_bytes_total'] ||
    client['total-limit'] ||
    client['download-limit'] ||
    client['bytes-total-limit'];

  if (rawLimit && Number(rawLimit) > 0) {
    limitTotal = Number(rawLimit);
  } else {
    const inLimit = Number(client.limitBytesIn || client['limit-bytes-in'] || 0);
    const outLimit = Number(client.limitBytesOut || client['limit-bytes-out'] || 0);
    if (inLimit > 0 || outLimit > 0) {
      limitTotal = inLimit + outLimit;
    }
  }

  // If limitTotal is not in bytes fields, parse from profile name, comment, or name
  if (!limitTotal || limitTotal <= 0) {
    const parsedFromProfile =
      parseQuotaFromText(client.profile) ||
      parseQuotaFromText(client.profileName) ||
      parseQuotaFromText(client.voucherProfile) ||
      parseQuotaFromText(client.comment) ||
      parseQuotaFromText(client.name);
    if (parsedFromProfile && parsedFromProfile > 0) {
      limitTotal = parsedFromProfile;
    }
  }

  if (limitTotal && limitTotal > 0) {
    const left = limitTotal - used;
    return left >= 0 ? left : 0;
  }

  if (client.bytesLeft !== undefined && client.bytesLeft !== null && Number(client.bytesLeft) > 0) {
    return Number(client.bytesLeft);
  }
  const rawBytesLeft =
    client['bytes-left'] ||
    client['bytes_left'] ||
    client['bytesLeft'] ||
    client['remain-bytes'] ||
    client['remaining-bytes'];
  if (rawBytesLeft !== undefined && rawBytesLeft !== null && Number(rawBytesLeft) > 0) {
    return Number(rawBytesLeft);
  }

  return null;
};

/**
 * Check if a client is an active authenticated hotspot voucher user
 */
export const checkIsSignedUser = (client: NetworkClient | any): boolean => {
  if (!client) return false;
  const hotspotUser = (client.user || client.voucherCode || '').trim();
  if (!hotspotUser) return false;

  const cleanUser = hotspotUser.toLowerCase().replace(/[:-]/g, '');
  const cleanMac = client.mac ? client.mac.toLowerCase().replace(/[:-]/g, '') : '';
  const cleanIp = client.ip ? client.ip.trim() : '';

  if (cleanUser === cleanMac || hotspotUser === cleanIp) return false;

  const isBypassed =
    client.bypassed === true ||
    client.bypassed === 'true' ||
    client.type === 'bypassed';
  if (isBypassed) return false;

  const commentStr = (client.comment || '').toLowerCase();
  const nameStr = (client.name || '').toLowerCase();
  const isApDevice =
    client.isAp === true ||
    client.isAp === 'true' ||
    /\b(ap|access point|bypass|binding)\b/i.test(commentStr) ||
    /\b(ap|access point|routerboard|tp-link|ubiquiti|mikrotik|tenda|netgear|cisco)\b/i.test(nameStr);
  if (isApDevice) return false;

  if (client.authorized === false) return false;

  return true;
};

/**
 * Resolve the custom AP name assigned to a port
 */
export const getClientApName = (
  c: NetworkClient | any,
  portName: string,
  portMap: Record<string, string> = {}
): string => {
  const explicitAp = c?.apName || c?.ap_name || c?.['ap-name'];
  if (explicitAp && typeof explicitAp === 'string' && explicitAp.trim()) {
    return explicitAp.trim();
  }

  if (portName && portMap) {
    if (portName !== 'bridge' && portMap[portName] && portMap[portName].trim()) {
      return portMap[portName].trim();
    }
    const lowerP = portName.toLowerCase().trim();
    if (lowerP !== 'bridge' && portMap[lowerP] && portMap[lowerP].trim()) {
      return portMap[lowerP].trim();
    }

    for (const [key, val] of Object.entries(portMap)) {
      if (key !== 'bridge' && key !== 'all' && val && val.trim()) {
        const cleanKey = key.toLowerCase().trim();
        if (lowerP === cleanKey || lowerP.startsWith(cleanKey) || cleanKey.startsWith(lowerP)) {
          return val.trim();
        }
      }
    }
  }

  if (portMap) {
    const searchTarget = `${c?.comment || ''} ${c?.name || ''} ${c?.hostName || ''} ${c?.['host-name'] || ''} ${c?.dhcpName || ''} ${c?.user || ''}`.toLowerCase();
    for (const [key, val] of Object.entries(portMap)) {
      if (key !== 'bridge' && key !== 'all' && val && val.trim()) {
        const cleanVal = val.toLowerCase().trim();
        const cleanKey = key.toLowerCase().trim();
        if ((cleanVal && searchTarget.includes(cleanVal)) || (cleanKey && searchTarget.includes(cleanKey))) {
          return val.trim();
        }
      }
    }
  }

  return '';
};

/**
 * Comprehensive DHCP Lease Table and Active Hotspot User Correlation Engine.
 * Cross-references DHCP server instances, DHCP Option 82 (Agent Circuit ID/Remote ID),
 * DHCP lease hostnames, bridge host tables, IP bindings, Wi-Fi interfaces, and manual overrides.
 */
export const resolveClientPortAndAp = (
  c: NetworkClient | any,
  portMap: Record<string, string> = {},
  clientOverrides: Record<string, string> = {},
  bindingsMap?: Map<string, string>
): ClientPortResolution => {
  if (!c) {
    return { port: '', apName: '', detectionSource: 'unassigned' };
  }

  const cleanMac = (c.mac || c['mac-address'] || c.macAddress || '').toLowerCase().replace(/[^a-f0-9]/g, '');
  const cleanIp = (c.ip || c.address || c.ipAddress || '').trim();
  const cleanUser = (c.user || c.voucherCode || '').trim();

  // Extract DHCP metadata from client record
  const dhcpServerRaw = (
    c.dhcpServer ||
    c['dhcp-server'] ||
    c.dhcp_server ||
    c.server ||
    c['active-server'] ||
    c.activeServer ||
    c.active_server ||
    c.dhcp_name ||
    c.dhcpName ||
    ''
  ).trim();

  const dhcpHostNameRaw = (
    c.hostName ||
    c['host-name'] ||
    c.dhcpName ||
    c['dhcp-name'] ||
    c.dhcpHostName ||
    c['dhcp-host-name'] ||
    c.name ||
    ''
  ).trim();

  const agentCircuitIdRaw = (
    c.agentCircuitId ||
    c['agent-circuit-id'] ||
    c.agent_circuit_id ||
    c.circuitId ||
    c['circuit-id'] ||
    ''
  ).trim();

  // 1. Manual user override (persisted device-to-port mapping)
  if (clientOverrides) {
    const overridePort =
      (cleanMac && clientOverrides[cleanMac]) ||
      (cleanIp && clientOverrides[cleanIp]) ||
      (cleanUser && clientOverrides[cleanUser]);

    if (overridePort) {
      const ap = getClientApName(c, overridePort, portMap);
      return {
        port: overridePort,
        apName: ap,
        detectionSource: 'override',
        dhcpServer: dhcpServerRaw,
        dhcpHostName: dhcpHostNameRaw,
        agentCircuitId: agentCircuitIdRaw,
      };
    }
  }

  // 2. IP Bindings (matching MAC or IP to AP / port binding)
  if (bindingsMap) {
    const bindingPort =
      (cleanMac && bindingsMap.get(cleanMac)) ||
      (cleanIp && bindingsMap.get(cleanIp));

    if (bindingPort) {
      const ap = getClientApName(c, bindingPort, portMap);
      return {
        port: bindingPort,
        apName: ap,
        detectionSource: 'binding',
        dhcpServer: dhcpServerRaw,
        dhcpHostName: dhcpHostNameRaw,
        agentCircuitId: agentCircuitIdRaw,
      };
    }
  }

  // 3. Wi-Fi signal strength (if client reports Wi-Fi signal, it's connected on local Wi-Fi wlan1)
  if (c.signal != null || c.signalStrength != null || c['signal-strength'] != null || c.isWireless) {
    const rawIface = String(c.interface || c['interface'] || '').trim();
    const port = rawIface && (rawIface.startsWith('wlan') || rawIface.startsWith('wifi')) ? rawIface : 'wlan1';
    const ap = getClientApName(c, port, portMap);
    return {
      port,
      apName: ap,
      detectionSource: 'wireless',
      dhcpServer: dhcpServerRaw,
      dhcpHostName: dhcpHostNameRaw,
      agentCircuitId: agentCircuitIdRaw,
    };
  }

  // 4. Physical Ingress / Bridge Host Port from RouterOS
  const physPort =
    c.bridgePort ||
    c.bridge_port ||
    c['bridge-port'] ||
    c['on-interface'] ||
    c.onInterface ||
    c.on_interface ||
    c.physicalInterface ||
    c.physical_interface ||
    c['physical-interface'] ||
    c.actualInterface ||
    c.actual_interface ||
    c['actual-interface'] ||
    c.ingressInterface ||
    c.ingress_interface ||
    c['ingress-interface'] ||
    c.subInterface ||
    c.sub_interface ||
    c['sub-interface'] ||
    c.switchPort ||
    c.switch_port ||
    c['switch-port'] ||
    '';

  const cleanPhys = String(physPort).trim();
  if (
    cleanPhys &&
    cleanPhys !== 'bridge' &&
    cleanPhys !== 'all' &&
    cleanPhys !== 'unknown' &&
    cleanPhys !== 'none'
  ) {
    const ap = getClientApName(c, cleanPhys, portMap);
    return {
      port: cleanPhys,
      apName: ap,
      detectionSource: 'bridge-port',
      dhcpServer: dhcpServerRaw,
      dhcpHostName: dhcpHostNameRaw,
      agentCircuitId: agentCircuitIdRaw,
    };
  }

  // 5. DHCP Option 82 (Agent Circuit ID / Remote ID injected by Access Points & Managed Switches)
  if (agentCircuitIdRaw) {
    const circuitPortMatch = agentCircuitIdRaw.match(/\b(ether\d+|wlan\d+|wifi\d+|sfp\d+|vlan\d+)\b/i);
    if (circuitPortMatch) {
      const port = circuitPortMatch[1].toLowerCase();
      const ap = getClientApName(c, port, portMap);
      return {
        port,
        apName: ap,
        detectionSource: 'option82',
        dhcpServer: dhcpServerRaw,
        dhcpHostName: dhcpHostNameRaw,
        agentCircuitId: agentCircuitIdRaw,
      };
    }

    // Match circuit ID against portMap AP names
    if (portMap && typeof portMap === 'object') {
      const lowerCircuit = agentCircuitIdRaw.toLowerCase();
      for (const [k, v] of Object.entries(portMap)) {
        if (k !== 'bridge' && k !== 'all') {
          const cleanK = k.toLowerCase().trim();
          const cleanV = (v || '').toLowerCase().trim();
          if ((cleanV && lowerCircuit.includes(cleanV)) || (cleanK && lowerCircuit.includes(cleanK))) {
            return {
              port: k,
              apName: v || getClientApName(c, k, portMap),
              detectionSource: 'option82',
              dhcpServer: dhcpServerRaw,
              dhcpHostName: dhcpHostNameRaw,
              agentCircuitId: agentCircuitIdRaw,
            };
          }
        }
      }
    }
  }

  // 6. DHCP Server / Hotspot Server Name Correlation
  if (dhcpServerRaw) {
    const serverPortMatch = dhcpServerRaw.match(/\b(ether\d+|wlan\d+|wifi\d+|sfp\d+)\b/i);
    if (serverPortMatch) {
      const port = serverPortMatch[1].toLowerCase();
      const ap = getClientApName(c, port, portMap);
      return {
        port,
        apName: ap,
        detectionSource: 'dhcp-server',
        dhcpServer: dhcpServerRaw,
        dhcpHostName: dhcpHostNameRaw,
        agentCircuitId: agentCircuitIdRaw,
      };
    }

    // Match DHCP server name against portMap AP names
    if (portMap && typeof portMap === 'object') {
      const lowerServer = dhcpServerRaw.toLowerCase();
      for (const [k, v] of Object.entries(portMap)) {
        if (k !== 'bridge' && k !== 'all') {
          const cleanK = k.toLowerCase().trim();
          const cleanV = (v || '').toLowerCase().trim();
          if ((cleanV && lowerServer.includes(cleanV)) || (cleanK && lowerServer.includes(cleanK))) {
            return {
              port: k,
              apName: v || getClientApName(c, k, portMap),
              detectionSource: 'dhcp-server',
              dhcpServer: dhcpServerRaw,
              dhcpHostName: dhcpHostNameRaw,
              agentCircuitId: agentCircuitIdRaw,
            };
          }
        }
      }
    }
  }

  // 7. DHCP Lease Hostname / Comment / Client Identifier matching port keywords
  const searchStr = `${c.comment || ''} ${c.name || ''} ${dhcpHostNameRaw} ${c.dhcpName || ''}`;
  const portMatch = searchStr.match(/\b(ether\d+|wlan\d+|wifi\d+|sfp\d+)\b/i);
  if (portMatch) {
    const port = portMatch[1].toLowerCase();
    const ap = getClientApName(c, port, portMap);
    return {
      port,
      apName: ap,
      detectionSource: 'hostname-match',
      dhcpServer: dhcpServerRaw,
      dhcpHostName: dhcpHostNameRaw,
      agentCircuitId: agentCircuitIdRaw,
    };
  }

  // 8. Direct Physical Interface on client record (if not generic 'bridge' or 'all')
  const rawIface = String(c.interface || c['interface'] || c.leaseInterface || c.dhcpInterface || '').trim();
  const rawPort = String(c.port || '').trim();

  if (
    rawIface &&
    rawIface !== 'bridge' &&
    rawIface !== 'all' &&
    rawIface !== 'unknown' &&
    rawIface !== 'none' &&
    !rawIface.startsWith('hotspot')
  ) {
    const ap = getClientApName(c, rawIface, portMap);
    return {
      port: rawIface,
      apName: ap,
      detectionSource: 'interface-match',
      dhcpServer: dhcpServerRaw,
      dhcpHostName: dhcpHostNameRaw,
      agentCircuitId: agentCircuitIdRaw,
    };
  }

  if (
    rawPort &&
    rawPort !== 'bridge' &&
    rawPort !== 'all' &&
    rawPort !== 'unknown' &&
    rawPort !== 'none' &&
    !rawPort.startsWith('hotspot')
  ) {
    const ap = getClientApName(c, rawPort, portMap);
    return {
      port: rawPort,
      apName: ap,
      detectionSource: 'interface-match',
      dhcpServer: dhcpServerRaw,
      dhcpHostName: dhcpHostNameRaw,
      agentCircuitId: agentCircuitIdRaw,
    };
  }

  // 9. Full target metadata match against configured AP names in portMap
  if (portMap && typeof portMap === 'object') {
    const fullTarget = `${c.comment || ''} ${c.name || ''} ${dhcpHostNameRaw} ${c.user || ''} ${c.mac || ''} ${c.ip || ''} ${c.apName || ''}`.toLowerCase();
    for (const [k, v] of Object.entries(portMap)) {
      if (k !== 'bridge' && k !== 'all') {
        const cleanK = k.toLowerCase().trim();
        const cleanV = (v || '').toLowerCase().trim();
        if ((cleanV && fullTarget.includes(cleanV)) || (cleanK && fullTarget.includes(cleanK))) {
          return {
            port: k,
            apName: v || getClientApName(c, k, portMap),
            detectionSource: 'ap-match',
            dhcpServer: dhcpServerRaw,
            dhcpHostName: dhcpHostNameRaw,
            agentCircuitId: agentCircuitIdRaw,
          };
        }
      }
    }
  }

  // Fallback: unassigned / generic bridge (never hijack with arbitrary port)
  return {
    port: '',
    apName: '',
    detectionSource: 'unassigned',
    dhcpServer: dhcpServerRaw,
    dhcpHostName: dhcpHostNameRaw,
    agentCircuitId: agentCircuitIdRaw,
  };
};
